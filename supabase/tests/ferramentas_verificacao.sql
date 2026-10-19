-- Testa duplicidade, cruzados e validação de aplicação com dados FICTÍCIOS; desfaz tudo no fim.
begin;
create or replace function public.afirma(ok boolean, msg text) returns void language plpgsql as
$$ begin if not ok then raise exception 'FALHOU: %', msg; end if; raise notice 'ok: %', msg; end $$;

insert into public.lojas (id, nome, slug) values ('c1000000-0000-0000-0000-0000000000a1', 'Loja V1', 'loja-v1'), ('c1000000-0000-0000-0000-0000000000b2', 'Loja V2', 'loja-v2');
insert into public.produtos (id, loja_id, bling_id, sku, nome, gtin, pai_bling_id) values
  ('c2000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-0000000000a1', 'b1', 'AB-100', 'Retentor da válvula', '7891252806921', null),
  ('c2000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-0000000000a1', 'b2', 'ab 100', 'Retentor da valvula', null, null),
  ('c2000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-0000000000a1', 'b3', 'XY-200', 'Peça única', '7891252806921', null),
  ('c2000000-0000-0000-0000-000000000004', 'c1000000-0000-0000-0000-0000000000a1', 'b4', 'VAR-1', 'Camisa tamanho P', null, 'b9'),
  ('c2000000-0000-0000-0000-000000000005', 'c1000000-0000-0000-0000-0000000000a1', 'b5', 'VAR-2', 'Camisa tamanho P', null, 'b9'),
  ('c2000000-0000-0000-0000-000000000006', 'c1000000-0000-0000-0000-0000000000b2', 'b6', 'AB-100', 'Retentor da válvula', null, null);

select public.afirma(jsonb_array_length(public.detectar_duplicidade('c1000000-0000-0000-0000-0000000000a1')->'grupos') = 3, 'varredura acha duplicidade por SKU, GTIN e nome');
select public.afirma(not exists (select 1 from jsonb_array_elements(public.detectar_duplicidade('c1000000-0000-0000-0000-0000000000a1')->'grupos') g where g->>'chave' like 'camisa%'), 'variações do mesmo pai não contam como duplicidade');
select public.afirma(jsonb_array_length(public.detectar_duplicidade('c1000000-0000-0000-0000-0000000000a1', 'AB 100')->'candidatos') = 2, 'consulta por SKU ignora hífen, espaço e caixa');
select public.afirma(jsonb_array_length(public.detectar_duplicidade('c1000000-0000-0000-0000-0000000000b2')->'grupos') = 0, 'isolamento por loja: a loja 2 não vê os produtos da loja 1');

-- peça, ligação ao SKU, cruzados e aplicações
insert into public.fontes (id, tipo, titulo, url) values ('f0000000-0000-0000-0000-0000000000f1', 'outra', 'Fonte fictícia', 'https://exemplo.invalid/f');
insert into public.montadoras (id, nome) values ('a0000000-0000-0000-0000-0000000000f1', 'MontadoraV');
insert into public.modelos (id, montadora_id, nome, categoria) values ('a1000000-0000-0000-0000-0000000000f1', 'a0000000-0000-0000-0000-0000000000f1', 'ModeloV', 'van');
insert into public.geracoes (id, modelo_id, ordem) values ('a2000000-0000-0000-0000-0000000000f1', 'a1000000-0000-0000-0000-0000000000f1', 1);
insert into public.versoes (id, geracao_id, mercado, nome_comercial) values
  ('a3000000-0000-0000-0000-0000000000f1', 'a2000000-0000-0000-0000-0000000000f1', 'BR', 'VersaoBR'),
  ('a3000000-0000-0000-0000-0000000000f2', 'a2000000-0000-0000-0000-0000000000f1', 'EUR', 'VersaoEUR');
