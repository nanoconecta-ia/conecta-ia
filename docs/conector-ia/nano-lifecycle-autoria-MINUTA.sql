-- MINUTA exclusivamente CI descartável. Autoria na mesma transação da primeira gravação.
begin;
create role nano_lifecycle_produtor nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
grant usage on schema nano_lifecycle_interno to nano_lifecycle_produtor;
create table nano_lifecycle_interno.produtor_escopos(
 login_db name not null, loja_id uuid not null, habilitado boolean not null default false,
 primary key(login_db,loja_id)
);
create table nano_lifecycle_interno.autorias_engenharia(
 loja_id uuid not null,item_id uuid not null,geracao bigint not null,execucao uuid not null,versao integer not null,
 produtor name not null,hash_entrada text not null,hash_extracao text not null,
 registrado_em timestamptz not null default clock_timestamp(),
 primary key(loja_id,item_id,geracao),
 foreign key(loja_id,item_id,geracao) references nano_lifecycle_interno.resultados_engenharia(loja_id,item_id,geracao)
);
alter table nano_lifecycle_interno.produtor_escopos enable row level security;
alter table nano_lifecycle_interno.autorias_engenharia enable row level security;
revoke all on nano_lifecycle_interno.produtor_escopos,nano_lifecycle_interno.autorias_engenharia from public,anon,authenticated,service_role,nano_lifecycle_produtor,nano_lifecycle_consumidor,nano_lifecycle_auditoria,nano_lifecycle_auditor_leitor;
grant select on nano_lifecycle_interno.produtor_escopos to nano_lifecycle_consumidor;
create policy nano_produtor_escopo on nano_lifecycle_interno.produtor_escopos for select to nano_lifecycle_consumidor using(login_db=session_user and habilitado);
create policy nano_produtor_escopo_restrito on nano_lifecycle_interno.produtor_escopos as restrictive for all to nano_lifecycle_consumidor using(login_db=session_user and habilitado) with check(false);
grant select,insert on nano_lifecycle_interno.autorias_engenharia to nano_lifecycle_consumidor;
create policy nano_autoria_ler on nano_lifecycle_interno.autorias_engenharia for select to nano_lifecycle_consumidor using(loja_id::text=current_setting('nano.consumer_loja',true));
create policy nano_autoria_inserir on nano_lifecycle_interno.autorias_engenharia for insert to nano_lifecycle_consumidor with check(produtor=session_user and exists(select 1 from nano_lifecycle_interno.produtor_escopos p where p.login_db=session_user and p.loja_id=autorias_engenharia.loja_id and p.habilitado));
create policy nano_autoria_escopo on nano_lifecycle_interno.autorias_engenharia as restrictive for all to nano_lifecycle_consumidor using(loja_id::text=current_setting('nano.consumer_loja',true)) with check(loja_id::text=current_setting('nano.consumer_loja',true));
grant create on schema nano_lifecycle_interno to nano_lifecycle_consumidor;
create function nano_lifecycle_interno.nano_lifecycle_persistir_com_autoria(p_loja uuid,p_item uuid,p_execucao uuid,p_geracao bigint,p_versao integer,p_entrada jsonb,p_extracao jsonb)
returns jsonb language plpgsql security definer set search_path='' set nano.consumer_loja='' as $fn$
declare r jsonb; a nano_lifecycle_interno.autorias_engenharia;
begin
 perform set_config('nano.consumer_loja',coalesce(p_loja::text,''),true);
 if not pg_has_role(session_user,'nano_lifecycle_produtor','MEMBER') or pg_has_role(session_user,'service_role','MEMBER') or pg_has_role(session_user,'nano_lifecycle_auditoria','MEMBER') or pg_has_role(session_user,'nano_lifecycle_consumidor','MEMBER') or pg_has_role(session_user,'nano_lifecycle_auditor_leitor','MEMBER') or exists(select 1 from pg_catalog.pg_roles where rolname=session_user and (not rolcanlogin or rolsuper or rolbypassrls or rolcreaterole)) or not exists(select 1 from nano_lifecycle_interno.produtor_escopos where login_db=session_user and loja_id=p_loja and habilitado) then return jsonb_build_object('estado','produtor_nao_autorizado'); end if;
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
alter function nano_lifecycle_interno.nano_lifecycle_persistir_com_autoria(uuid,uuid,uuid,bigint,integer,jsonb,jsonb) owner to nano_lifecycle_consumidor;
revoke all on function nano_lifecycle_interno.nano_lifecycle_persistir_com_autoria(uuid,uuid,uuid,bigint,integer,jsonb,jsonb) from public,anon,authenticated,service_role,nano_lifecycle_auditoria,nano_lifecycle_produtor;
grant execute on function nano_lifecycle_interno.nano_lifecycle_persistir_com_autoria(uuid,uuid,uuid,bigint,integer,jsonb,jsonb) to nano_lifecycle_produtor;
revoke create on schema nano_lifecycle_interno from nano_lifecycle_consumidor;
grant select on nano_lifecycle_interno.autorias_engenharia to nano_lifecycle_auditor_leitor;
create policy nano_autoria_auditor on nano_lifecycle_interno.autorias_engenharia for select to nano_lifecycle_auditor_leitor using(produtor<>session_user and exists(select 1 from nano_lifecycle_interno.auditoria_escopos a where a.login_db=session_user and a.loja_id=autorias_engenharia.loja_id and a.habilitado));
create policy nano_autoria_auditor_restrito on nano_lifecycle_interno.autorias_engenharia as restrictive for all to nano_lifecycle_auditor_leitor using(produtor<>session_user and exists(select 1 from nano_lifecycle_interno.auditoria_escopos a where a.login_db=session_user and a.loja_id=autorias_engenharia.loja_id and a.habilitado)) with check(false);
grant create on schema nano_lifecycle_interno to nano_lifecycle_auditor_leitor;
create function nano_lifecycle_interno.nano_lifecycle_ler_autoria(p_loja uuid,p_item uuid,p_execucao uuid,p_geracao bigint,p_versao integer)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare a nano_lifecycle_interno.autorias_engenharia;
begin
 if pg_has_role(session_user,'nano_lifecycle_produtor','MEMBER') or pg_has_role(session_user,'service_role','MEMBER') or not pg_has_role(session_user,'nano_lifecycle_auditoria','MEMBER') or exists(select 1 from pg_catalog.pg_roles where rolname=session_user and (not rolcanlogin or rolsuper or rolbypassrls or rolcreaterole)) then return null; end if;
 select x.* into a from nano_lifecycle_interno.autorias_engenharia x join nano_lifecycle_interno.resultados_engenharia e using(loja_id,item_id,geracao)
 where x.loja_id=p_loja and x.item_id=p_item and x.geracao=p_geracao and x.execucao=p_execucao and x.versao=p_versao and e.execucao=x.execucao and e.versao=x.versao and e.hash_entrada=x.hash_entrada and e.hash_extracao=x.hash_extracao and not e.homologada;
 if not found then return null; end if;
 return jsonb_build_object('chave',jsonb_build_object('loja',a.loja_id,'item',a.item_id,'execucao',a.execucao,'geracao',a.geracao,'versao',a.versao),'produtor',a.produtor,'hashEntrada',a.hash_entrada,'hashExtracao',a.hash_extracao);
end $fn$;
alter function nano_lifecycle_interno.nano_lifecycle_ler_autoria(uuid,uuid,uuid,bigint,integer) owner to nano_lifecycle_auditor_leitor;
revoke all on function nano_lifecycle_interno.nano_lifecycle_ler_autoria(uuid,uuid,uuid,bigint,integer) from public,anon,authenticated,service_role,nano_lifecycle_produtor,nano_lifecycle_auditoria;
grant execute on function nano_lifecycle_interno.nano_lifecycle_ler_autoria(uuid,uuid,uuid,bigint,integer) to nano_lifecycle_auditoria;
revoke create on schema nano_lifecycle_interno from nano_lifecycle_auditor_leitor;
commit;
