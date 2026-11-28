-- MINUTA CI descartável. Lease com autoria de sessão, não transição de estado.
begin;
alter table public.pipeline_itens add column nano_produtor name;
grant create on schema nano_lifecycle_interno to nano_lifecycle_consumidor;
create function nano_lifecycle_interno.produtor_autorizado(p_loja uuid) returns boolean
language plpgsql stable security invoker set search_path='' as $fn$
begin
 if not pg_has_role(session_user,'nano_lifecycle_produtor','MEMBER') or pg_has_role(session_user,'service_role','MEMBER') or pg_has_role(session_user,'nano_lifecycle_auditoria','MEMBER') or pg_has_role(session_user,'nano_lifecycle_consumidor','MEMBER') or pg_has_role(session_user,'nano_lifecycle_auditor_leitor','MEMBER') or exists(select 1 from pg_catalog.pg_roles where rolname=session_user and (not rolcanlogin or rolsuper or rolbypassrls or rolcreaterole)) or not exists(select 1 from nano_lifecycle_interno.produtor_escopos where login_db=session_user and loja_id=p_loja and habilitado) then return false; end if;
 return true;
end $fn$;
alter function nano_lifecycle_interno.produtor_autorizado(uuid) owner to nano_lifecycle_consumidor;
revoke all on function nano_lifecycle_interno.produtor_autorizado(uuid) from public,anon,authenticated,service_role,nano_lifecycle_produtor;
-- Coluna nova não pode ser inserida, trocada ou removida fora de uma nova geração.
create function nano_lifecycle_interno.proteger_produtor_lease() returns trigger
language plpgsql security invoker set search_path='' as $fn$
begin
 if tg_op='INSERT' then
  if new.nano_produtor is not null then raise exception 'autoria de lease exige reserva' using errcode='42501'; end if;
  return new;
 end if;
 if old.nano_produtor is distinct from new.nano_produtor then
  if current_user<>'nano_lifecycle_consumidor' or old.entrada->>'origem' is distinct from 'nano_lifecycle' or new.nano_geracao<>old.nano_geracao+1 or new.nano_execucao is null or new.reservado_ate is null or (new.nano_produtor is not null and new.nano_produtor is distinct from session_user) then raise exception 'autoria de lease protegida' using errcode='42501'; end if;
 end if;
 return new;
end $fn$;
revoke all on function nano_lifecycle_interno.proteger_produtor_lease() from public,anon,authenticated,service_role;
create trigger nano_lifecycle_proteger_produtor before insert or update on public.pipeline_itens for each row execute function nano_lifecycle_interno.proteger_produtor_lease();
create or replace function nano_lifecycle_interno.nano_lifecycle_reivindicar(p_loja uuid,p_item uuid,p_execucao uuid,p_segundos integer default 120)
returns jsonb language plpgsql security definer set search_path='' set nano.consumer_loja='' as $fn$
declare cp public.nano_lifecycle_checkpoint; i public.pipeline_itens; r jsonb; t timestamptz; restante numeric;
begin
 perform set_config('nano.consumer_loja',coalesce(p_loja::text,''),true);
 if p_execucao is null or p_segundos is null or p_segundos not between 10 and 180 then raise exception 'reserva inválida'; end if;
 select * into cp from public.nano_lifecycle_checkpoint where loja_id=p_loja for update;
 if not found or not cp.habilitado or not cp.despacho_habilitado or not cp.consumo_habilitado then return jsonb_build_object('estado','desabilitado'); end if;
 select * into i from public.pipeline_itens where loja_id=p_loja and id=p_item and entrada->>'origem'='nano_lifecycle';
 if not found then return jsonb_build_object('estado','item_inexistente'); end if;
 if i.estado<>'entrada' then return jsonb_build_object('estado','estado_invalido'); end if;
 -- Revalida a identidade, revisão técnica, pausa e vínculo ao evento capturado.
 -- Encaminhar pode criar item se outro escritor removê-lo entre as leituras;
 -- qualquer resultado diferente do item existente provoca rollback ou recusa.
 r:=public.nano_lifecycle_encaminhar(p_loja,i.entrada->>'revisao',i.idempotency_key);
 if r->>'estado'='encaminhado' then raise exception 'item desapareceu durante reivindicação'; end if;
 if r->>'estado'<>'ja_encaminhado' then return r; end if;
 if r->>'item_id' is distinct from p_item::text then raise exception 'item divergente'; end if;
 select * into i from public.pipeline_itens where loja_id=p_loja and id=p_item for update;
 if not found or i.estado<>'entrada' or i.entrada->>'origem' is distinct from 'nano_lifecycle' then return jsonb_build_object('estado','estado_invalido'); end if;
 t:=clock_timestamp();
 if i.reservado_ate>t then return jsonb_build_object('estado','ocupado'); end if;
 if i.proxima_tentativa>t then return jsonb_build_object('estado','aguardar'); end if;
 if i.nano_execucao=p_execucao then return jsonb_build_object('estado','execucao_reutilizada'); end if;
 -- Limite conservador: apenas uma reserva Nano ativa por loja neste piloto.
 if exists(select 1 from public.pipeline_itens where loja_id=p_loja and id<>p_item and entrada->>'origem'='nano_lifecycle' and reservado_ate>t) then return jsonb_build_object('estado','ocupado'); end if;
 restante:=(public.pipeline_orcamento_estado(p_loja)->>'restante_usd')::numeric;
 if restante is null or restante<=0 then return jsonb_build_object('estado','orcamento_indisponivel'); end if;
 update public.pipeline_itens set nano_execucao=p_execucao,nano_geracao=nano_geracao+1,nano_produtor=case when nano_lifecycle_interno.produtor_autorizado(p_loja) then session_user else null end,reservado_ate=t+make_interval(secs=>p_segundos)
 where id=p_item and loja_id=p_loja returning * into i;
 return jsonb_build_object('estado','reservado','item_id',i.id,'geracao',i.nano_geracao,'versao',i.versao,'expira_em',i.reservado_ate);
