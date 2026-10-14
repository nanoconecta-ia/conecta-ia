-- No Supabase, objetos novos em public nascem com privilégios amplos para anon/authenticated.
-- Aqui zeramos tudo e concedemos só o que cada papel precisa; a RLS continua valendo por cima.

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all tables in schema private from anon, authenticated;

-- Objetos futuros não herdam acesso automático (cada migração concede o que precisa).
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;

-- A view de domínios é só do servidor.
alter view public.dominios_ativos set (security_invoker = on);

grant select, insert, update, delete on public.lojas, public.loja_dominios, public.usuarios_loja to authenticated; -- limitado pelas policies
grant select on public.bling_conexoes, public.sync_eventos, public.sync_erros to authenticated;
grant select on public.produtos, public.produto_imagens to authenticated, anon;
grant select on public.enriquecimento_tarefas, public.produto_enriquecimento,
  public.enriquecimento_execucoes, public.loja_chaves_ia to authenticated;
-- hash_chave nunca vai para o navegador
grant select (id, loja_id, nome, escopos, ultimo_uso_em, revogada_em, criado_em) on public.loja_mcp_chaves to authenticated;
grant select, insert, update, delete on public.restricoes_plataforma_uf, public.restricoes_loja to authenticated;
grant select on public.auditoria to authenticated;
