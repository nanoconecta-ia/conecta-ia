-- MINUTA exclusiva do PostgreSQL descartável. Catálogo documental privado.
begin;
create table nano_lifecycle_interno.fontes_documentais(
 loja_id uuid not null, id text not null check(length(btrim(id)) between 1 and 128),
 tipo text not null check(tipo in ('catalogo_fabricante','manual_montadora','catalogo_distribuidor')),
 emissor text not null check(length(btrim(emissor)) between 1 and 256),
 autorizada boolean not null default false,
 primary key(loja_id,id)
);
create table nano_lifecycle_interno.documentos_tecnicos(
 loja_id uuid not null,id text not null check(length(btrim(id)) between 1 and 128),
 fonte_id text not null,conteudo text not null check(octet_length(conteudo) between 1 and 1048576 and conteudo=btrim(conteudo)),
 sha256 text not null check(sha256 ~ '^[0-9a-f]{64}$' and sha256=encode(pg_catalog.sha256(convert_to(conteudo,'UTF8')),'hex')),
 consultado_em timestamptz not null,
 referencia text not null check(length(btrim(referencia)) between 1 and 2048),
 primary key(loja_id,id),
 foreign key(loja_id,fonte_id) references nano_lifecycle_interno.fontes_documentais(loja_id,id)
);
alter table nano_lifecycle_interno.fontes_documentais enable row level security;
alter table nano_lifecycle_interno.documentos_tecnicos enable row level security;
revoke all on nano_lifecycle_interno.fontes_documentais,nano_lifecycle_interno.documentos_tecnicos from public,anon,authenticated,service_role,nano_lifecycle_consumidor,nano_lifecycle_produtor,nano_lifecycle_auditoria,nano_lifecycle_auditor_leitor;
grant select on nano_lifecycle_interno.fontes_documentais,nano_lifecycle_interno.documentos_tecnicos to nano_lifecycle_auditor_leitor;
create policy nano_documental_ler on nano_lifecycle_interno.fontes_documentais for select to nano_lifecycle_auditor_leitor using(exists(select 1 from nano_lifecycle_interno.auditoria_escopos a where a.login_db=session_user and a.loja_id=fontes_documentais.loja_id and a.habilitado));
create policy nano_documental_restrito on nano_lifecycle_interno.fontes_documentais as restrictive for all to nano_lifecycle_auditor_leitor using(exists(select 1 from nano_lifecycle_interno.auditoria_escopos a where a.login_db=session_user and a.loja_id=fontes_documentais.loja_id and a.habilitado)) with check(false);
create policy nano_documental_ler on nano_lifecycle_interno.documentos_tecnicos for select to nano_lifecycle_auditor_leitor using(exists(select 1 from nano_lifecycle_interno.auditoria_escopos a where a.login_db=session_user and a.loja_id=documentos_tecnicos.loja_id and a.habilitado));
create policy nano_documental_restrito on nano_lifecycle_interno.documentos_tecnicos as restrictive for all to nano_lifecycle_auditor_leitor using(exists(select 1 from nano_lifecycle_interno.auditoria_escopos a where a.login_db=session_user and a.loja_id=documentos_tecnicos.loja_id and a.habilitado)) with check(false);
-- PostgreSQL exige IMMUTABLE em coluna gerada; convert_to é STABLE.
-- Calcula no INSERT, sem aceitar hash divergente enviado pelo cliente.
create function nano_lifecycle_interno.calcular_hash_documento() returns trigger
language plpgsql security invoker set search_path='' as $fn$
declare h text;
begin
 h:=encode(pg_catalog.sha256(convert_to(new.conteudo,'UTF8')),'hex');
 if new.sha256 is not null and new.sha256 is distinct from h then raise exception 'hash documental divergente' using errcode='23514'; end if;
 new.sha256:=h;
 return new;
end $fn$;
revoke all on function nano_lifecycle_interno.calcular_hash_documento() from public,anon,authenticated,service_role;
create trigger nano_documento_hash before insert on nano_lifecycle_interno.documentos_tecnicos for each row execute function nano_lifecycle_interno.calcular_hash_documento();
-- A versão de um documento é imutável; uma revisão requer um novo ID.
create function nano_lifecycle_interno.proteger_documento_tecnico() returns trigger
language plpgsql security invoker set search_path='' as $fn$
begin
 raise exception 'documento técnico histórico imutável' using errcode='42501';
