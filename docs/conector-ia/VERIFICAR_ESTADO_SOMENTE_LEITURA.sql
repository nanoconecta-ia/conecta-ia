-- SOMENTE LEITURA. Mostra quais das três migrações já estão aplicadas no projeto conecta-ia. Não altera nada.
select
  (select count(*) from information_schema.columns where table_schema='public' and table_name='pair_sessoes' and column_name='recurso') = 1 as oauth_recurso_aplicada,
  (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='oauth_validar_para_recurso') = 1 as oauth_funcao_nova,
  (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('oauth_pair_iniciar','agente_chamada_registrar')) as oauth_funcoes_antigas_esperado_2,
  to_regclass('public.contexto_sessoes') is not null as contexto_sessoes_aplicada,
  (select relrowsecurity from pg_class where oid = to_regclass('public.contexto_sessoes')) as contexto_rls_ligada,
  (select count(*) from information_schema.columns where table_schema='public' and table_name='produto_imagens' and column_name in ('importada_de','arquivo_original_path','arquivo_original_sha256','arquivo_original_bytes','arquivo_original_mime','arquivo_tratado_path','arquivo_tratado_sha256','evidencias')) as imagens_colunas_esperado_8,
  (select public from storage.buckets where id='produto-imagens') as bucket_imagens_publico_esperado_false,
  (select count(*) from public.pair_sessoes where revogado_em is null) as sessoes_pair_nao_revogadas,
  (select count(*) from public.produto_imagens) as imagens_total;
