-- MINUTA exclusivamente CI descartável. Leitura histórica não autoriza execução.
begin;
grant create on schema nano_lifecycle_interno to nano_lifecycle_consumidor;
create function nano_lifecycle_interno.nano_lifecycle_recibo_engenharia(p_loja uuid,p_item uuid,p_execucao uuid,p_geracao bigint,p_versao integer)
returns jsonb language plpgsql security definer set search_path='' set nano.consumer_loja='' as $fn$
declare e nano_lifecycle_interno.resultados_engenharia;
begin
 perform set_config('nano.consumer_loja',coalesce(p_loja::text,''),true);
 select * into e from nano_lifecycle_interno.resultados_engenharia where loja_id=p_loja and item_id=p_item and execucao=p_execucao and geracao=p_geracao and versao=p_versao;
 if not found then return jsonb_build_object('estado','recibo_inexistente'); end if;
 if e.homologada or e.hash_entrada is distinct from encode(sha256(convert_to(e.entrada_snapshot::text,'UTF8')),'hex') or e.hash_extracao is distinct from encode(sha256(convert_to(e.extracao_candidata::text,'UTF8')),'hex') then return jsonb_build_object('estado','integridade_divergente'); end if;
 return jsonb_build_object('estado','recuperado','loja_id',e.loja_id,'item_id',e.item_id,'execucao',e.execucao,'geracao',e.geracao,'versao',e.versao,'hash_entrada',e.hash_entrada,'hash_extracao',e.hash_extracao,'homologada',false);
end $fn$;
alter function nano_lifecycle_interno.nano_lifecycle_recibo_engenharia(uuid,uuid,uuid,bigint,integer) owner to nano_lifecycle_consumidor;
revoke all on function nano_lifecycle_interno.nano_lifecycle_recibo_engenharia(uuid,uuid,uuid,bigint,integer) from public,anon,authenticated,service_role;
grant execute on function nano_lifecycle_interno.nano_lifecycle_recibo_engenharia(uuid,uuid,uuid,bigint,integer) to service_role;
create function public.nano_lifecycle_recibo_engenharia(p_loja uuid,p_item uuid,p_execucao uuid,p_geracao bigint,p_versao integer)
returns jsonb language sql security invoker set search_path='' as $fn$
 select nano_lifecycle_interno.nano_lifecycle_recibo_engenharia(p_loja,p_item,p_execucao,p_geracao,p_versao)
$fn$;
revoke all on function public.nano_lifecycle_recibo_engenharia(uuid,uuid,uuid,bigint,integer) from public,anon,authenticated,service_role;
grant execute on function public.nano_lifecycle_recibo_engenharia(uuid,uuid,uuid,bigint,integer) to service_role;
revoke create on schema nano_lifecycle_interno from nano_lifecycle_consumidor;
-- Autoridade independente: ainda sem login provisionado nem exposição HTTP.
create role nano_lifecycle_auditor_leitor nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
create role nano_lifecycle_auditoria nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
grant usage on schema nano_lifecycle_interno to nano_lifecycle_auditor_leitor,nano_lifecycle_auditoria;
grant create on schema nano_lifecycle_interno to nano_lifecycle_auditor_leitor;
create table nano_lifecycle_interno.auditoria_escopos(
 login_db name not null, loja_id uuid not null, habilitado boolean not null default false,
 primary key(login_db,loja_id)
);
alter table nano_lifecycle_interno.auditoria_escopos enable row level security;
revoke all on nano_lifecycle_interno.auditoria_escopos from public,anon,authenticated,service_role,nano_lifecycle_consumidor,nano_lifecycle_auditoria,nano_lifecycle_auditor_leitor;
grant select on nano_lifecycle_interno.auditoria_escopos to nano_lifecycle_auditor_leitor;
create policy nano_auditor_escopo_leitura on nano_lifecycle_interno.auditoria_escopos for select to nano_lifecycle_auditor_leitor using(login_db=session_user and habilitado);
create policy nano_auditor_escopo_restrito on nano_lifecycle_interno.auditoria_escopos as restrictive for all to nano_lifecycle_auditor_leitor using(login_db=session_user and habilitado) with check(false);
grant select on nano_lifecycle_interno.resultados_engenharia to nano_lifecycle_auditor_leitor;
create policy nano_auditor_ler_evidencia on nano_lifecycle_interno.resultados_engenharia for select to nano_lifecycle_auditor_leitor using(exists(select 1 from nano_lifecycle_interno.auditoria_escopos a where a.login_db=session_user and a.loja_id=resultados_engenharia.loja_id and a.habilitado));
create policy nano_auditor_evidencia_restrita on nano_lifecycle_interno.resultados_engenharia as restrictive for all to nano_lifecycle_auditor_leitor using(exists(select 1 from nano_lifecycle_interno.auditoria_escopos a where a.login_db=session_user and a.loja_id=resultados_engenharia.loja_id and a.habilitado)) with check(false);
create function nano_lifecycle_interno.nano_lifecycle_ler_evidencia(p_loja uuid,p_item uuid,p_geracao bigint)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare e nano_lifecycle_interno.resultados_engenharia;
begin
 select * into e from nano_lifecycle_interno.resultados_engenharia where loja_id=p_loja and item_id=p_item and geracao=p_geracao;
 if not found then return jsonb_build_object('estado','evidencia_indisponivel'); end if;
 if e.homologada or e.hash_entrada is distinct from encode(sha256(convert_to(e.entrada_snapshot::text,'UTF8')),'hex') or e.hash_extracao is distinct from encode(sha256(convert_to(e.extracao_candidata::text,'UTF8')),'hex') then return jsonb_build_object('estado','integridade_divergente'); end if;
 return jsonb_build_object('estado','evidencia_historica','loja_id',e.loja_id,'item_id',e.item_id,'execucao',e.execucao,'geracao',e.geracao,'versao',e.versao,'produto_id',e.produto_id,'revisao',e.revisao,'checkpoint',e.checkpoint,'entrada_snapshot',e.entrada_snapshot,'extracao_candidata',e.extracao_candidata,'hash_entrada',e.hash_entrada,'hash_extracao',e.hash_extracao,'extrator',e.extrator,'homologada',false);
end $fn$;
alter function nano_lifecycle_interno.nano_lifecycle_ler_evidencia(uuid,uuid,bigint) owner to nano_lifecycle_auditor_leitor;
revoke all on function nano_lifecycle_interno.nano_lifecycle_ler_evidencia(uuid,uuid,bigint) from public,anon,authenticated,service_role,nano_lifecycle_consumidor,nano_lifecycle_auditoria;
grant execute on function nano_lifecycle_interno.nano_lifecycle_ler_evidencia(uuid,uuid,bigint) to nano_lifecycle_auditoria;
revoke create on schema nano_lifecycle_interno from nano_lifecycle_auditor_leitor;
commit;