end $fn$;
revoke all on function nano_lifecycle_interno.proteger_documento_tecnico() from public,anon,authenticated,service_role;
create trigger nano_documento_imutavel before update or delete on nano_lifecycle_interno.documentos_tecnicos for each row execute function nano_lifecycle_interno.proteger_documento_tecnico();
create trigger nano_documento_truncate before truncate on nano_lifecycle_interno.documentos_tecnicos for each statement execute function nano_lifecycle_interno.proteger_documento_tecnico();
grant create on schema nano_lifecycle_interno to nano_lifecycle_auditor_leitor;
create function nano_lifecycle_interno.auditor_documental_valido() returns boolean
language sql stable security invoker set search_path='' as $fn$
 select pg_has_role(session_user,'nano_lifecycle_auditoria','MEMBER')
 and not pg_has_role(session_user,'nano_lifecycle_produtor','MEMBER')
 and not pg_has_role(session_user,'service_role','MEMBER')
 and not pg_has_role(session_user,'nano_lifecycle_consumidor','MEMBER')
 and not pg_has_role(session_user,'nano_lifecycle_auditor_leitor','MEMBER')
 and exists(select 1 from pg_catalog.pg_roles where rolname=session_user and rolcanlogin and not rolsuper and not rolbypassrls and not rolcreaterole)
$fn$;
alter function nano_lifecycle_interno.auditor_documental_valido() owner to nano_lifecycle_auditor_leitor;
revoke all on function nano_lifecycle_interno.auditor_documental_valido() from public,anon,authenticated,service_role,nano_lifecycle_produtor,nano_lifecycle_auditoria;
create function nano_lifecycle_interno.nano_lifecycle_ler_fonte(p_loja uuid,p_id text)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare f nano_lifecycle_interno.fontes_documentais;
begin
 if not nano_lifecycle_interno.auditor_documental_valido() then return null; end if;
 select * into f from nano_lifecycle_interno.fontes_documentais where loja_id=p_loja and id=p_id and autorizada;
 if not found then return null; end if;
 return jsonb_build_object('id',f.id,'loja',f.loja_id,'tipo',f.tipo,'emissor',f.emissor,'autorizada',true);
end $fn$;
create function nano_lifecycle_interno.nano_lifecycle_ler_documento(p_loja uuid,p_id text)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare d nano_lifecycle_interno.documentos_tecnicos;
begin
 if not nano_lifecycle_interno.auditor_documental_valido() then return null; end if;
 select x.* into d from nano_lifecycle_interno.documentos_tecnicos x join nano_lifecycle_interno.fontes_documentais f on f.loja_id=x.loja_id and f.id=x.fonte_id
 where x.loja_id=p_loja and x.id=p_id and f.autorizada and x.consultado_em<=clock_timestamp();
 if not found then return null; end if;
 return jsonb_build_object('id',d.id,'loja',d.loja_id,'fonteId',d.fonte_id,'conteudo',d.conteudo,'sha256',d.sha256,'consultadoEm',to_char(d.consultado_em at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'));
end $fn$;
alter function nano_lifecycle_interno.nano_lifecycle_ler_fonte(uuid,text) owner to nano_lifecycle_auditor_leitor;
revoke all on function nano_lifecycle_interno.nano_lifecycle_ler_fonte(uuid,text) from public,anon,authenticated,service_role,nano_lifecycle_produtor,nano_lifecycle_auditoria;
grant execute on function nano_lifecycle_interno.nano_lifecycle_ler_fonte(uuid,text) to nano_lifecycle_auditoria;
alter function nano_lifecycle_interno.nano_lifecycle_ler_documento(uuid,text) owner to nano_lifecycle_auditor_leitor;
revoke all on function nano_lifecycle_interno.nano_lifecycle_ler_documento(uuid,text) from public,anon,authenticated,service_role,nano_lifecycle_produtor,nano_lifecycle_auditoria;
grant execute on function nano_lifecycle_interno.nano_lifecycle_ler_documento(uuid,text) to nano_lifecycle_auditoria;
revoke create on schema nano_lifecycle_interno from nano_lifecycle_auditor_leitor;
commit;
