-- Testa a camada de conhecimento (atores, regime BR, bula técnica, intercâmbio, filtros da vitrine) com dados FICTÍCIOS; desfaz tudo no fim.
begin;
create or replace function public.afirma(ok boolean, msg text) returns void language plpgsql as
$$ begin if ok is distinct from true then raise exception 'FALHOU: %', msg; end if; raise notice 'ok: %', msg; end $$;
insert into public.fontes (id, tipo, titulo, url) values ('f0000000-0000-0000-0000-0000000000f4', 'outra', 'Fonte CK', 'https://exemplo.invalid/ck');

-- (1) papéis: classificar exige fonte; fabricante de motor não é montadora
insert into public.fabricantes_peca (id, nome) values ('b1000000-0000-0000-0000-0000000000a1', 'FabMotorTeste'), ('b1000000-0000-0000-0000-0000000000a2', 'FabPecaTeste'), ('b1000000-0000-0000-0000-0000000000a3', 'FabPecaTeste2');
do $$ begin
  begin update public.fabricantes_peca set papel = 'fabricante_motor' where nome = 'FabMotorTeste'; raise exception 'deveria recusar'; exception when check_violation then null; end;
end $$;
update public.fabricantes_peca set papel = 'fabricante_motor', segmentos = array['pesado', 'agricola', 'linha_amarela'], papel_fonte_id = 'f0000000-0000-0000-0000-0000000000f4' where nome = 'FabMotorTeste';
update public.fabricantes_peca set papel = 'sistemista_autopeca', segmentos = array['leve'], papel_fonte_id = 'f0000000-0000-0000-0000-0000000000f4' where nome in ('FabPecaTeste', 'FabPecaTeste2');
select public.afirma((select papel from public.fabricantes_peca where nome = 'FabMotorTeste') = 'fabricante_motor', 'fabricante de motor classificado com fonte');
do $$ begin
  begin update public.fabricantes_peca set segmentos = array['espacial'] where nome = 'FabPecaTeste'; raise exception 'deveria recusar'; exception when check_violation then null; end;
end $$;
select public.afirma(true, 'segmento fora da lista é recusado');

-- (2) regime de montagem BR exige fonte
insert into public.montadoras (id, nome) values ('b0000000-0000-0000-0000-0000000000a1', 'MarcaCK');
insert into public.modelos (id, montadora_id, nome, categoria) values ('b2000000-0000-0000-0000-0000000000a1', 'b0000000-0000-0000-0000-0000000000a1', 'UtilCK', 'utilitario');
insert into public.geracoes (id, modelo_id, ordem) values ('b3000000-0000-0000-0000-0000000000a1', 'b2000000-0000-0000-0000-0000000000a1', 1);
insert into public.versoes (id, geracao_id, mercado, nome_comercial) values ('b4000000-0000-0000-0000-0000000000a1', 'b3000000-0000-0000-0000-0000000000a1', 'BR', 'CK BR');
do $$ begin
  begin update public.versoes set regime_montagem = 'ckd' where id = 'b4000000-0000-0000-0000-0000000000a1'; raise exception 'deveria recusar'; exception when check_violation then null; end;
end $$;
select public.afirma(true, 'regime de montagem sem fonte é recusado');
update public.versoes set regime_montagem = 'ckd', propulsao = 'combustao', regime_fonte_id = 'f0000000-0000-0000-0000-0000000000f4' where id = 'b4000000-0000-0000-0000-0000000000a1';

