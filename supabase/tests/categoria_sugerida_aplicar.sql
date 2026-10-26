-- Aprovar uma sugestão de categoria leva o produto ao nó escolhido e a sincronização não desfaz a decisão.
-- Cobre: caminho "Grupo › Subgrupo", só "Grupo", separador ">" antigo, nó inexistente/ambíguo, sugestão pendente ou
-- rejeitada (não vale), prioridade sobre o mapeamento da categoria do Bling, idempotência e isolamento por loja. Desfaz tudo.
begin;
create or replace function public.afirma(ok boolean, msg text) returns void language plpgsql as
$$ begin if not ok then raise exception 'FALHOU: %', msg; end if; raise notice 'ok: %', msg; end $$;

insert into public.lojas (id, nome, slug) values
  ('aaaaaaaa-0000-0000-0000-0000000000a1', 'Loja A', 'loja-a'), ('aaaaaaaa-0000-0000-0000-0000000000a2', 'Loja B', 'loja-b');
insert into public.taxonomia_nos (id, perfil_ramo, pai_id, nome, slug, status) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'autopecas', null, 'Motor', 'motor-t', 'aprovado'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'autopecas', 'bbbbbbbb-0000-0000-0000-000000000001', 'Juntas e retentores', 'juntas-t', 'aprovado'),
  ('bbbbbbbb-0000-0000-0000-000000000003', 'autopecas', null, 'Sem classificação', 'sem-class-t', 'proposto'),
  ('bbbbbbbb-0000-0000-0000-000000000004', 'autopecas', null, 'Filtros', 'filtros-t', 'aprovado'),
  ('bbbbbbbb-0000-0000-0000-000000000005', 'autopecas', 'bbbbbbbb-0000-0000-0000-000000000004', 'Filtros de óleo', 'filtro-oleo-t', 'aprovado');
insert into public.produtos (id, loja_id, bling_id, sku, nome, situacao, categoria_bling_id) values
  ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-0000000000a1', '1', 'P1', 'Jogo de juntas', 'A', '1072643'),
  ('cccccccc-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-0000000000a1', '2', 'P2', 'Filtro de óleo', 'A', '1072643'),
  ('cccccccc-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-0000000000a1', '3', 'P3', 'Peça pendente', 'A', '1072643'),
  ('cccccccc-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-0000000000a1', '4', 'P4', 'Peça rejeitada', 'A', '1072643'),
  ('cccccccc-0000-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-0000000000a1', '5', 'P5', 'Caminho que não existe', 'A', '1072643'),
  ('cccccccc-0000-0000-0000-000000000006', 'aaaaaaaa-0000-0000-0000-0000000000a1', '6', 'P6', 'Só grupo', 'A', '1072643'),
  ('cccccccc-0000-0000-0000-000000000007', 'aaaaaaaa-0000-0000-0000-0000000000a2', '7', 'P7', 'Outra loja', 'A', '1072643');
\set A '\'aaaaaaaa-0000-0000-0000-0000000000a1\''
\set B '\'aaaaaaaa-0000-0000-0000-0000000000a2\''
insert into public.bling_categoria_taxonomia (loja_id, bling_categoria_id, taxonomia_no_id) values
  (:A, '1072643', 'bbbbbbbb-0000-0000-0000-000000000003'), (:B, '1072643', 'bbbbbbbb-0000-0000-0000-000000000003');

insert into public.produto_enriquecimento (loja_id, produto_id, campo, valor, fonte, coletado_em, confianca, status) values
  (:A, 'cccccccc-0000-0000-0000-000000000001', 'categoria_sugerida', to_jsonb('Motor › Juntas e retentores'::text), 'teste', now(), 0.9, 'aprovado'),
  (:A, 'cccccccc-0000-0000-0000-000000000002', 'categoria_sugerida', to_jsonb('Filtros > Filtros de óleo'::text), 'teste', now(), 0.9, 'aprovado'),
  (:A, 'cccccccc-0000-0000-0000-000000000003', 'categoria_sugerida', to_jsonb('Motor › Juntas e retentores'::text), 'teste', now(), 0.9, 'a_confirmar'),
  (:A, 'cccccccc-0000-0000-0000-000000000004', 'categoria_sugerida', to_jsonb('Motor › Juntas e retentores'::text), 'teste', now(), 0.9, 'rejeitado'),
  (:A, 'cccccccc-0000-0000-0000-000000000005', 'categoria_sugerida', to_jsonb('Motor › Não existe'::text), 'teste', now(), 0.9, 'aprovado'),
  (:A, 'cccccccc-0000-0000-0000-000000000006', 'categoria_sugerida', to_jsonb('Motor'::text), 'teste', now(), 0.9, 'aprovado'),
  (:B, 'cccccccc-0000-0000-0000-000000000007', 'categoria_sugerida', to_jsonb('Motor'::text), 'teste', now(), 0.9, 'aprovado');

select public.bling_categoria_taxonomia_aplicar(:A);
select public.afirma((select taxonomia_no_id from public.produtos where bling_id = '1') = 'bbbbbbbb-0000-0000-0000-000000000002', 'aprovada "Grupo › Subgrupo" leva o produto ao subgrupo');
select public.afirma((select taxonomia_no_id from public.produtos where bling_id = '2') = 'bbbbbbbb-0000-0000-0000-000000000005', 'aprovada com o separador ">" antigo também vale');
select public.afirma((select taxonomia_no_id from public.produtos where bling_id = '6') = 'bbbbbbbb-0000-0000-0000-000000000001', 'aprovada só com o grupo leva ao grupo');
select public.afirma((select taxonomia_no_id from public.produtos where bling_id = '3') = 'bbbbbbbb-0000-0000-0000-000000000003', 'sugestão pendente não vale: fica no mapeamento da categoria');
select public.afirma((select taxonomia_no_id from public.produtos where bling_id = '4') = 'bbbbbbbb-0000-0000-0000-000000000003', 'sugestão rejeitada não vale');
select public.afirma((select taxonomia_no_id from public.produtos where bling_id = '5') is null, 'caminho que não existe na taxonomia não muda o produto');
select public.afirma((select taxonomia_no_id from public.produtos where bling_id = '7') is null, 'a aplicação de uma loja não toca nos produtos de outra');

-- a sincronização reaplica o mapeamento da categoria do Bling e NÃO desfaz a decisão aprovada
select public.bling_categoria_taxonomia_aplicar(:A);
select public.afirma((select taxonomia_no_id from public.produtos where bling_id = '1') = 'bbbbbbbb-0000-0000-0000-000000000002', 'segunda aplicação mantém a decisão do lojista');
select public.afirma(public.bling_categoria_taxonomia_aplicar(:A) = 0, 'idempotente: nada para atualizar');

-- rejeitar depois de aprovar devolve o produto ao mapeamento da categoria
update public.produto_enriquecimento set status = 'rejeitado' where produto_id = 'cccccccc-0000-0000-0000-000000000001' and campo = 'categoria_sugerida';
select public.bling_categoria_taxonomia_aplicar(:A);
select public.afirma((select taxonomia_no_id from public.produtos where bling_id = '1') = 'bbbbbbbb-0000-0000-0000-000000000003', 'decisão revertida volta ao mapeamento da categoria');

-- permissões: só o serviço executa
set local role authenticated;
do $$ begin begin perform public.bling_categoria_taxonomia_aplicar('aaaaaaaa-0000-0000-0000-0000000000a1'); raise exception 'aceitou'; exception when insufficient_privilege then null; end; end $$;
select public.afirma(true, 'usuário logado não executa a aplicação direto');
rollback;