end $fn$;
create or replace function public.nano_lifecycle_entrada_tecnica(p_loja uuid,p_item uuid,p_execucao uuid,p_geracao bigint,p_versao integer)
returns jsonb language plpgsql security invoker set search_path='' as $fn$
declare cp public.nano_lifecycle_checkpoint; i public.pipeline_itens; r jsonb; p jsonb;
begin
 select * into cp from public.nano_lifecycle_checkpoint where loja_id=p_loja for update;
 if not found or not cp.habilitado or not cp.despacho_habilitado or not cp.consumo_habilitado then return jsonb_build_object('estado','desabilitado'); end if;
 select * into i from public.pipeline_itens where loja_id=p_loja and id=p_item and entrada->>'origem'='nano_lifecycle';
 if not found then return jsonb_build_object('estado','item_inexistente'); end if;
 if i.nano_produtor is not null and i.nano_produtor is distinct from session_user then return jsonb_build_object('estado','reserva_invalida'); end if;
 if i.estado<>'entrada' or p_execucao is null or p_geracao is null or p_versao is null or i.nano_execucao is distinct from p_execucao or i.nano_geracao<>p_geracao or i.versao<>p_versao or i.reservado_ate is null or i.reservado_ate<=clock_timestamp() then return jsonb_build_object('estado','reserva_invalida'); end if;
 -- Revalida evento, revisão, snapshot, identidade e pausa sob locks do despacho.
 r:=public.nano_lifecycle_encaminhar(p_loja,i.entrada->>'revisao',i.idempotency_key);
 if r->>'estado'='encaminhado' then raise exception 'tarefa desapareceu durante leitura'; end if;
 if r->>'estado'<>'ja_encaminhado' then return r; end if;
 if r->>'item_id' is distinct from p_item::text then raise exception 'tarefa divergente'; end if;
 select * into i from public.pipeline_itens where loja_id=p_loja and id=p_item for update;
 if not found or i.estado<>'entrada' or i.nano_execucao is distinct from p_execucao or i.nano_geracao<>p_geracao or i.versao<>p_versao or i.reservado_ate is null or i.reservado_ate<=clock_timestamp() then return jsonb_build_object('estado','reserva_invalida'); end if;
 select v into p from public.nano_lifecycle_snapshots s cross join lateral jsonb_array_elements(s.produtos) v where s.loja_id=p_loja and s.revisao=cp.revisao and v->>'id'=i.produto_id::text;
 if p is null or p->>'loja_id' is distinct from p_loja::text or p->>'situacao' is distinct from 'A' or btrim(p->>'sku') is distinct from i.sku or nullif(btrim(p->>'nome'),'') is null then return jsonb_build_object('estado','dados_tecnicos_incompletos'); end if;
 return jsonb_build_object('estado','preparada','loja_id',p_loja,'item_id',p_item,'execucao',p_execucao,'geracao',p_geracao,'versao',p_versao,'revisao',i.entrada->>'revisao','checkpoint',cp.revisao,
 'produto',jsonb_build_object('id',p->>'id','bling_id',p->>'bling_id','sku',i.sku,'nome',p->>'nome','marca',p->>'marca','gtin',p->>'gtin','descricao_curta',p->>'descricao_curta','descricao_complementar',p->>'descricao_complementar'));
