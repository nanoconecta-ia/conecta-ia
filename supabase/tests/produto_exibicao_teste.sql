-- Produto de teste da vitrine (dados FICTÍCIOS); desfaz tudo no fim.
begin;
create or replace function public.afirma(ok boolean, msg text) returns void language plpgsql as
$$ begin if ok is distinct from true then raise exception 'FALHOU: %', msg; end if; raise notice 'ok: %', msg; end $$;
insert into public.lojas (id, nome, slug, ambiente) values
  ('c9000000-0000-0000-0000-0000000000e1', 'Loja ET', 'et-a', 'teste'),
  ('c9000000-0000-0000-0000-0000000000e2', 'Outra ET', 'et-b', 'teste'),
  ('c9000000-0000-0000-0000-0000000000e3', 'Loja ET produção', 'et-c', 'teste');
-- loja fictícia em produção: pula só o gatilho que exige política/DNS/SSL (dado descartável, desfeito no rollback)
set local session_replication_role = replica;
update public.lojas set ambiente = 'producao' where id = 'c9000000-0000-0000-0000-0000000000e3';
set local session_replication_role = origin;
insert into public.usuarios_loja (loja_id, user_id, papel) values
  ('c9000000-0000-0000-0000-0000000000e1', '51111111-1111-1111-1111-111111111111', 'lojista'),
  ('c9000000-0000-0000-0000-0000000000e1', '52222222-2222-2222-2222-222222222222', 'editor'),
  ('c9000000-0000-0000-0000-0000000000e2', '53333333-3333-3333-3333-333333333333', 'lojista'),
  ('c9000000-0000-0000-0000-0000000000e3', '54444444-4444-4444-4444-444444444444', 'lojista');
insert into public.produtos (id, loja_id, bling_id, sku, nome, preco, estoque, publicado) values
  ('c8000000-0000-0000-0000-0000000000e1', 'c9000000-0000-0000-0000-0000000000e1', 'et1', 'ET-1', 'Peça de teste', 100, 5, true),
  ('c8000000-0000-0000-0000-0000000000e2', 'c9000000-0000-0000-0000-0000000000e1', 'et2', 'ET-2', 'Peça normal', 200, 3, true),
  ('c8000000-0000-0000-0000-0000000000e3', 'c9000000-0000-0000-0000-0000000000e3', 'et3', 'ET-3', 'Peça de loja em produção', 300, 1, true);
select public.afirma(not (select exibicao_teste from public.produtos where id = 'c8000000-0000-0000-0000-0000000000e1'), 'padrão: produto NÃO é de teste');
set local role authenticated;

-- sem login
select set_config('request.jwt.claims', '', true);
do $$ begin begin perform public.produto_exibicao_teste('c8000000-0000-0000-0000-0000000000e1', true); raise exception 'deveria recusar'; exception when sqlstate '28000' then null; end; end $$;
select public.afirma(true, 'sem login é recusado');

-- editor não mexe
select set_config('request.jwt.claims', '{"sub":"52222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
do $$ begin begin perform public.produto_exibicao_teste('c8000000-0000-0000-0000-0000000000e1', true); raise exception 'deveria recusar'; exception when insufficient_privilege then null; end; end $$;
select public.afirma(true, 'editor não liga nem desliga');

-- lojista de OUTRA loja não alcança o produto
select set_config('request.jwt.claims', '{"sub":"53333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
do $$ begin begin perform public.produto_exibicao_teste('c8000000-0000-0000-0000-0000000000e1', true); raise exception 'deveria recusar'; exception when insufficient_privilege then null; end; end $$;
select public.afirma(true, 'lojista de outra loja é recusado (isolamento)');

-- lojista da loja de produção: não liga (só loja em ambiente de teste)
select set_config('request.jwt.claims', '{"sub":"54444444-4444-4444-4444-444444444444","role":"authenticated"}', true);
select public.afirma(not (public.produto_exibicao_teste('c8000000-0000-0000-0000-0000000000e3', true)->>'ok')::boolean, 'loja em produção não liga produto de teste');

-- lojista da loja de teste liga
select set_config('request.jwt.claims', '{"sub":"51111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select public.afirma((public.produto_exibicao_teste('c8000000-0000-0000-0000-0000000000e1', true)->>'ok')::boolean, 'lojista liga o produto de teste');
reset role;
select public.afirma((select exibicao_teste from public.produtos where id = 'c8000000-0000-0000-0000-0000000000e1'), 'ficou marcado no banco');
select public.afirma(exists (select 1 from public.auditoria where acao = 'exibicao_teste_ligar' and loja_id = 'c9000000-0000-0000-0000-0000000000e1'), 'ligar fica na auditoria');
select public.afirma((select preco from public.produtos where id = 'c8000000-0000-0000-0000-0000000000e1') = 100, 'o preço do Bling no espelho NÃO foi alterado');

-- a chave pública (anon) não lê o produto de teste pela API REST, mas lê o produto normal publicado
set local role anon;
select public.afirma(not exists (select 1 from public.produtos where id = 'c8000000-0000-0000-0000-0000000000e1'), 'anon NÃO enxerga o produto de teste (nem preço nem estoque)');
select public.afirma(exists (select 1 from public.produtos where id = 'c8000000-0000-0000-0000-0000000000e2'), 'anon continua vendo produto normal publicado');
reset role;

-- desligar
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"51111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select public.afirma((public.produto_exibicao_teste('c8000000-0000-0000-0000-0000000000e1', false)->>'ok')::boolean, 'lojista desliga o produto de teste');
reset role;
select public.afirma(not (select exibicao_teste from public.produtos where id = 'c8000000-0000-0000-0000-0000000000e1'), 'ficou desmarcado no banco');
select public.afirma(exists (select 1 from public.auditoria where acao = 'exibicao_teste_desligar' and loja_id = 'c9000000-0000-0000-0000-0000000000e1'), 'desligar fica na auditoria');
rollback;
