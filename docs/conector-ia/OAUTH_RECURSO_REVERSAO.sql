-- REVERSÃO da migração 20261103000002_oauth_recurso_mcp.sql (restaura as definições anteriores, byte a byte, das migrações originais).
-- Rodar em UMA transação (editor SQL: o próprio script já abre/fecha). Antes: revogar sessões OAuth do conector-mcp (o script aborta se existirem ativas).
-- Não apaga dados de auditoria já gravados: só descarta a COLUNA nova (a coluna pair_sessao_id perde o vínculo; as chamadas continuam registradas).
begin;
do $$ begin
  if exists (select 1 from public.pair_sessoes where recurso = 'conector-mcp' and revogado_em is null and limite_ate > now()) then
    raise exception 'Há sessões OAuth ativas do conector-mcp: revogue-as antes de reverter.' using errcode = 'P0001';
  end if;
end $$;

-- 1) escopos: lista anterior (pair_consulta_bling)
create or replace function private.pair_escopos_validos() returns text[]
language sql immutable set search_path = '' as $$
  select array['produtos:ler', 'bling:consultar', 'enriquecimento:propor', 'banners:propor', 'categorias:propor', 'paginas:propor',
               'catalogo:propor', 'campanhas:propor', 'aprovacoes:ler', 'tarefas:ler'];
$$;

-- 2) pair_validar anterior (conecta_pair)
create or replace function public.pair_validar(p_token_hash text, p_sal_hash text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare s public.pair_sessoes; d public.pair_dispositivos; v_ativa boolean;
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' or p_sal_hash is null or p_sal_hash !~ '^[0-9a-f]{64}$' then return null; end if;
  -- as DUAS metades têm de bater: quem só tem a 1ª metade (token fraco/vazado) não autentica nem consegue disparar a revogação por replay
  select * into s from public.pair_sessoes where (token_hash = p_token_hash or token_anterior_hash = p_token_hash) and sal_hash = p_sal_hash;
  if not found then return null; end if;
  if s.token_hash <> p_token_hash then
    -- token anterior: tolerado só por 60 s após a rotação (resposta perdida). Depois disso é replay => revoga a sessão inteira.
    if s.rotacionado_em is null or now() - s.rotacionado_em > interval '60 seconds' then
      update public.pair_sessoes set revogado_em = now(), motivo_revogacao = 'replay_token_anterior' where id = s.id and revogado_em is null;
      perform private.pair_cancelar_propostas(array[s.id]);
      perform private.pair_auditar(s.loja_id, s.usuario_id, 'pair.replay_detectado', 'pair_sessoes', jsonb_build_object('sessao_id', s.id, 'dispositivo_id', s.dispositivo_id));
      return null;
    end if;
  end if;
  select * into d from public.pair_dispositivos where id = s.dispositivo_id;
  select ativa into v_ativa from public.lojas where id = s.loja_id;
  if s.revogado_em is not null or d.revogado_em is not null or s.expira_em <= now() or s.limite_ate <= now()
     or coalesce(v_ativa, false) = false or not private.administra_loja(s.loja_id, s.usuario_id) then
    return null; -- inclui: o usuário que aprovou perdeu o papel de lojista
  end if;
  update public.pair_sessoes set ultimo_uso_em = now() where id = s.id and (ultimo_uso_em is null or ultimo_uso_em < now() - interval '30 seconds');
  update public.pair_dispositivos set ultimo_uso_em = now() where id = d.id and (ultimo_uso_em is null or ultimo_uso_em < now() - interval '30 seconds');
  return jsonb_build_object('sessao_id', s.id, 'loja_id', s.loja_id, 'usuario_id', s.usuario_id, 'dispositivo_id', d.id,
    'nome', d.nome, 'tipo', d.tipo, 'escopos', s.escopos, 'capacidades', d.capacidades, 'expira_em', s.expira_em, 'renovavel', s.renovavel,
    'atual', s.token_hash = p_token_hash);
end $$;

-- 3) oauth_pair_detalhe e oauth_pair_trocar anteriores (oauth_agente)
create or replace function public.oauth_pair_detalhe(p_codigo text) returns jsonb
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

create or replace function public.oauth_pair_trocar(p_codigo_hash text,p_cliente_hash text,p_redirect text,p_challenge text,p_token_hash text,p_sal_hash text,p_refresh_hash text)
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

-- 4) oauth_pair_iniciar (8 argumentos) e agente_chamada_registrar (13 argumentos) anteriores
drop function public.oauth_pair_iniciar(text, text, text, text, text, text, text[], boolean, text);
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
revoke all on function public.oauth_pair_iniciar(text,text,text,text,text,text,text[],boolean) from public,anon,authenticated;
grant execute on function public.oauth_pair_iniciar(text,text,text,text,text,text,text[],boolean) to service_role;

drop function public.agente_chamada_registrar(uuid, text, uuid, uuid, uuid, uuid, text, public.risco_nivel, text, text, jsonb, jsonb, integer, uuid);
create function public.agente_chamada_registrar(p_loja uuid, p_origem text, p_conversa uuid, p_tarefa uuid, p_user uuid, p_mcp_chave uuid,
  p_ferramenta text, p_risco public.risco_nivel, p_decisao text, p_motivo text, p_entrada jsonb, p_saida jsonb, p_duracao int) returns void
language sql security definer set search_path = '' as $$
  insert into public.agente_chamadas_ferramenta (loja_id, origem, conversa_id, tarefa_id, user_id, mcp_chave_id, ferramenta, risco, decisao, motivo, entrada, saida, duracao_ms)
  values (p_loja, p_origem, p_conversa, p_tarefa, p_user, p_mcp_chave, left(p_ferramenta, 120), p_risco, p_decisao, left(p_motivo, 300),
          private.sanitizar_log(p_entrada), private.sanitizar_log(p_saida), p_duracao);
$$;
revoke all on function public.agente_chamada_registrar(uuid, text, uuid, uuid, uuid, uuid, text, public.risco_nivel, text, text, jsonb, jsonb, integer) from public, anon, authenticated;
grant execute on function public.agente_chamada_registrar(uuid, text, uuid, uuid, uuid, uuid, text, public.risco_nivel, text, text, jsonb, jsonb, integer) to service_role;

-- 5) remove o que a migração criou
drop function public.oauth_validar_para_recurso(text, text, text);
alter table public.agente_chamadas_ferramenta drop column pair_sessao_id;
alter table public.pair_sessoes drop column recurso;
commit;