-- (3) bula técnica
insert into public.sistemas_mecanicos (id, nivel, nome, icone, origem, status) values ('b5000000-0000-0000-0000-0000000000a1', 1, 'Motor CK', 'motor', 'teste', 'aprovada');
insert into public.taxonomia_nos (id, perfil_ramo, nome, slug, sistema_id) values ('b6000000-0000-0000-0000-0000000000a1', 'autopecas', 'Junta CK', 'junta-ck', 'b5000000-0000-0000-0000-0000000000a1');
insert into public.lojas (id, nome, slug) values ('c9000000-0000-0000-0000-0000000000c1', 'Loja CK', 'ck-a'), ('c9000000-0000-0000-0000-0000000000c2', 'Outra CK', 'ck-b');
insert into public.produtos (id, loja_id, bling_id, sku, nome, preco, estoque, publicado, taxonomia_no_id) values
  ('c8000000-0000-0000-0000-0000000000a1', 'c9000000-0000-0000-0000-0000000000c1', 'k1', 'CK-1', 'Junta publicada', 100, 5, true, 'b6000000-0000-0000-0000-0000000000a1'),
  ('c8000000-0000-0000-0000-0000000000a2', 'c9000000-0000-0000-0000-0000000000c1', 'k2', 'CK-2', 'Junta sem estoque', 100, 0, true, 'b6000000-0000-0000-0000-0000000000a1');
insert into public.pecas_ref (id, classe, fabricante_id, codigo, taxonomia_no_id, fonte_id, verificado_em, status) values
  ('b7000000-0000-0000-0000-0000000000a1', 'aftermarket_equivalente', 'b1000000-0000-0000-0000-0000000000a2', 'JG-100', 'b6000000-0000-0000-0000-0000000000a1', 'f0000000-0000-0000-0000-0000000000f4', now(), 'aprovado'),
  ('b7000000-0000-0000-0000-0000000000a2', 'aftermarket_equivalente', 'b1000000-0000-0000-0000-0000000000a3', 'JG-200', 'b6000000-0000-0000-0000-0000000000a1', 'f0000000-0000-0000-0000-0000000000f4', now(), 'aprovado');
insert into public.produto_pecas_ref (loja_id, produto_id, peca_id, relacao, fonte_id, verificado_em, status) values
  ('c9000000-0000-0000-0000-0000000000c1', 'c8000000-0000-0000-0000-0000000000a1', 'b7000000-0000-0000-0000-0000000000a1', 'e_esta_peca', 'f0000000-0000-0000-0000-0000000000f4', now(), 'aprovado'),
  ('c9000000-0000-0000-0000-0000000000c1', 'c8000000-0000-0000-0000-0000000000a2', 'b7000000-0000-0000-0000-0000000000a2', 'e_esta_peca', 'f0000000-0000-0000-0000-0000000000f4', now(), 'aprovado');
insert into public.especificacoes_exigidas (taxonomia_no_id, nome, unidade, origem, status) values
  ('b6000000-0000-0000-0000-0000000000a1', 'espessura', 'mm', 'teste', 'aprovada'), ('b6000000-0000-0000-0000-0000000000a1', 'diametro', 'mm', 'teste', 'proposta');
select public.afirma((public.bula_tecnica_do_sku('c9000000-0000-0000-0000-0000000000c1', 'CK-1')->>'bula_completa')::boolean = false, 'sem a medida exigida aprovada a bula NÃO está completa');
select public.afirma(public.bula_tecnica_do_sku('c9000000-0000-0000-0000-0000000000c1', 'CK-1')->'pecas'->0->'medidas_faltando'->0->>'nome' = 'espessura', 'a medida faltante é apontada; exigência só proposta não conta');
do $$ begin
  begin insert into public.peca_especificacoes (peca_id, nome, unidade, status) values ('b7000000-0000-0000-0000-0000000000a1', 'espessura', 'mm', 'aprovado'); raise exception 'deveria recusar'; exception when check_violation then null; end;
end $$;
select public.afirma(true, 'medida aprovada sem fonte/valor é recusada');
insert into public.peca_especificacoes (peca_id, nome, valor_num, unidade, fonte_id, verificado_em, status) values ('b7000000-0000-0000-0000-0000000000a1', 'espessura', 1.20, 'mm', 'f0000000-0000-0000-0000-0000000000f4', now(), 'aprovado');
select public.afirma((public.bula_tecnica_do_sku('c9000000-0000-0000-0000-0000000000c1', 'CK-1')->>'bula_completa')::boolean, 'com a medida exigida aprovada a bula fica completa');
insert into public.peca_contraindicacoes (peca_id, tipo, texto, fonte_id, verificado_em, status) values
  ('b7000000-0000-0000-0000-0000000000a1', 'montagem', 'Não reutilizar parafusos do cabeçote', 'f0000000-0000-0000-0000-0000000000f4', now(), 'aprovado'),
  ('b7000000-0000-0000-0000-0000000000a1', 'uso', 'rascunho ainda sem fonte', null, null, 'a_confirmar');
