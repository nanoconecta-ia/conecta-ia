-- Gerada por `supabase migration new chat_operacional` (CLI 2.81.3, Actions 39167522838).
-- Preparação apenas. NÃO aplicada em projeto remoto. Só duas tabelas: conversa e mensagem.
begin;
alter table public.lojas add column chat_retencao_dias int not null default 180 check(chat_retencao_dias between 7 and 730);
create table public.conversas (
 id uuid primary key default gen_random_uuid(), loja_id uuid not null references public.lojas(id) on delete cascade,
 user_id uuid not null, titulo text not null check(char_length(titulo) between 1 and 120),
 criada_em timestamptz not null default now(), atualizada_em timestamptz not null default now(),
 turno_token uuid, turno_pergunta uuid, turno_ate timestamptz,
 unique(id,loja_id,user_id), check((turno_token is null) = (turno_pergunta is null)),
 check((turno_token is null) = (turno_ate is null))
);
create index conversas_dono_idx on public.conversas(loja_id,user_id,atualizada_em desc,id);
create table public.mensagens (
 id uuid primary key default gen_random_uuid(), loja_id uuid not null, user_id uuid not null, conversa_id uuid not null,
 papel text not null check(papel in ('usuario','assistente')), conteudo text not null check(char_length(conteudo) between 1 and 8000),
 idempotency_key text check(char_length(idempotency_key) between 8 and 120), em_resposta_a uuid,
 metadados jsonb not null default '{}' check(jsonb_typeof(metadados)='object' and pg_column_size(metadados)<=65536),
 criada_em timestamptz not null default now(), unique(id,conversa_id,loja_id,user_id),
 foreign key(conversa_id,loja_id,user_id) references public.conversas(id,loja_id,user_id) on delete cascade,
 foreign key(em_resposta_a,conversa_id,loja_id,user_id) references public.mensagens(id,conversa_id,loja_id,user_id) on delete cascade,
 check((papel='usuario' and idempotency_key is not null and em_resposta_a is null) or
       (papel='assistente' and idempotency_key is null and em_resposta_a is not null))
);
create unique index mensagens_idem_idx on public.mensagens(loja_id,user_id,idempotency_key) where papel='usuario';
create unique index mensagens_resposta_idx on public.mensagens(em_resposta_a) where em_resposta_a is not null;
create index mensagens_conversa_idx on public.mensagens(conversa_id,criada_em,id);
create index mensagens_prazo_idx on public.mensagens(loja_id,criada_em,id);
create function private.chat_imutavel() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'mensagem imutável' using errcode='42501'; end $$;
create trigger mensagens_imutaveis before update on public.mensagens for each row execute function private.chat_imutavel();

insert into public.recursos_plataforma(codigo,grupo,nome,descricao,disponivel,ativo_padrao) values
 ('chat_persistente','assistente','Histórico do chat','Conversas privadas com retenção e auditoria.',true,false),
 ('chat_consulta_bling','assistente','Consulta Bling no chat','Somente leitura, com origem explícita.',true,false),
 ('chat_leitura_administrativa','assistente','Leitura administrativa','Permissão explícita pela plataforma, motivo e auditoria.',true,false);
create function private.chat_recurso(p_loja uuid,p_recurso text) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce((select rp.disponivel and coalesce(lr.ativo,case when rp.codigo='chat_leitura_administrativa' then false else rp.ativo_padrao end) from public.recursos_plataforma rp
 left join public.loja_recursos lr on lr.recurso=rp.codigo and lr.loja_id=p_loja where rp.codigo=p_recurso),false)
$$;
create function private.chat_vinculo(p_loja uuid,p_user uuid) returns boolean language sql stable security definer set search_path='' as $$
 select p_user is not null and exists(select 1 from public.usuarios_loja where loja_id=p_loja and user_id=p_user)
$$;
create function private.chat_visivel(p_loja uuid,p_data timestamptz) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce((select p_data > now()-make_interval(days=>l.chat_retencao_dias) from public.lojas l where l.id=p_loja),false)
$$;
revoke all on function private.chat_recurso(uuid,text),private.chat_vinculo(uuid,uuid),private.chat_visivel(uuid,timestamptz) from public,anon,authenticated;
grant execute on function private.chat_visivel(uuid,timestamptz) to authenticated;
grant execute on function private.chat_recurso(uuid,text),private.chat_vinculo(uuid,uuid),private.chat_visivel(uuid,timestamptz) to service_role;