insert into public.pecas_ref (id, classe, montadora_id, codigo, fonte_id, verificado_em, status) values
  ('a6000000-0000-0000-0000-0000000000f1', 'genuina', 'a0000000-0000-0000-0000-0000000000f1', '11111-1A111', 'f0000000-0000-0000-0000-0000000000f1', now(), 'aprovado'),
  ('a6000000-0000-0000-0000-0000000000f2', 'genuina', 'a0000000-0000-0000-0000-0000000000f1', '22222-2B222', 'f0000000-0000-0000-0000-0000000000f1', now(), 'aprovado'),
  ('a6000000-0000-0000-0000-0000000000f3', 'genuina', 'a0000000-0000-0000-0000-0000000000f1', '33333-3C333', 'f0000000-0000-0000-0000-0000000000f1', now(), 'aprovado');
insert into public.produto_pecas_ref (loja_id, produto_id, peca_id, relacao) values
  ('c1000000-0000-0000-0000-0000000000a1', 'c2000000-0000-0000-0000-000000000001', 'a6000000-0000-0000-0000-0000000000f1', 'e_esta_peca');
insert into public.ref_cruzada (origem_peca_id, destino_peca_id, tipo) values
  ('a6000000-0000-0000-0000-0000000000f1', 'a6000000-0000-0000-0000-0000000000f2', 'referencia_cruzada'),
  ('a6000000-0000-0000-0000-0000000000f2', 'a6000000-0000-0000-0000-0000000000f3', 'referencia_cruzada');
insert into public.pecas_aplicacoes_tecnicas (peca_id, versao_id, periodo_inicio, periodo_fim, fonte_id, verificado_em, status) values
  ('a6000000-0000-0000-0000-0000000000f1', 'a3000000-0000-0000-0000-0000000000f1', 2015, 2020, 'f0000000-0000-0000-0000-0000000000f1', now(), 'aprovado'),
  ('a6000000-0000-0000-0000-0000000000f1', 'a3000000-0000-0000-0000-0000000000f2', 2010, 2020, 'f0000000-0000-0000-0000-0000000000f1', now(), 'aprovado');

select public.afirma(jsonb_array_length(public.verificar_cruzados_do_sku('c1000000-0000-0000-0000-0000000000a1', 'AB-100')->'pecas'->0->'cruzados_diretos') = 1, 'só o cruzado DIRETO aparece (sem transitividade A→B→C)');
select public.afirma(public.verificar_cruzados_do_sku('c1000000-0000-0000-0000-0000000000a1', 'AB-100')->'pecas'->0->'cruzados_diretos'->0->>'codigo' = '22222-2B222', 'o cruzado direto é o B, não o C');
select public.afirma(public.verificar_cruzados_do_sku('c1000000-0000-0000-0000-0000000000a1', 'XY-200') ? 'observacao', 'SKU sem peça ligada avisa que não há o que verificar');
select public.afirma(public.verificar_cruzados_do_sku('c1000000-0000-0000-0000-0000000000b2', 'AB-100') ? 'observacao', 'isolamento por loja nos cruzados (loja 2 não tem a ligação da loja 1)');
select public.afirma(public.verificar_cruzados_do_sku('c1000000-0000-0000-0000-0000000000a1', 'NAO-EXISTE') ? 'erro', 'SKU inexistente devolve erro claro');

select public.afirma(public.validar_aplicacoes_do_sku('c1000000-0000-0000-0000-0000000000a1', 'AB-100', 2018)->>'resultado' = 'confirmada', 'ano dentro do período aprovado no BR: confirmada');
select public.afirma(public.validar_aplicacoes_do_sku('c1000000-0000-0000-0000-0000000000a1', 'AB-100', 2012)->>'resultado' = 'nao_confirmada', 'ano fora do período do BR: não confirmada (2012 só vale na versão EUR)');
select public.afirma(jsonb_array_length(public.validar_aplicacoes_do_sku('c1000000-0000-0000-0000-0000000000a1', 'AB-100')->'aplicacoes') = 1, 'só aplicações do mercado BR são consideradas');
select public.afirma(public.validar_aplicacoes_do_sku('c1000000-0000-0000-0000-0000000000a1', 'XY-200', 2018)->>'resultado' = 'nao_confirmada', 'sem peça ligada: não confirmada, nunca incompatível');
select public.afirma(public.validar_aplicacoes_do_sku('c1000000-0000-0000-0000-0000000000a1', 'AB-100', 2018)->>'resultado' <> 'incompativel', 'a ferramenta nunca devolve "incompatível"');
rollback;
