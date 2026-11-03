-- Reversão do Contexto Vivo (tabela efêmera, sem dado permanente). Rode no SQL Editor, ref dsfzhsrudriqkumtlqwj.
begin;
drop table if exists public.contexto_sessoes;
delete from supabase_migrations.schema_migrations where version = '20261103000003';
commit;