alter table public.conversas enable row level security;
alter table public.mensagens enable row level security;
create policy conversas_donas on public.conversas for select to authenticated using
 (user_id=(select auth.uid()) and private.pode_ver_loja(loja_id) and private.chat_visivel(loja_id,atualizada_em));
create policy mensagens_donas on public.mensagens for select to authenticated using
 (user_id=(select auth.uid()) and private.pode_ver_loja(loja_id) and private.chat_visivel(loja_id,criada_em));
revoke all on public.conversas,public.mensagens from public,anon,authenticated;
grant select on public.conversas,public.mensagens to authenticated;
grant all on public.conversas,public.mensagens to service_role;

-- As políticas legadas permitem editar loja_recursos: proteger OLD e NEW, inclusive troca da chave/loja.
create function private.chat_proteger_recurso() returns trigger language plpgsql security definer set search_path='' as $$
declare o text; n text; l uuid; v_ativo boolean;
begin
 if TG_OP<>'INSERT' then o:=old.recurso; end if;
 if TG_OP<>'DELETE' then n:=new.recurso; end if;
 if coalesce(o,'') not in ('chat_persistente','chat_consulta_bling','chat_leitura_administrativa') and
    coalesce(n,'') not in ('chat_persistente','chat_consulta_bling','chat_leitura_administrativa') then
   if TG_OP='DELETE' then return old; else return new; end if;
 end if;
 if TG_OP='UPDATE' and (old.loja_id<>new.loja_id or old.recurso<>new.recurso) then raise exception 'identidade imutável' using errcode='42501'; end if;
 if TG_OP='DELETE' then l:=old.loja_id; v_ativo:=false; else l:=new.loja_id; v_ativo:=new.ativo; end if;
 if current_setting('role',true) not in ('service_role','none','postgres') then
   if o='chat_leitura_administrativa' or n='chat_leitura_administrativa' then
     if not private.eh_super_admin() then raise exception 'requer plataforma com MFA' using errcode='42501'; end if;
   elsif not public.pode_administrar_loja(l) then raise exception 'requer administrador' using errcode='42501'; end if;
 end if;
 insert into public.auditoria(loja_id,user_id,acao,tabela,depois) values
 (l,auth.uid(),'chat.recurso_alterado','loja_recursos',jsonb_build_object('recurso',coalesce(n,o),'ativo',v_ativo));
 if TG_OP='DELETE' then return old; else return new; end if;
end $$;
create trigger chat_flags before insert or update or delete on public.loja_recursos for each row execute function private.chat_proteger_recurso();

create function public.chat_iniciar(p_loja uuid,p_user uuid,p_conversa uuid,p_texto text,p_idem text,p_provedor text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.conversas; q public.mensagens; a public.mensagens; v_conversa uuid:=p_conversa; tok uuid;
begin
 if not private.chat_vinculo(p_loja,p_user) then raise exception 'acesso negado' using errcode='42501'; end if;
 if not private.chat_recurso(p_loja,'chat_persistente') then raise exception 'histórico desligado' using errcode='55000'; end if;
 if p_texto is null or char_length(btrim(p_texto)) not between 1 and 1000 or p_idem is null or char_length(p_idem) not between 8 and 120
 or (p_provedor is not null and p_provedor not in ('claude','gemini','compativel_openai')) then raise exception 'turno inválido' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_loja::text||p_user::text||p_idem,0));
 select * into q from public.mensagens where loja_id=p_loja and user_id=p_user and idempotency_key=p_idem and papel='usuario';
 if found then
   if q.conteudo<>p_texto or (p_conversa is not null and q.conversa_id<>p_conversa) then raise exception 'idempotência incompatível' using errcode='22023'; end if;
   if not private.chat_visivel(p_loja,q.criada_em) then raise exception 'turno expirado' using errcode='P0002'; end if;
   select * into a from public.mensagens where em_resposta_a=q.id;
   if found then return jsonb_build_object('estado','concluido','conversa_id',q.conversa_id,'resposta',a.conteudo,'metadados',a.metadados); end if;
   -- Uma chamada externa pode ter acontecido antes da queda. Não repetir automaticamente depois do prazo.
   select * into c from public.conversas where id=q.conversa_id for update;
   return jsonb_build_object('estado',case when c.turno_ate>now() then 'em_execucao' else 'interrompido' end,'conversa_id',q.conversa_id);
 end if;
 if v_conversa is null then
  insert into public.conversas(loja_id,user_id,titulo) values(p_loja,p_user,left(regexp_replace(p_texto,'\s+',' ','g'),60)) returning * into c;
 else
  select * into c from public.conversas where id=v_conversa and loja_id=p_loja and user_id=p_user and private.chat_visivel(loja_id,atualizada_em) for update;
  if not found then raise exception 'conversa inexistente' using errcode='P0002'; end if;
 end if;
 if c.turno_ate>now() then return jsonb_build_object('estado','em_execucao','conversa_id',c.id); end if;
 tok:=gen_random_uuid();
 insert into public.mensagens(loja_id,user_id,conversa_id,papel,conteudo,idempotency_key,metadados)
 values(p_loja,p_user,c.id,'usuario',p_texto,p_idem,jsonb_build_object('provedor',p_provedor)) returning * into q;
 update public.conversas set turno_token=tok,turno_pergunta=q.id,turno_ate=now()+interval '15 minutes',atualizada_em=now(),titulo=left(regexp_replace(p_texto,'\s+',' ','g'),60) where id=c.id;
 insert into public.auditoria(loja_id,user_id,acao,tabela,depois) values(p_loja,p_user,'chat.turno_iniciado','mensagens',jsonb_build_object('conversa_id',c.id,'pergunta_id',q.id,'provedor',p_provedor));
 return jsonb_build_object('estado','novo','conversa_id',c.id,'pergunta_id',q.id,'turno_token',tok);
