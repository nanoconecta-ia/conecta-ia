-- Reversão de contexto_registrar (só remove a função; a tabela contexto_sessoes fica).
begin;
drop function if exists public.contexto_registrar(uuid, uuid, text, text, uuid, uuid[], integer);
delete from supabase_migrations.schema_migrations where version = '20261103000005';
commit;
