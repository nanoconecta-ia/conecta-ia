-- OAuth do agente reutiliza Pair. Sem nova tabela; clientes públicos têm metadados assinados no servidor.
alter table public.pair_desafios add column oauth jsonb check (oauth is null or jsonb_typeof(oauth) = 'object');
alter table public.pair_sessoes
  add column oauth_cliente_hash text check (oauth_cliente_hash ~ '^[0-9a-f]{64}$'),
  add column oauth_refresh_hash text unique check (oauth_refresh_hash ~ '^[0-9a-f]{64}$'),
  add column oauth_refresh_anterior_hash text unique check (oauth_refresh_anterior_hash ~ '^[0-9a-f]{64}$');

-- Apenas o servidor cria um pedido depois de validar registro, redirect URI, resource e PKCE.
create function public.oauth_pair_iniciar(p_codigo_hash text,p_cliente_hash text,p_redirect text,p_challenge text,p_state text,p_nome text,p_escopos text[],p_offline boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r jsonb;
begin
  if p_cliente_hash !~ '^[0-9a-f]{64}$' or p_challenge !~ '^[A-Za-z0-9_-]{43}$'
    or length(p_redirect) not between 8 and 2048 or length(p_state) not between 8 and 512 then raise exception 'pedido inválido' using errcode='22023'; end if;
  r:=public.pair_iniciar(p_codigo_hash,private.pair_sha256(gen_random_uuid()::text),private.pair_sha256(gen_random_uuid()::text),
    private.pair_sha256(gen_random_uuid()::text),private.pair_sha256(gen_random_uuid()::text),p_nome,'agente_externo',p_escopos,'{}',60,120,true);
  update public.pair_desafios set expira_em=now()+interval '10 minutes',oauth=jsonb_build_object('cliente_hash',p_cliente_hash,
    'redirect_uri',p_redirect,'challenge',p_challenge,'state',p_state,'offline',coalesce(p_offline,false)) where id=(r->>'id')::uuid;
  return jsonb_build_object('ok',true);
end $$;

create function public.oauth_pair_detalhe(p_codigo text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare d public.pair_desafios; r jsonb;
begin
  if auth.uid() is null then raise exception 'não autenticado' using errcode='28000'; end if;
  r:=public.pair_detalhe(p_codigo);
  if r is null then return null; end if;
  select * into d from public.pair_desafios where codigo_hash=private.pair_sha256(p_codigo);
  if d.oauth is null then return null; end if;
  return r || jsonb_build_object('redirect_uri',d.oauth->>'redirect_uri','offline',d.oauth->'offline','state',d.oauth->>'state');
end $$;

-- Consentimento nativo autenticado; código de autorização expira em 60s após a decisão.
create function public.oauth_pair_aprovar(p_codigo text,p_loja uuid,p_escopos text[],p_duracao int,p_offline boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$
declare d public.pair_desafios; uid uuid:=auth.uid();
begin
  if uid is null then raise exception 'não autenticado' using errcode='28000'; end if;
  if not private.administra_loja(p_loja,uid) then raise exception 'sem permissão nesta loja' using errcode='42501'; end if;
  if not private.autenticacao_recente(900) then return jsonb_build_object('ok',false,'motivo','reconfirmacao_necessaria'); end if;
  select * into d from public.pair_desafios where codigo_hash=private.pair_sha256(p_codigo) for update;
  if not found or d.oauth is null or d.estado<>'pendente' or d.expira_em<=now() then return jsonb_build_object('ok',false,'motivo','expirado'); end if;
  if p_escopos is null or cardinality(p_escopos)=0 or not(p_escopos <@ d.escopos_solicitados)
    or not(p_escopos <@ private.pair_escopos_validos()) or (p_offline is true and coalesce((d.oauth->>'offline')::boolean,false) is false) or p_duracao is null or p_duracao not between 5 and d.duracao_solicitada_min then
    return jsonb_build_object('ok',false,'motivo','permissao_invalida'); end if;
  update public.pair_desafios set estado='aprovado',loja_id=p_loja,aprovado_por=uid,aprovado_em=now(),
    escopos_aprovados=p_escopos,capacidades_aprovadas='{}',duracao_aprovada_min=p_duracao,oauth=jsonb_set(oauth,'{offline}',to_jsonb(coalesce(p_offline,false))),expira_em=now()+interval '60 seconds' where id=d.id;
  perform private.pair_auditar(p_loja,uid,'oauth.consentimento','pair_desafios',jsonb_build_object('desafio_id',d.id,
    'cliente_hash',d.oauth->>'cliente_hash','escopos',p_escopos,'duracao_min',p_duracao));
  return jsonb_build_object('ok',true,'redirect_uri',d.oauth->>'redirect_uri','state',d.oauth->>'state');
end $$;

-- Chamada apenas pelo servidor após calcular S256 do verifier. Resgate e sessão na mesma transação.
create function public.oauth_pair_trocar(p_codigo_hash text,p_cliente_hash text,p_redirect text,p_challenge text,p_token_hash text,p_sal_hash text,p_refresh_hash text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare d public.pair_desafios; r jsonb; s public.pair_sessoes; offl boolean;
begin
  select * into d from public.pair_desafios where codigo_hash=p_codigo_hash for update;
  if not found or d.oauth is null or d.oauth->>'cliente_hash' is distinct from p_cliente_hash
    or d.oauth->>'redirect_uri' is distinct from p_redirect or d.oauth->>'challenge' is distinct from p_challenge then return null; end if;
  if d.estado='resgatado' then
    update public.pair_sessoes set revogado_em=coalesce(revogado_em,now()),motivo_revogacao='oauth_codigo_reutilizado' where dispositivo_id=d.dispositivo_id;
    perform private.pair_cancelar_propostas(array(select id from public.pair_sessoes where dispositivo_id=d.dispositivo_id));
    perform private.pair_auditar(d.loja_id,d.aprovado_por,'oauth.codigo_reutilizado','pair_desafios',jsonb_build_object('desafio_id',d.id));
    return null;
  end if;
  if d.estado<>'aprovado' or d.expira_em<=now() then return null; end if;
  if not private.administra_loja(d.loja_id,d.aprovado_por) or not exists(select 1 from public.lojas where id=d.loja_id and ativa) then return null; end if;
  offl:=coalesce((d.oauth->>'offline')::boolean,false);
  update public.pair_desafios set token_hash=p_token_hash,sal_hash=p_sal_hash where id=d.id;
  r:=public.pair_consultar(d.codigo_hash,d.segredo_hash);
  if r->>'estado'<>'resgatado' then return null; end if;
  update public.pair_sessoes set oauth_cliente_hash=p_cliente_hash,oauth_refresh_hash=case when offl then p_refresh_hash else null end
    where dispositivo_id=(r->>'dispositivo_id')::uuid returning * into s;
  update public.pair_desafios set oauth=oauth-'state' where id=d.id;
  return jsonb_build_object('escopos',s.escopos,'expira_em',s.expira_em,'offline',offl);
end $$;

create function public.oauth_pair_renovar(p_refresh_hash text,p_cliente_hash text,p_token_hash text,p_sal_hash text,p_novo_refresh_hash text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.pair_sessoes;
begin
  select * into s from public.pair_sessoes where (oauth_refresh_hash=p_refresh_hash or oauth_refresh_anterior_hash=p_refresh_hash)
    and oauth_cliente_hash=p_cliente_hash for update;
  if not found then return null; end if;
  if s.oauth_refresh_hash<>p_refresh_hash then
    update public.pair_sessoes set revogado_em=coalesce(revogado_em,now()),motivo_revogacao='oauth_refresh_reutilizado' where id=s.id;
    perform private.pair_cancelar_propostas(array[s.id]);
    perform private.pair_auditar(s.loja_id,s.usuario_id,'oauth.refresh_reutilizado','pair_sessoes',jsonb_build_object('sessao_id',s.id));
    return null;
  end if;
  if s.revogado_em is not null or s.limite_ate<=now() or not private.administra_loja(s.loja_id,s.usuario_id)
    or not exists(select 1 from public.lojas where id=s.loja_id and ativa)
    or not exists(select 1 from public.pair_dispositivos where id=s.dispositivo_id and revogado_em is null) then return null; end if;
  update public.pair_sessoes set token_anterior_hash=null,token_hash=p_token_hash,sal_hash=p_sal_hash,
    oauth_refresh_anterior_hash=oauth_refresh_hash,oauth_refresh_hash=p_novo_refresh_hash,rotacionado_em=now(),
    expira_em=least(now()+interval '15 minutes',limite_ate) where id=s.id returning * into s;
  perform private.pair_auditar(s.loja_id,s.usuario_id,'oauth.renovado','pair_sessoes',jsonb_build_object('sessao_id',s.id));
  return jsonb_build_object('escopos',s.escopos,'expira_em',s.expira_em,'offline',true);
end $$;

create function public.oauth_pair_revogar(p_hash text,p_cliente_hash text,p_sal_hash text default null) returns void
language plpgsql security definer set search_path='' as $$
declare s public.pair_sessoes;
begin
  select * into s from public.pair_sessoes where (oauth_refresh_hash=p_hash or oauth_refresh_anterior_hash=p_hash or (token_hash=p_hash and sal_hash=p_sal_hash))
    and oauth_cliente_hash=p_cliente_hash for update;
  if not found then return; end if;
  update public.pair_sessoes set revogado_em=coalesce(revogado_em,now()),motivo_revogacao='oauth_revogado' where id=s.id;
  perform private.pair_cancelar_propostas(array[s.id]);
  perform private.pair_auditar(s.loja_id,s.usuario_id,'oauth.revogado','pair_sessoes',jsonb_build_object('sessao_id',s.id));
end $$;

-- Access token OAuth não funciona como refresh pelo endpoint antigo do Pair.
create or replace function public.pair_renovar(p_token_hash text,p_sal_hash text,p_novo_hash text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v jsonb; s public.pair_sessoes;
begin
  if p_novo_hash is null or p_novo_hash !~ '^[0-9a-f]{64}$' or p_novo_hash=p_token_hash then return jsonb_build_object('ok',false,'motivo','token_novo_invalido'); end if;
  if exists(select 1 from public.pair_sessoes where token_hash=p_token_hash and sal_hash=p_sal_hash and oauth_cliente_hash is not null) then return jsonb_build_object('ok',false,'motivo','use_oauth'); end if;
  v:=public.pair_validar(p_token_hash,p_sal_hash);
  if v is null or (v->>'atual')::boolean is not true then return jsonb_build_object('ok',false,'motivo','token_invalido'); end if;
  if (v->>'renovavel')::boolean is not true then return jsonb_build_object('ok',false,'motivo','sessao_nao_renovavel'); end if;
  update public.pair_sessoes set token_anterior_hash=token_hash,token_hash=p_novo_hash,rotacionado_em=now(),
    expira_em=least(now()+interval '15 minutes',limite_ate)
    where id=(v->>'sessao_id')::uuid and token_hash=p_token_hash and revogado_em is null returning * into s;
  if not found then return jsonb_build_object('ok',false,'motivo','token_invalido'); end if;
  return jsonb_build_object('ok',true,'expira_em',s.expira_em,'limite_ate',s.limite_ate);
exception when unique_violation then return jsonb_build_object('ok',false,'motivo','token_novo_invalido');
end $$;

revoke all on function public.oauth_pair_iniciar(text,text,text,text,text,text,text[],boolean),
 public.oauth_pair_trocar(text,text,text,text,text,text,text),public.oauth_pair_renovar(text,text,text,text,text),public.oauth_pair_revogar(text,text,text) from public,anon,authenticated;
grant execute on function public.oauth_pair_iniciar(text,text,text,text,text,text,text[],boolean),
 public.oauth_pair_trocar(text,text,text,text,text,text,text),public.oauth_pair_renovar(text,text,text,text,text),public.oauth_pair_revogar(text,text,text) to service_role;
revoke all on function public.oauth_pair_detalhe(text),public.oauth_pair_aprovar(text,uuid,text[],integer,boolean) from public,anon;
grant execute on function public.oauth_pair_detalhe(text),public.oauth_pair_aprovar(text,uuid,text[],integer,boolean) to authenticated;
