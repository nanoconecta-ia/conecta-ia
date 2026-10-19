-- Testa compartilhamento (hipótese), leitura de chassi e catálogo da loja por veículo com dados FICTÍCIOS; desfaz tudo no fim.
begin;
create or replace function public.afirma(ok boolean, msg text) returns void language plpgsql as
$$ begin if ok is distinct from true then raise exception 'FALHOU: %', msg; end if; raise notice 'ok: %', msg; end $$;
insert into public.fontes (id, tipo, titulo, url) values ('f0000000-0000-0000-0000-0000000000f3', 'outra', 'Fonte BV', 'https://exemplo.invalid/bv');
insert into public.montadoras (id, nome) values ('a0000000-0000-0000-0000-0000000000c1', 'MarcaParceiraA'), ('a0000000-0000-0000-0000-0000000000c2', 'MarcaParceiraB');
insert into public.modelos (id, montadora_id, nome, categoria) values
  ('a1000000-0000-0000-0000-0000000000c1', 'a0000000-0000-0000-0000-0000000000c1', 'UtilA', 'utilitario'), ('a1000000-0000-0000-0000-0000000000c2', 'a0000000-0000-0000-0000-0000000000c2', 'UtilB', 'utilitario');
insert into public.geracoes (id, modelo_id, ordem) values ('a2000000-0000-0000-0000-0000000000c1', 'a1000000-0000-0000-0000-0000000000c1', 1), ('a2000000-0000-0000-0000-0000000000c2', 'a1000000-0000-0000-0000-0000000000c2', 1);
insert into public.versoes (id, geracao_id, mercado, nome_comercial) values
  ('a3000000-0000-0000-0000-0000000000c1', 'a2000000-0000-0000-0000-0000000000c1', 'BR', 'A BR'), ('a3000000-0000-0000-0000-0000000000c2', 'a2000000-0000-0000-0000-0000000000c2', 'BR', 'B BR');
insert into public.familias_motor (id, nome) values ('a4000000-0000-0000-0000-0000000000c1', 'MOTOR-COMUM');
insert into public.motores (id, familia_id, codigo, variante) values ('a5000000-0000-0000-0000-0000000000c1', 'a4000000-0000-0000-0000-0000000000c1', 'MC1', 'g1');
-- o mesmo motor nos dois veículos de montadoras parceiras
insert into public.versao_motor (versao_id, motor_id, periodo_inicio, fonte_id, status) values
  ('a3000000-0000-0000-0000-0000000000c1', 'a5000000-0000-0000-0000-0000000000c1', 2014, 'f0000000-0000-0000-0000-0000000000f3', 'aprovado'),
  ('a3000000-0000-0000-0000-0000000000c2', 'a5000000-0000-0000-0000-0000000000c1', 2014, 'f0000000-0000-0000-0000-0000000000f3', 'aprovado');
insert into public.pecas_ref (id, classe, montadora_id, codigo, descricao, fonte_id, verificado_em, status) values
  ('a6000000-0000-0000-0000-0000000000c1', 'genuina', 'a0000000-0000-0000-0000-0000000000c1', '55555-5BV55', 'peça só aprovada no A', 'f0000000-0000-0000-0000-0000000000f3', now(), 'aprovado');
insert into public.pecas_aplicacoes_tecnicas (peca_id, versao_id, periodo_inicio, fonte_id, verificado_em, status) values
  ('a6000000-0000-0000-0000-0000000000c1', 'a3000000-0000-0000-0000-0000000000c1', 2014, 'f0000000-0000-0000-0000-0000000000f3', now(), 'aprovado');
insert into public.relacoes_tecnicas (tipo, origem_tabela, origem_id, destino_tabela, destino_id, fonte_id, status) values
  ('aliança_industrial', 'montadoras', 'a0000000-0000-0000-0000-0000000000c1', 'montadoras', 'a0000000-0000-0000-0000-0000000000c2', 'f0000000-0000-0000-0000-0000000000f3', 'aprovado');

-- (1) compartilhamento
select public.afirma(jsonb_array_length(public.candidatas_por_compartilhamento('55555-5BV55')->'candidatas') = 1, 'a versão do parceiro que compartilha o motor aparece como candidata');
select public.afirma(public.candidatas_por_compartilhamento('555555bv55')->'candidatas'->0->>'situacao' = 'hipotese', 'é HIPÓTESE, nunca "serve"');
select public.afirma((public.candidatas_por_compartilhamento('55555-5BV55')->'candidatas'->0->>'virar_anuncio')::boolean = false, 'candidata não vira anúncio sem fonte');
select public.afirma(public.candidatas_por_compartilhamento('55555-5BV55')->'candidatas'->0->'veiculo'->>'montadora' = 'MarcaParceiraB', 'a candidata é o veículo da outra montadora');
select public.afirma((public.candidatas_por_compartilhamento('55555-5BV55')->'candidatas'->0->>'alianca_entre_montadoras')::boolean, 'a aliança aprovada entre as montadoras é informada como contexto');
select public.afirma(public.candidatas_por_compartilhamento('55555-5BV55')->'candidatas'->0->>'prova_necessaria' like '%compartilhar o motor não prova%', 'o resultado diz qual prova falta');
select public.afirma(jsonb_array_length(public.candidatas_por_compartilhamento('00000-0XX00')->'candidatas') = 0, 'código desconhecido: nenhuma candidata (nada inventado)');
select public.afirma(public.candidatas_por_compartilhamento('12') ? 'erro', 'código curto é recusado');
-- se a peça já está aprovada na versão B, ela deixa de ser candidata
insert into public.pecas_aplicacoes_tecnicas (peca_id, versao_id, periodo_inicio, fonte_id, verificado_em, status) values ('a6000000-0000-0000-0000-0000000000c1', 'a3000000-0000-0000-0000-0000000000c2', 2014, 'f0000000-0000-0000-0000-0000000000f3', now(), 'aprovado');
select public.afirma(jsonb_array_length(public.candidatas_por_compartilhamento('55555-5BV55')->'candidatas') = 0, 'com a aplicação aprovada na versão B ela deixa de ser hipótese');