end $fn$;
create or replace function nano_lifecycle_interno.nano_lifecycle_liberar_item(p_loja uuid,p_item uuid,p_execucao uuid,p_geracao bigint,p_versao integer)
returns boolean language plpgsql security definer set search_path='' set nano.consumer_loja='' as $fn$
begin
 perform set_config('nano.consumer_loja',coalesce(p_loja::text,''),true);
 perform 1 from public.nano_lifecycle_checkpoint where loja_id=p_loja for update;
 if not found then return false; end if;
 update public.pipeline_itens set reservado_ate=null where loja_id=p_loja and id=p_item and entrada->>'origem'='nano_lifecycle'
 and (nano_produtor is null or nano_produtor=session_user) and nano_execucao=p_execucao and nano_geracao=p_geracao and versao=p_versao and reservado_ate>clock_timestamp();
 return found;
end $fn$;
create or replace function nano_lifecycle_interno.nano_lifecycle_persistir_com_autoria(p_loja uuid,p_item uuid,p_execucao uuid,p_geracao bigint,p_versao integer,p_entrada jsonb,p_extracao jsonb)
returns jsonb language plpgsql security definer set search_path='' set nano.consumer_loja='' as $fn$
declare r jsonb; a nano_lifecycle_interno.autorias_engenharia;
begin
 perform set_config('nano.consumer_loja',coalesce(p_loja::text,''),true);
 if not nano_lifecycle_interno.produtor_autorizado(p_loja) then return jsonb_build_object('estado','produtor_nao_autorizado'); end if;
 perform 1 from public.nano_lifecycle_checkpoint where loja_id=p_loja for update;
 if not found or not exists(select 1 from public.pipeline_itens where loja_id=p_loja and id=p_item and nano_execucao=p_execucao and nano_geracao=p_geracao and versao=p_versao and nano_produtor=session_user) then return jsonb_build_object('estado','reserva_invalida'); end if;
 -- A RPC existente serializa pelo checkpoint e valida a reserva/snapshot.
 r:=nano_lifecycle_interno.nano_lifecycle_persistir_engenharia(p_loja,p_item,p_execucao,p_geracao,p_versao,p_entrada,p_extracao);
 if r->>'estado'='gravado' then
  insert into nano_lifecycle_interno.autorias_engenharia(loja_id,item_id,geracao,execucao,versao,produtor,hash_entrada,hash_extracao) values(p_loja,p_item,p_geracao,p_execucao,p_versao,session_user,r->>'hash_entrada',r->>'hash_extracao');
 elsif r->>'estado'='ja_gravado' then
  select * into a from nano_lifecycle_interno.autorias_engenharia where loja_id=p_loja and item_id=p_item and geracao=p_geracao;
  if not found or a.produtor is distinct from session_user or a.execucao is distinct from p_execucao or a.versao is distinct from p_versao or a.hash_entrada is distinct from r->>'hash_entrada' or a.hash_extracao is distinct from r->>'hash_extracao' then return jsonb_build_object('estado','autoria_nao_registrada_ou_divergente'); end if;
 end if;
 return r;