select public.afirma(jsonb_array_length(public.bula_tecnica_do_sku('c9000000-0000-0000-0000-0000000000c1', 'CK-1')->'pecas'->0->'contraindicacoes') = 1, 'só contraindicação aprovada aparece');
select public.afirma(public.bula_tecnica_do_sku('c9000000-0000-0000-0000-0000000000c2', 'CK-1') ? 'erro', 'outra loja não enxerga o SKU (isolamento)');

-- (4) intercâmbio entre fabricantes: relação direta, sem transitividade
insert into public.ref_cruzada (origem_peca_id, destino_peca_id, tipo, fonte_id, verificado_em, status) values
  ('b7000000-0000-0000-0000-0000000000a1', 'b7000000-0000-0000-0000-0000000000a2', 'referencia_cruzada', 'f0000000-0000-0000-0000-0000000000f4', now(), 'aprovado');
select public.afirma(public.intercambio_da_peca('JG-100')->'equivalentes'->0->>'fabricante' = 'FabPecaTeste2', 'a peça aparece fabricada pela outra marca');
select public.afirma(public.intercambio_da_peca('jg 100')->'equivalentes'->0->>'relacao' = 'referencia_cruzada', 'o tipo de relação é informado (referência não é equivalência)');
select public.afirma(jsonb_array_length(public.intercambio_da_peca('JG-200')->'equivalentes') = 0, 'sem transitividade nem inversão automática');
select public.afirma(public.intercambio_da_peca('x') ? 'erro', 'código curto é recusado');

-- (5) filtros da vitrine e bloco de aplicações
insert into public.pecas_aplicacoes_tecnicas (peca_id, versao_id, periodo_inicio, fonte_id, verificado_em, status) values
  ('b7000000-0000-0000-0000-0000000000a1', 'b4000000-0000-0000-0000-0000000000a1', 2014, 'f0000000-0000-0000-0000-0000000000f4', now(), 'aprovado');
select public.afirma(public.filtros_da_vitrine('c9000000-0000-0000-0000-0000000000c1')->'categorias'->0->>'icone' = 'motor', 'categoria sai com o ícone da árvore funcional');
select public.afirma((public.filtros_da_vitrine('c9000000-0000-0000-0000-0000000000c1')->'categorias'->0->>'total')::int = 1, 'conta só publicado com estoque');
select public.afirma(public.filtros_da_vitrine('c9000000-0000-0000-0000-0000000000c1')->'montadoras'->0->>'nome' = 'MarcaCK', 'montadora vem da aplicação aprovada');
select public.afirma(public.filtros_da_vitrine('c9000000-0000-0000-0000-0000000000c1')->'fabricantes'->0->>'nome' = 'FabPecaTeste', 'fabricante vem da peça aprovada');
select public.afirma(jsonb_array_length(public.filtros_da_vitrine('c9000000-0000-0000-0000-0000000000c2')->'categorias') = 0, 'outra loja não vê os filtros da primeira');
select public.afirma(public.aplicacoes_publicas_do_produto('c9000000-0000-0000-0000-0000000000c1', 'CK-1')->'aplicacoes'->0->>'regime_montagem' = 'ckd', 'bloco de aplicações traz o regime de montagem BR');
select public.afirma(jsonb_array_length(public.aplicacoes_publicas_do_produto('c9000000-0000-0000-0000-0000000000c1', 'CK-2')->'aplicacoes') = 0, 'sem aplicação aprovada, sem bloco (não confirmado)');
rollback;