-- (2) catálogo da loja por veículo
insert into public.lojas (id, nome, slug) values ('c9000000-0000-0000-0000-0000000000a1', 'Loja BV', 'bv-a'), ('c9000000-0000-0000-0000-0000000000b2', 'Outra BV', 'bv-b');
insert into public.produtos (id, loja_id, bling_id, sku, nome, preco, estoque, publicado) values
  ('c8000000-0000-0000-0000-000000000001', 'c9000000-0000-0000-0000-0000000000a1', 'b1', 'BV-1', 'Peça publicada', 100, 5, true),
  ('c8000000-0000-0000-0000-000000000002', 'c9000000-0000-0000-0000-0000000000a1', 'b2', 'BV-2', 'Peça não publicada', 100, 5, false),
  ('c8000000-0000-0000-0000-000000000003', 'c9000000-0000-0000-0000-0000000000a1', 'b3', 'BV-3', 'Peça sem estoque', 100, 0, true);
insert into public.pecas_ref (id, classe, montadora_id, codigo, fonte_id, verificado_em, status) values
  ('a6000000-0000-0000-0000-0000000000c2', 'genuina', 'a0000000-0000-0000-0000-0000000000c1', '66666-6BV66', 'f0000000-0000-0000-0000-0000000000f3', now(), 'aprovado'),
  ('a6000000-0000-0000-0000-0000000000c3', 'genuina', 'a0000000-0000-0000-0000-0000000000c1', '77777-7BV77', 'f0000000-0000-0000-0000-0000000000f3', now(), 'aprovado');
insert into public.pecas_aplicacoes_tecnicas (peca_id, versao_id, periodo_inicio, fonte_id, verificado_em, status) values
  ('a6000000-0000-0000-0000-0000000000c2', 'a3000000-0000-0000-0000-0000000000c1', 2014, 'f0000000-0000-0000-0000-0000000000f3', now(), 'aprovado'),
  ('a6000000-0000-0000-0000-0000000000c3', 'a3000000-0000-0000-0000-0000000000c1', 2014, 'f0000000-0000-0000-0000-0000000000f3', now(), 'aprovado');
insert into public.produto_pecas_ref (loja_id, produto_id, peca_id, relacao, fonte_id, verificado_em, status) values
  ('c9000000-0000-0000-0000-0000000000a1', 'c8000000-0000-0000-0000-000000000001', 'a6000000-0000-0000-0000-0000000000c1', 'e_esta_peca', 'f0000000-0000-0000-0000-0000000000f3', now(), 'aprovado'),
  ('c9000000-0000-0000-0000-0000000000a1', 'c8000000-0000-0000-0000-000000000002', 'a6000000-0000-0000-0000-0000000000c2', 'e_esta_peca', 'f0000000-0000-0000-0000-0000000000f3', now(), 'aprovado'),
  ('c9000000-0000-0000-0000-0000000000a1', 'c8000000-0000-0000-0000-000000000003', 'a6000000-0000-0000-0000-0000000000c3', 'e_esta_peca', 'f0000000-0000-0000-0000-0000000000f3', now(), 'aprovado');
select public.afirma(jsonb_array_length(public.pecas_da_loja_para_veiculo('c9000000-0000-0000-0000-0000000000a1', 'a3000000-0000-0000-0000-0000000000c1', 2016)->'produtos') = 1, 'só o produto publicado, com estoque e aplicação aprovada aparece');
select public.afirma(public.pecas_da_loja_para_veiculo('c9000000-0000-0000-0000-0000000000a1', 'a3000000-0000-0000-0000-0000000000c1', 2016)->'produtos'->0->>'sku' = 'BV-1', 'é o BV-1');
select public.afirma(jsonb_array_length(public.pecas_da_loja_para_veiculo('c9000000-0000-0000-0000-0000000000b2', 'a3000000-0000-0000-0000-0000000000c1', 2016)->'produtos') = 0, 'outra loja não vê os produtos da primeira (isolamento)');
select public.afirma(jsonb_array_length(public.pecas_da_loja_para_veiculo('c9000000-0000-0000-0000-0000000000a1', 'a3000000-0000-0000-0000-0000000000c1', 2010)->'produtos') = 0, 'em 2010, antes do período aprovado (2014), nada é confirmado');
select public.afirma(public.pecas_da_loja_para_veiculo('c9000000-0000-0000-0000-0000000000a1', gen_random_uuid()) ? 'erro', 'versão inexistente devolve erro claro');
rollback;
