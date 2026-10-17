-- Testa migração 18 com dados FICTÍCIOS (marcas/códigos de mentira); desfaz tudo no fim.
begin;
create or replace function public.afirma(ok boolean, msg text) returns void language plpgsql as
$$ begin if not ok then raise exception 'FALHOU: %', msg; end if; raise notice 'ok: %', msg; end $$;
create or replace function public.recusa(cmd text, msg text) returns void language plpgsql as
$$ begin
  begin execute cmd; raise exception 'FALHOU: aceitou -> %', msg;
  exception when check_violation or unique_violation or foreign_key_violation or not_null_violation then raise notice 'ok: %', msg; end;
end $$;

insert into public.fontes (id, tipo, titulo, url) values
  ('f0000000-0000-0000-0000-000000000001', 'catalogo_comercial', 'Fonte fictícia A', 'https://exemplo.invalid/a');
insert into public.montadoras (id, nome) values ('a0000000-0000-0000-0000-000000000001', 'MontadoraTeste');
insert into public.modelos (id, montadora_id, nome, categoria) values
  ('a1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'VanTeste', 'van');
insert into public.geracoes (id, modelo_id, ordem) values
  ('a2000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 1);
insert into public.versoes (id, geracao_id, mercado, nome_comercial) values
  ('a3000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000001', 'BR', 'VanTeste BR');

-- datas: lançamento mundial e início no Brasil são eventos distintos; data exige evidência
select public.recusa($$insert into public.eventos_veiculo (geracao_id, tipo, data_evento, precisao)
  values ('a2000000-0000-0000-0000-000000000001', 'lancamento_mundial', '2001-01-01', 'ano')$$, 'data de evento sem fonte é recusada');
select public.recusa($$insert into public.eventos_veiculo (tipo) values ('lancamento_mundial')$$, 'evento sem geração nem versão é recusado');
insert into public.eventos_veiculo (geracao_id, tipo, data_evento, precisao, fonte_id) values
  ('a2000000-0000-0000-0000-000000000001', 'lancamento_mundial', '2001-01-01', 'ano', 'f0000000-0000-0000-0000-000000000001');
insert into public.eventos_veiculo (versao_id, tipo, mercado) values
  ('a3000000-0000-0000-0000-000000000001', 'inicio_comercializacao_br', 'BR');   -- sem data: fica em aberto
select public.afirma((select count(*) from public.eventos_veiculo where data_evento is null) = 1, 'evento sem evidência fica sem data (não inventa)');

-- motores
insert into public.familias_motor (id, nome) values ('b0000000-0000-0000-0000-000000000001', 'XT-1');
insert into public.motores (id, familia_id, codigo, cilindrada_cc) values
  ('b1000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'XT-1A', 2500);
select public.recusa($$insert into public.motores (familia_id, codigo, producao_inicio, producao_fim)
  values ('b0000000-0000-0000-0000-000000000001', 'XT-1B', 2010, 2005)$$, 'período de produção invertido é recusado');
select public.recusa($$insert into public.motores (familia_id, codigo, status)
  values ('b0000000-0000-0000-0000-000000000001', 'XT-1C', 'aprovado')$$, 'motor aprovado sem fonte é recusado');
select public.recusa($$insert into public.motores (familia_id, codigo, variante)
  values ('b0000000-0000-0000-0000-000000000001', 'XT-1A', '')$$, 'motor duplicado é recusado');
select public.recusa($$insert into public.relacoes_tecnicas (tipo, origem_tabela, origem_id, destino_tabela, destino_id)
  values ('motor_compartilhado', 'motores', 'b1000000-0000-0000-0000-000000000001', 'motores', 'b1000000-0000-0000-0000-000000000001')$$,
  'relação de um motor com ele mesmo é recusada');

-- peças: classes
insert into public.fabricantes_peca (id, nome) values
  ('c0000000-0000-0000-0000-000000000001', 'FabricanteTeste'), ('c0000000-0000-0000-0000-000000000002', 'IndependenteTeste');
select public.recusa($$insert into public.pecas_ref (classe, codigo) values ('genuina', 'G-1')$$, 'genuína sem montadora é recusada');
select public.recusa($$insert into public.pecas_ref (classe, codigo) values ('aftermarket_equivalente', 'A-1')$$, 'aftermarket sem fabricante é recusado');
select public.recusa($$insert into public.pecas_ref (classe, fabricante_id, codigo) values
  ('oem_primeiro_equipamento', 'c0000000-0000-0000-0000-000000000001', 'O-1')$$, 'OEM sem montadora cliente é recusada');
insert into public.pecas_ref (id, classe, montadora_id, codigo) values
  ('d0000000-0000-0000-0000-000000000001', 'genuina', 'a0000000-0000-0000-0000-000000000001', 'G-100');
insert into public.pecas_ref (id, classe, fabricante_id, montadora_id, codigo) values
  ('d0000000-0000-0000-0000-000000000002', 'oem_primeiro_equipamento', 'c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'F-200');
insert into public.pecas_ref (id, classe, fabricante_id, codigo) values
  ('d0000000-0000-0000-0000-000000000003', 'aftermarket_equivalente', 'c0000000-0000-0000-0000-000000000002', 'I-300'),
  ('d0000000-0000-0000-0000-000000000004', 'aftermarket_equivalente', 'c0000000-0000-0000-0000-000000000002', 'I-400');
select public.recusa($$insert into public.pecas_ref (classe, fabricante_id, codigo) values
  ('aftermarket_equivalente', 'c0000000-0000-0000-0000-000000000002', ' i-300 ')$$, 'código duplicado (caixa/espaços) é recusado');

-- OEM só aprova com fornecimento original aprovado e documentado
select public.recusa($$update public.pecas_ref set status = 'aprovado', fonte_id = 'f0000000-0000-0000-0000-000000000001', verificado_em = now()
  where id = 'd0000000-0000-0000-0000-000000000002'$$, 'OEM não aprova sem fornecedor original documentado');
select public.recusa($$insert into public.fornecedores_oem (fabricante_id, montadora_id, tipo) values
  ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'primeiro_equipamento')$$, 'fornecedor original sem fonte é recusado');
insert into public.fornecedores_oem (fabricante_id, montadora_id, tipo, fonte_id, status) values
  ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'primeiro_equipamento', 'f0000000-0000-0000-0000-000000000001', 'aprovado');
update public.pecas_ref set status = 'aprovado', fonte_id = 'f0000000-0000-0000-0000-000000000001', verificado_em = now()
  where id = 'd0000000-0000-0000-0000-000000000002';
select public.afirma((select status from public.pecas_ref where id = 'd0000000-0000-0000-0000-000000000002') = 'aprovado', 'OEM aprova com fornecedor original documentado');
-- fornecimento é POR categoria: outra marca/peça da mesma montadora não herda
select public.recusa($$insert into public.pecas_ref (classe, fabricante_id, montadora_id, codigo, status, fonte_id, verificado_em) values
  ('oes', 'c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'F-201', 'aprovado', 'f0000000-0000-0000-0000-000000000001', now())$$,
  'OES não herda o fornecimento de primeiro equipamento');

-- grafo: sem transitividade e com evidência
select public.recusa($$insert into public.ref_cruzada (origem_peca_id, destino_peca_id, tipo)
  values ('d0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000003', 'referencia_cruzada')$$, 'aresta de peça com ela mesma é recusada');
select public.recusa($$insert into public.ref_cruzada (origem_peca_id, destino_peca_id, tipo, status, fonte_id, verificado_em)
  values ('d0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'equivalente_validado', 'aprovado',
  'f0000000-0000-0000-0000-000000000001', now())$$, 'equivalente validado aprovado sem evidência de validação é recusado');
insert into public.ref_cruzada (origem_peca_id, destino_peca_id, tipo) values
  ('d0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'referencia_cruzada'),
  ('d0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000004', 'referencia_cruzada');
select public.afirma((select count(*) from public.ref_cruzada
  where origem_peca_id = 'd0000000-0000-0000-0000-000000000001' and destino_peca_id = 'd0000000-0000-0000-0000-000000000004') = 0,
  'A→B e B→C não criam A→C');
select public.recusa($$insert into public.ref_cruzada (origem_peca_id, destino_peca_id, tipo)
  values ('d0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'referencia_cruzada')$$, 'aresta duplicada é recusada');

-- aplicação técnica exige alvo
select public.recusa($$insert into public.pecas_aplicacoes_tecnicas (peca_id) values ('d0000000-0000-0000-0000-000000000003')$$, 'aplicação sem versão nem motor é recusada');

-- RLS / grants
insert into public.lojas (id, nome, slug) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Loja A', 'loja-a'), ('bbbbbbbb-0000-0000-0000-000000000002', 'Loja B', 'loja-b');
insert into public.usuarios_loja (loja_id, user_id) values ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111');
insert into public.produtos (id, loja_id, bling_id, sku, nome, preco, estoque) values
  ('aaaaaaaa-1111-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', '1', 'S-A', 'Peça A', 1, 1),
  ('bbbbbbbb-1111-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002', '1', 'S-B', 'Peça B', 1, 1);
insert into public.produto_pecas_ref (loja_id, produto_id, peca_id, relacao) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-1111-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'referencia_cruzada'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'bbbbbbbb-1111-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000003', 'referencia_cruzada');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select public.afirma((select count(*) from public.pecas_ref) = 4, 'logado lê o catálogo global');
select public.afirma((select count(*) from public.produto_pecas_ref) = 1, 'lojista vê só a ligação com o SKU da própria loja');
do $$ begin
  begin insert into public.pecas_ref (classe, montadora_id, codigo) values ('genuina', 'a0000000-0000-0000-0000-000000000001', 'HACK'); raise exception 'escreveu';
  exception when insufficient_privilege then null; end;
end $$;
select public.afirma(true, 'logado não escreve no catálogo');
set local role anon;
do $$ begin
  begin perform count(*) from public.pecas_ref; raise exception 'anon leu';
  exception when insufficient_privilege then null; end;
end $$;
select public.afirma(true, 'visitante (anon) não lê o catálogo técnico');
rollback;
