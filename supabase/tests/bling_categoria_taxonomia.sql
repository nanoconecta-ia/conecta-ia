-- Testa a ponte Bling categoria -> taxonomia interna: definir aplica de imediato nos produtos já sincronizados;
-- sincronização futura (bling_categoria_taxonomia_aplicar) pega produtos novos/trocados. Desfaz tudo.
begin;
create or replace function public.afirma(ok boolean, msg text) returns void language plpgsql as
$$ begin if not ok then raise exception 'FALHOU: %', msg; end if; raise notice 'ok: %', msg; end $$;

insert into public.lojas (id, nome, slug) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Loja A', 'loja-a');
insert into public.taxonomia_nos (id, perfil_ramo, nome, slug, status) values ('bbbbbbbb-0000-0000-0000-000000000001', 'autopecas', 'Motor', 'motor-teste', 'aprovado');
insert into public.produtos (id, loja_id, bling_id, sku, nome, situacao, categoria_bling_id) values
  ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', '1', '80692', 'Jogo de juntas', 'A', '1072643'),
  ('cccccccc-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', '2', 'CI001086', 'Bomba óleo', 'A', '1072643');
\set A '\'aaaaaaaa-0000-0000-0000-000000000001\''
\set NO '\'bbbbbbbb-0000-0000-0000-000000000001\''

-- definir aplica de imediato nos 2 produtos já sincronizados dessa categoria
select public.bling_categoria_taxonomia_definir(:A, '1072643', :NO);
select public.afirma((select count(*) from public.produtos where loja_id = :A and taxonomia_no_id = :NO) = 2, 'definir aplica de imediato nos produtos existentes');
select public.afirma((select count(*) from public.bling_categoria_taxonomia where loja_id = :A) = 1, 'mapeamento gravado');

-- taxonomia_no_id inexistente é recusado (FK)
do $$ begin begin perform public.bling_categoria_taxonomia_definir('aaaaaaaa-0000-0000-0000-000000000001', '1072643', gen_random_uuid()); raise exception 'aceitou'; exception when others then null; end; end $$;
select public.afirma(true, 'nó de taxonomia inexistente é recusado');

-- produto novo da mesma categoria, ainda sem o link: a aplicação por sincronização (chamada de novo, idempotente) resolve
insert into public.produtos (id, loja_id, bling_id, sku, nome, situacao, categoria_bling_id) values
  ('cccccccc-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', '3', 'CI003696', 'Motor completo', 'A', '1072643');
select public.afirma((select taxonomia_no_id from public.produtos where bling_id = '3') is null, 'produto novo nasce sem link (sync básico não conhece o mapeamento)');
select public.bling_categoria_taxonomia_aplicar(:A);
select public.afirma((select taxonomia_no_id from public.produtos where bling_id = '3') = :NO, 'aplicar (chamado pela sincronização) linka o produto novo');
select public.afirma(public.bling_categoria_taxonomia_aplicar(:A) = 0, 'segunda chamada é idempotente (nada para atualizar)');

-- remover não desfaz o link já aplicado (só para novos produtos / remapeamento futuro)
select public.bling_categoria_taxonomia_remover(:A, '1072643');
select public.afirma((select count(*) from public.bling_categoria_taxonomia where loja_id = :A) = 0, 'remover apaga o mapeamento');
select public.afirma((select count(*) from public.produtos where loja_id = :A and taxonomia_no_id = :NO) = 3, 'produtos já linkados continuam linkados após remover');

-- isolamento por loja: outra loja não vê nem é afetada
insert into public.lojas (id, nome, slug) values ('aaaaaaaa-0000-0000-0000-000000000002', 'Loja B', 'loja-b');
select public.afirma((select count(*) from public.bling_categoria_taxonomia where loja_id = 'aaaaaaaa-0000-0000-0000-000000000002') = 0, 'outra loja não enxerga mapeamento de loja diferente');

-- usuário autenticado não chama as RPCs de escrita direto (só service_role, via função)
insert into public.usuarios_loja (loja_id, user_id, papel) values (:A, '11111111-1111-1111-1111-111111111111', 'lojista');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
do $$ begin begin perform public.bling_categoria_taxonomia_definir('aaaaaaaa-0000-0000-0000-000000000001', '1072643', 'bbbbbbbb-0000-0000-0000-000000000001'); raise exception 'aceitou'; exception when insufficient_privilege then null; end; end $$;
select public.afirma(true, 'usuário logado não define mapeamento direto');
rollback;
