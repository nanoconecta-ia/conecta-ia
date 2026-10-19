-- Botão mostrar/ocultar produto (dados FICTÍCIOS); desfaz tudo no fim.
begin;
create or replace function public.afirma(ok boolean, msg text) returns void language plpgsql as
$$ begin if ok is distinct from true then raise exception 'FALHOU: %', msg; end if; raise notice 'ok: %', msg; end $$;
insert into public.lojas (id, nome, slug) values ('c9000000-0000-0000-0000-0000000000f1', 'Loja PV', 'pv-a'), ('c9000000-0000-0000-0000-0000000000f2', 'Outra PV', 'pv-b');
insert into public.usuarios_loja (loja_id, user_id, papel) values
  ('c9000000-0000-0000-0000-0000000000f1', '41111111-1111-1111-1111-111111111111', 'lojista'),
  ('c9000000-0000-0000-0000-0000000000f1', '42222222-2222-2222-2222-222222222222', 'editor'),
  ('c9000000-0000-0000-0000-0000000000f2', '43333333-3333-3333-3333-333333333333', 'lojista');
insert into public.produtos (id, loja_id, bling_id, sku, nome, preco, estoque, publicado) values
  ('c8000000-0000-0000-0000-0000000000f1', 'c9000000-0000-0000-0000-0000000000f1', 'pv1', 'PV-1', 'Peça incompleta', 100, 5, true);
set local role authenticated;

-- sem login
select set_config('request.jwt.claims', '', true);
do $$ begin begin perform public.produto_visibilidade('c8000000-0000-0000-0000-0000000000f1', false); raise exception 'deveria recusar'; exception when sqlstate '28000' then null; end; end $$;
select public.afirma(true, 'sem login é recusado');

-- editor não mexe
select set_config('request.jwt.claims', '{"sub":"42222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
do $$ begin begin perform public.produto_visibilidade('c8000000-0000-0000-0000-0000000000f1', false); raise exception 'deveria recusar'; exception when insufficient_privilege then null; end; end $$;
select public.afirma(true, 'editor não mostra nem oculta');

-- lojista de OUTRA loja não alcança o produto
select set_config('request.jwt.claims', '{"sub":"43333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
do $$ begin begin perform public.produto_visibilidade('c8000000-0000-0000-0000-0000000000f1', false); raise exception 'deveria recusar'; exception when insufficient_privilege then null; end; end $$;
select public.afirma(true, 'lojista de outra loja é recusado (isolamento)');

-- lojista da loja: ocultar sempre pode; mostrar produto incompleto é recusado com a lista do que falta
select set_config('request.jwt.claims', '{"sub":"41111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select public.afirma((public.produto_visibilidade('c8000000-0000-0000-0000-0000000000f1', false)->>'ok')::boolean, 'lojista oculta o produto');
reset role;
select public.afirma(not (select publicado from public.produtos where id = 'c8000000-0000-0000-0000-0000000000f1'), 'o produto ficou oculto no banco');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"41111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select public.afirma(not (public.produto_visibilidade('c8000000-0000-0000-0000-0000000000f1', true)->>'ok')::boolean, 'produto incompleto NÃO é mostrado');
select public.afirma(jsonb_array_length(public.produto_visibilidade('c8000000-0000-0000-0000-0000000000f1', true)->'faltando') > 0, 'a resposta diz o que falta');
reset role;
select public.afirma(not (select publicado from public.produtos where id = 'c8000000-0000-0000-0000-0000000000f1'), 'continua oculto depois da recusa');
select public.afirma(exists (select 1 from public.auditoria where acao = 'despublicar' and loja_id = 'c9000000-0000-0000-0000-0000000000f1'), 'ocultar fica na auditoria');
rollback;
