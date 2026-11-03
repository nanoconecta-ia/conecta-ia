-- Reversão de 20261103000004_produto_imagens_arquivo. Roda no SQL Editor (ref dsfzhsrudriqkumtlqwj).
-- Guarda: só reverte se NÃO houver arquivo importado nem objeto no bucket (senão perderia a prova das imagens).
begin;
do $$ begin
  if exists (select 1 from public.produto_imagens where arquivo_original_path is not null or arquivo_original_sha256 is not null or arquivo_tratado_path is not null) then
    raise exception 'há imagens importadas: reversão bloqueada (apague-as conscientemente antes)'; end if;
end $$;
drop index if exists public.produto_imagens_sha_unico;
alter table public.produto_imagens drop constraint if exists produto_imagens_caminho_da_loja;
alter table public.produto_imagens drop column if exists importada_de, drop column if exists arquivo_original_path, drop column if exists arquivo_original_sha256,
  drop column if exists arquivo_original_bytes, drop column if exists arquivo_original_mime, drop column if exists arquivo_tratado_path, drop column if exists arquivo_tratado_sha256, drop column if exists evidencias;
delete from storage.buckets where id = 'produto-imagens';
delete from supabase_migrations.schema_migrations where version = '20261103000004';
commit;