end $$;

create function public.chat_responder(p_loja uuid,p_user uuid,p_pergunta uuid,p_token uuid,p_resposta text,p_meta jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare c public.conversas; mid uuid; prov text; nt int;
begin
 if not private.chat_vinculo(p_loja,p_user) then raise exception 'acesso negado' using errcode='42501'; end if;
 select * into c from public.conversas where loja_id=p_loja and user_id=p_user and turno_pergunta=p_pergunta for update;
 if not found or c.turno_token is distinct from p_token or p_token is null or c.turno_ate<=now() then raise exception 'reserva inválida' using errcode='42501'; end if;
 if p_meta is null or jsonb_typeof(p_meta)<>'object' or pg_column_size(p_meta)>65536 then raise exception 'metadados inválidos'; end if;
 insert into public.mensagens(loja_id,user_id,conversa_id,papel,conteudo,em_resposta_a,metadados)
 values(p_loja,p_user,c.id,'assistente',left(p_resposta,8000),p_pergunta,p_meta) returning id into mid;
 prov:=p_meta->>'provedor'; nt:=coalesce((p_meta->>'tokens')::int,0);
 if nt<0 then raise exception 'tokens inválidos'; end if;
 if prov in ('claude','gemini','compativel_openai') and nt>0 then perform public.ia_registrar_uso(p_loja,prov,nt); end if;
 update public.conversas set turno_token=null,turno_pergunta=null,turno_ate=null,atualizada_em=now() where id=c.id;
 insert into public.auditoria(loja_id,user_id,acao,tabela,depois) values(p_loja,p_user,'chat.turno_concluido','mensagens',
 jsonb_build_object('conversa_id',c.id,'mensagem_id',mid,'provedor',prov,'modelo',p_meta->>'modelo','resposta_id',p_meta->>'resposta_id','tokens',nt,'simulado',p_meta->'simulado','desfecho',p_meta->>'desfecho'));
 return mid;
end $$;

create function public.chat_excluir(p_conversa uuid) returns boolean language plpgsql security definer set search_path='' as $$
declare c public.conversas; n int;
begin
 if auth.uid() is null then return false; end if;
 select * into c from public.conversas where id=p_conversa and user_id=auth.uid() for update;
 if not found or not private.chat_vinculo(c.loja_id,auth.uid()) then return false; end if;
 if c.turno_ate>now() then raise exception 'aguarde o turno em execução' using errcode='55000'; end if;
 select count(*) into n from public.mensagens where conversa_id=c.id;
 delete from public.conversas where id=c.id;
 insert into public.auditoria(loja_id,user_id,acao,tabela,depois) values(c.loja_id,auth.uid(),'chat.excluido','conversas',jsonb_build_object('conversa_id',c.id,'mensagens',n)); return true;
end $$;

-- Configuração só por RPC: proteger também UPDATE direto da coluna na tabela lojas.
create function private.chat_guardar_retencao() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.chat_retencao_dias is distinct from old.chat_retencao_dias and current_setting('conecta.chat_retencao',true) is distinct from 'rpc' then
  raise exception 'use chat_definir_retencao' using errcode='42501'; end if; return new;
end $$;
create trigger chat_retencao before update of chat_retencao_dias on public.lojas for each row execute function private.chat_guardar_retencao();
create function public.chat_definir_retencao(p_loja uuid,p_dias int) returns boolean language plpgsql security definer set search_path='' as $$
declare antes int;
begin
 if auth.uid() is null or not public.pode_administrar_loja(p_loja) or p_dias is null or p_dias not between 7 and 730 then return false; end if;
 select chat_retencao_dias into antes from public.lojas where id=p_loja for update;
 -- Eliminar vencidas sob a política anterior ANTES de estender: prazo maior não ressuscita dados.
 delete from public.mensagens where loja_id=p_loja and criada_em<=now()-make_interval(days=>least(antes,p_dias));
 perform set_config('conecta.chat_retencao','rpc',true);
 update public.lojas set chat_retencao_dias=p_dias where id=p_loja;
 perform set_config('conecta.chat_retencao','',true);
 insert into public.auditoria(loja_id,user_id,acao,tabela,antes,depois) values(p_loja,auth.uid(),'chat.retencao_alterada','lojas',jsonb_build_object('dias',antes),jsonb_build_object('dias',p_dias)); return true;
end $$;

create function public.chat_ler_como_administrador(p_loja uuid,p_conversa uuid,p_motivo text,p_antes timestamptz default null,p_antes_id uuid default null)
returns setof public.mensagens language plpgsql security definer set search_path='' as $$
declare dono uuid;
begin
 if auth.uid() is null or not private.administra_loja(p_loja,auth.uid()) or not private.chat_recurso(p_loja,'chat_leitura_administrativa') or char_length(btrim(coalesce(p_motivo,'')))<10 then
 raise exception 'leitura administrativa não permitida' using errcode='42501'; end if;
 select user_id into dono from public.conversas where id=p_conversa and loja_id=p_loja and private.chat_visivel(loja_id,atualizada_em);
 if not found then raise exception 'leitura administrativa não permitida' using errcode='42501'; end if;
 insert into public.auditoria(loja_id,user_id,acao,tabela,depois) values(p_loja,auth.uid(),'chat.leitura_administrativa','conversas',
 jsonb_build_object('conversa_id',p_conversa,'dono',dono,'motivo',left(btrim(p_motivo),300),'antes',p_antes,'limite',100));
 return query select * from public.mensagens m where m.conversa_id=p_conversa and m.loja_id=p_loja and private.chat_visivel(m.loja_id,m.criada_em)
 and (p_antes is null or (m.criada_em,m.id)<(p_antes,p_antes_id)) order by m.criada_em desc,m.id desc limit 100;
end $$;

create function public.chat_expurgar() returns int language plpgsql security definer set search_path='' as $$
declare n int;
begin
 with candidatas as (select m.id from public.mensagens m join public.lojas l on l.id=m.loja_id
 where m.criada_em<=now()-make_interval(days=>l.chat_retencao_dias) order by m.criada_em limit 1000 for update of m skip locked),
 apagadas as (delete from public.mensagens where id in(select id from candidatas) returning id) select count(*) into n from apagadas;
 delete from public.conversas c where not exists(select 1 from public.mensagens m where m.conversa_id=c.id) and coalesce(c.turno_ate,'-infinity')<now();
 if n>0 then insert into public.auditoria(acao,tabela,depois) values('chat.expurgo','mensagens',jsonb_build_object('mensagens',n)); end if; return n;
end $$;
revoke all on function public.chat_iniciar(uuid,uuid,uuid,text,text,text),public.chat_responder(uuid,uuid,uuid,uuid,text,jsonb),public.chat_excluir(uuid),public.chat_definir_retencao(uuid,int),public.chat_ler_como_administrador(uuid,uuid,text,timestamptz,uuid),public.chat_expurgar() from public,anon,authenticated;
grant execute on function public.chat_iniciar(uuid,uuid,uuid,text,text,text),public.chat_responder(uuid,uuid,uuid,uuid,text,jsonb),public.chat_expurgar() to service_role;
grant execute on function public.chat_excluir(uuid),public.chat_definir_retencao(uuid,int),public.chat_ler_como_administrador(uuid,uuid,text,timestamptz,uuid) to authenticated;
-- Rotina estritamente local ao banco; nenhuma URL, JWT ou segredo em cron.
do $$ begin if exists(select 1 from pg_extension where extname='pg_cron') then
 perform cron.schedule('chat-expurgo','17 * * * *','select public.chat_expurgar();'); end if; end $$;
commit;
