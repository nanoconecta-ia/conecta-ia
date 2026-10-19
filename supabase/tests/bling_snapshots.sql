-- Backup do Bling (dados FICTÍCIOS); desfaz tudo no fim.
begin;
create or replace function public.afirma(ok boolean, msg text) returns void language plpgsql as
$$ begin if ok is distinct from true then raise exception 'FALHOU: %', msg; end if; raise notice 'ok: %', msg; end $$;
insert into public.lojas (id, nome, slug) values ('d9000000-0000-0000-0000-0000000000a1', 'Loja BK', 'bk-a'), ('d9000000-0000-0000-0000-0000000000a2', 'Outra BK', 'bk-b');
insert into public.usuarios_loja (loja_id, user_id, papel) values
  ('d9000000-0000-0000-0000-0000000000a1', '51111111-1111-1111-1111-111111111111', 'lojista'),
  ('d9000000-0000-0000-0000-0000000000a1', '52222222-2222-2222-2222-222222222222', 'editor'),
  ('d9000000-0000-0000-0000-0000000000a2', '53333333-3333-3333-3333-333333333333', 'lojista');

-- fluxo completo como o serviço (postgres/service_role)
create temp table t_snap (id uuid);
insert into t_snap select public.bling_snapshot_iniciar('d9000000-0000-0000-0000-0000000000a1', 'manual', '51111111-1111-1111-1111-111111111111');
select public.afirma((select status from public.bling_snapshots where id = (select id from t_snap)) = 'em_andamento', 'snapshot nasce em andamento');
select public.afirma((public.bling_snapshot_gravar((select id from t_snap),
  '[{"bling_id":"1","codigo":"BK-1","json_produto":{"id":1,"nome":"Peça 1","preco":10},"json_vinculos":[{"precoCompra":4}],"hash":"h1"},{"bling_id":"2","codigo":"BK-2","json_produto":{"id":2,"nome":"Peça 2"},"hash":"h2"}]',
  '[{"bling_id":"10","nome":"Motor","pai_bling_id":null}]', '[{"bling_id":"90","nome":"Fornecedor X","documento":"11111111000111"}]')->>'produtos')::int = 2, 'grava 2 produtos');
select public.afirma((public.bling_snapshot_gravar((select id from t_snap),
  '[{"bling_id":"1","codigo":"BK-1","json_produto":{"id":1,"nome":"Peça 1 v2"},"hash":"h1b"}]', '[]', '[]')->>'produtos')::int = 1, 'regravar o mesmo produto substitui (idempotente)');
select public.afirma((select count(*) from public.bling_snapshot_produtos where snapshot_id = (select id from t_snap)) = 2, 'continuam 2 produtos (sem duplicar)');
select public.afirma((select hash from public.bling_snapshot_produtos where snapshot_id = (select id from t_snap) and bling_id = '1') = 'h1b', 'o conteúdo novo substituiu o antigo');
select public.afirma((public.bling_snapshot_concluir((select id from t_snap), 'completo')->>'produtos')::int = 2, 'conclui com contagem real do banco');
select public.afirma((select status from public.bling_snapshots where id = (select id from t_snap)) = 'completo', 'status completo');
select public.afirma(exists (select 1 from public.auditoria where acao = 'bling.backup.completo' and loja_id = 'd9000000-0000-0000-0000-0000000000a1'), 'conclusão fica na auditoria');
do $$ begin begin perform public.bling_snapshot_gravar((select id from t_snap), '[]', '[]', '[]'); raise exception 'deveria recusar'; exception when sqlstate '55000' then null; end; end $$;
select public.afirma(true, 'não grava em snapshot já encerrado');
do $$ begin begin perform public.bling_snapshot_concluir((select id from t_snap), 'completo'); raise exception 'deveria recusar'; exception when sqlstate '55000' then null; end; end $$;
select public.afirma(true, 'não conclui duas vezes');
do $$ begin begin perform public.bling_snapshot_iniciar('d9000000-0000-0000-0000-0000000000a1', 'qualquer'); raise exception 'deveria recusar'; exception when sqlstate '22023' then null; end; end $$;
select public.afirma(true, 'origem inválida é recusada');

-- poda: mantém os N mais recentes e sempre o último completo
insert into public.bling_snapshots (loja_id, origem, status, criado_em) values
  ('d9000000-0000-0000-0000-0000000000a1', 'diario', 'falhou', now() - interval '5 days'),
  ('d9000000-0000-0000-0000-0000000000a1', 'diario', 'falhou', now() - interval '4 days'),
  ('d9000000-0000-0000-0000-0000000000a1', 'diario', 'falhou', now() - interval '3 days');
select public.afirma(public.bling_snapshot_podar('d9000000-0000-0000-0000-0000000000a1', 1) = 3, 'poda os antigos');
select public.afirma(exists (select 1 from public.bling_snapshots where id = (select id from t_snap)), 'o último completo nunca é podado');

-- isolamento por papel e por loja
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"51111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select public.afirma((select count(*) from public.bling_snapshot_produtos) = 2, 'lojista da loja lê o backup');
select set_config('request.jwt.claims', '{"sub":"52222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select public.afirma((select count(*) from public.bling_snapshot_produtos) = 0, 'editor NÃO lê (tem custo e fornecedor)');
select set_config('request.jwt.claims', '{"sub":"53333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
select public.afirma((select count(*) from public.bling_snapshots) = 0, 'lojista de outra loja não vê (isolamento)');
select set_config('request.jwt.claims', '{"sub":"51111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
do $$ begin begin perform public.bling_snapshot_iniciar('d9000000-0000-0000-0000-0000000000a1', 'manual'); raise exception 'deveria recusar'; exception when insufficient_privilege then null; end; end $$;
select public.afirma(true, 'o navegador não chama as funções do backup (só o servidor)');
do $$ begin begin insert into public.bling_snapshots (loja_id, origem) values ('d9000000-0000-0000-0000-0000000000a1', 'manual'); raise exception 'deveria recusar'; exception when insufficient_privilege then null; end; end $$;
select public.afirma(true, 'o navegador não escreve nas tabelas do backup');
reset role;
set local role anon;
do $$ begin begin perform count(*) from public.bling_snapshot_produtos; raise exception 'deveria recusar'; exception when insufficient_privilege then null; end; end $$;
select public.afirma(true, 'visitante sem login não alcança o backup');
reset role;
rollback;