end $fn$;
-- Interfaces internas para login dedicado, sem acesso a tabelas ou service_role.
create function nano_lifecycle_interno.nano_lifecycle_reservar_produtor(p_loja uuid,p_item uuid,p_execucao uuid,p_segundos integer default 120)
returns jsonb language plpgsql security definer set search_path='' set nano.consumer_loja='' as $fn$
begin
 if not nano_lifecycle_interno.produtor_autorizado(p_loja) then return jsonb_build_object('estado','produtor_nao_autorizado'); end if;
 return nano_lifecycle_interno.nano_lifecycle_reivindicar(p_loja,p_item,p_execucao,p_segundos);
end $fn$;
create function nano_lifecycle_interno.nano_lifecycle_entrada_produtor(p_loja uuid,p_item uuid,p_execucao uuid,p_geracao bigint,p_versao integer)
returns jsonb language plpgsql security definer set search_path='' set nano.consumer_loja='' as $fn$
begin
 perform set_config('nano.consumer_loja',coalesce(p_loja::text,''),true);
 if not nano_lifecycle_interno.produtor_autorizado(p_loja) then return jsonb_build_object('estado','produtor_nao_autorizado'); end if;
 perform 1 from public.nano_lifecycle_checkpoint where loja_id=p_loja for update;
 if not found or not exists(select 1 from public.pipeline_itens where loja_id=p_loja and id=p_item and nano_execucao=p_execucao and nano_geracao=p_geracao and versao=p_versao and nano_produtor=session_user) then return jsonb_build_object('estado','reserva_invalida'); end if;
 return public.nano_lifecycle_entrada_tecnica(p_loja,p_item,p_execucao,p_geracao,p_versao);
end $fn$;
create function nano_lifecycle_interno.nano_lifecycle_liberar_produtor(p_loja uuid,p_item uuid,p_execucao uuid,p_geracao bigint,p_versao integer)
returns boolean language plpgsql security definer set search_path='' set nano.consumer_loja='' as $fn$
begin
 perform set_config('nano.consumer_loja',coalesce(p_loja::text,''),true);
 if not nano_lifecycle_interno.produtor_autorizado(p_loja) then return false; end if;
 perform 1 from public.nano_lifecycle_checkpoint where loja_id=p_loja for update;
 if not found or not exists(select 1 from public.pipeline_itens where loja_id=p_loja and id=p_item and nano_execucao=p_execucao and nano_geracao=p_geracao and versao=p_versao and nano_produtor=session_user) then return false; end if;
 return nano_lifecycle_interno.nano_lifecycle_liberar_item(p_loja,p_item,p_execucao,p_geracao,p_versao);
end $fn$;
alter function nano_lifecycle_interno.nano_lifecycle_reservar_produtor(uuid,uuid,uuid,integer) owner to nano_lifecycle_consumidor;
revoke all on function nano_lifecycle_interno.nano_lifecycle_reservar_produtor(uuid,uuid,uuid,integer) from public,anon,authenticated,service_role,nano_lifecycle_produtor;
grant execute on function nano_lifecycle_interno.nano_lifecycle_reservar_produtor(uuid,uuid,uuid,integer) to nano_lifecycle_produtor;
alter function nano_lifecycle_interno.nano_lifecycle_entrada_produtor(uuid,uuid,uuid,bigint,integer) owner to nano_lifecycle_consumidor;
revoke all on function nano_lifecycle_interno.nano_lifecycle_entrada_produtor(uuid,uuid,uuid,bigint,integer) from public,anon,authenticated,service_role,nano_lifecycle_produtor;
grant execute on function nano_lifecycle_interno.nano_lifecycle_entrada_produtor(uuid,uuid,uuid,bigint,integer) to nano_lifecycle_produtor;
alter function nano_lifecycle_interno.nano_lifecycle_liberar_produtor(uuid,uuid,uuid,bigint,integer) owner to nano_lifecycle_consumidor;
revoke all on function nano_lifecycle_interno.nano_lifecycle_liberar_produtor(uuid,uuid,uuid,bigint,integer) from public,anon,authenticated,service_role,nano_lifecycle_produtor;
grant execute on function nano_lifecycle_interno.nano_lifecycle_liberar_produtor(uuid,uuid,uuid,bigint,integer) to nano_lifecycle_produtor;
revoke create on schema nano_lifecycle_interno from nano_lifecycle_consumidor;
commit;
