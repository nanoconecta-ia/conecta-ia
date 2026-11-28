-- MINUTA CI descartável. Consulta de autorização atual, sem escrita ou exposição de cadastro.
begin;
create role nano_lifecycle_autorizacao_leitor nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
grant usage,create on schema nano_lifecycle_interno to nano_lifecycle_autorizacao_leitor;
grant select on nano_lifecycle_interno.auditoria_escopos to nano_lifecycle_autorizacao_leitor;
create policy nano_autorizacao_consulta on nano_lifecycle_interno.auditoria_escopos for select to nano_lifecycle_autorizacao_leitor using(loja_id::text=current_setting('nano.audit_loja',true));
create policy nano_autorizacao_restrita on nano_lifecycle_interno.auditoria_escopos as restrictive for all to nano_lifecycle_autorizacao_leitor using(loja_id::text=current_setting('nano.audit_loja',true)) with check(false);
-- CAT-135: predicado compartilhado de identidade DB; não autoriza loja ou decisão.
create function nano_lifecycle_interno.nano_catalogo_auditor_vigente(p_login text)
returns boolean language sql stable security invoker set search_path='' as $papel$
 select exists(select 1 from pg_catalog.pg_roles r where r.rolname::text=p_login and octet_length(p_login) between 1 and 63
  and r.rolcanlogin and not r.rolsuper and not r.rolbypassrls and not r.rolcreaterole
  and pg_has_role(r.oid,'nano_lifecycle_auditoria','MEMBER')
  and not pg_has_role(r.oid,'nano_lifecycle_produtor','MEMBER')
  and not pg_has_role(r.oid,'service_role','MEMBER')
  and not pg_has_role(r.oid,'nano_lifecycle_consumidor','MEMBER')
  and not pg_has_role(r.oid,'nano_lifecycle_auditor_leitor','MEMBER')
  and not pg_has_role(r.oid,'nano_lifecycle_autorizacao_leitor','MEMBER'))
$papel$;
revoke all on function nano_lifecycle_interno.nano_catalogo_auditor_vigente(text) from public,anon,authenticated,service_role,nano_lifecycle_produtor,nano_lifecycle_auditoria;
grant execute on function nano_lifecycle_interno.nano_catalogo_auditor_vigente(text) to nano_lifecycle_autorizacao_leitor;
create function nano_lifecycle_interno.nano_lifecycle_verificador_autorizado(p_loja uuid,p_verificador text)
returns boolean language plpgsql security definer set search_path='' set nano.audit_loja='' as $fn$
begin
 if p_loja is null or p_verificador is null or octet_length(p_verificador) not between 1 and 63 then return false; end if;
 perform set_config('nano.audit_loja',p_loja::text,true);
 -- Confirma separadamente o solicitante e o verificador, ambos na mesma loja.
 -- Nome não é convertido para name (evita truncamento silencioso); identidade real vem da sessão.
 return (select count(distinct r.rolname)=case when p_verificador=session_user::text then 1 else 2 end
 from pg_catalog.pg_roles r join nano_lifecycle_interno.auditoria_escopos a on a.login_db=r.rolname
 where a.loja_id=p_loja and a.habilitado
 and r.rolname::text in (session_user::text,p_verificador)
 and nano_lifecycle_interno.nano_catalogo_auditor_vigente(r.rolname::text));
end $fn$;
alter function nano_lifecycle_interno.nano_lifecycle_verificador_autorizado(uuid,text) owner to nano_lifecycle_autorizacao_leitor;
revoke all on function nano_lifecycle_interno.nano_lifecycle_verificador_autorizado(uuid,text) from public,anon,authenticated,service_role,nano_lifecycle_produtor,nano_lifecycle_auditoria;
grant execute on function nano_lifecycle_interno.nano_lifecycle_verificador_autorizado(uuid,text) to nano_lifecycle_auditoria;
revoke create on schema nano_lifecycle_interno from nano_lifecycle_autorizacao_leitor;
commit;
