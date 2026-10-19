-- Testa a consulta do grafo técnico (N:N, intervalos, base versão × motor) com dados FICTÍCIOS; desfaz tudo no fim.
begin;
create or replace function public.afirma(ok boolean, msg text) returns void language plpgsql as
$$ begin if ok is distinct from true then raise exception 'FALHOU: %', msg; end if; raise notice 'ok: %', msg; end $$;
insert into public.fontes (id, tipo, titulo, url) values ('f0000000-0000-0000-0000-0000000000f1', 'outra', 'Fonte fictícia G', 'https://exemplo.invalid/g');
insert into public.montadoras (id, nome) values ('a0000000-0000-0000-0000-0000000000a1', 'MarcaG1'), ('a0000000-0000-0000-0000-0000000000a2', 'MarcaG2');
insert into public.modelos (id, montadora_id, nome, categoria) values
  ('a1000000-0000-0000-0000-0000000000a1', 'a0000000-0000-0000-0000-0000000000a1', 'UtilitarioG1', 'utilitario'),
  ('a1000000-0000-0000-0000-0000000000a2', 'a0000000-0000-0000-0000-0000000000a2', 'UtilitarioG2', 'utilitario');
insert into public.geracoes (id, modelo_id, ordem) values ('a2000000-0000-0000-0000-0000000000a1', 'a1000000-0000-0000-0000-0000000000a1', 1), ('a2000000-0000-0000-0000-0000000000a2', 'a1000000-0000-0000-0000-0000000000a2', 1);
insert into public.versoes (id, geracao_id, mercado, nome_comercial) values
  ('a3000000-0000-0000-0000-0000000000a1', 'a2000000-0000-0000-0000-0000000000a1', 'BR', 'G1 BR'),
  ('a3000000-0000-0000-0000-0000000000a2', 'a2000000-0000-0000-0000-0000000000a2', 'BR', 'G2 BR');
insert into public.familias_motor (id, nome) values ('a4000000-0000-0000-0000-0000000000a1', 'MOTOR-G');
insert into public.motores (id, familia_id, codigo, variante) values
  ('a5000000-0000-0000-0000-0000000000a1', 'a4000000-0000-0000-0000-0000000000a1', 'MG1', 'geração 1'),
  ('a5000000-0000-0000-0000-0000000000a2', 'a4000000-0000-0000-0000-0000000000a1', 'MG1', 'geração 2');
-- N:N com intervalos: G1 usou o motor geração 1 até 2015 e a geração 2 depois; o motor geração 2 também está em G2
insert into public.versao_motor (versao_id, motor_id, periodo_inicio, periodo_fim, fonte_id, status) values
  ('a3000000-0000-0000-0000-0000000000a1', 'a5000000-0000-0000-0000-0000000000a1', 2010, 2015, 'f0000000-0000-0000-0000-0000000000f1', 'aprovado'),
  ('a3000000-0000-0000-0000-0000000000a1', 'a5000000-0000-0000-0000-0000000000a2', 2016, null, 'f0000000-0000-0000-0000-0000000000f1', 'aprovado'),
  ('a3000000-0000-0000-0000-0000000000a2', 'a5000000-0000-0000-0000-0000000000a2', 2016, null, 'f0000000-0000-0000-0000-0000000000f1', 'aprovado');
insert into public.fabricantes_peca (id, nome) values ('a7000000-0000-0000-0000-0000000000a1', 'FabricanteG');
insert into public.pecas_ref (id, classe, montadora_id, codigo, descricao, fonte_id, verificado_em, status) values
  ('a6000000-0000-0000-0000-0000000000a1', 'genuina', 'a0000000-0000-0000-0000-0000000000a1', '11111-1G111', 'peça só do G1 geração 1', 'f0000000-0000-0000-0000-0000000000f1', now(), 'aprovado'),
  ('a6000000-0000-0000-0000-0000000000a2', 'genuina', 'a0000000-0000-0000-0000-0000000000a1', '22222-2G222', 'peça por motor geração 2', 'f0000000-0000-0000-0000-0000000000f1', now(), 'aprovado'),
  ('a6000000-0000-0000-0000-0000000000a3', 'genuina', 'a0000000-0000-0000-0000-0000000000a1', '33333-3G333', 'peça a confirmar', null, null, 'a_confirmar');
insert into public.pecas_aplicacoes_tecnicas (peca_id, versao_id, motor_id, periodo_inicio, periodo_fim, fonte_id, verificado_em, status) values
  ('a6000000-0000-0000-0000-0000000000a1', 'a3000000-0000-0000-0000-0000000000a1', null, 2010, 2015, 'f0000000-0000-0000-0000-0000000000f1', now(), 'aprovado'),
  ('a6000000-0000-0000-0000-0000000000a2', null, 'a5000000-0000-0000-0000-0000000000a2', 2016, null, 'f0000000-0000-0000-0000-0000000000f1', now(), 'aprovado'),
  ('a6000000-0000-0000-0000-0000000000a3', 'a3000000-0000-0000-0000-0000000000a1', null, 2010, null, null, null, 'a_confirmar');

select public.afirma(public.grafo_do_veiculo('a3000000-0000-0000-0000-0000000000a1')->'veiculo'->>'montadora' = 'MarcaG1', 'a consulta sobe até a montadora');
select public.afirma(jsonb_array_length(public.grafo_do_veiculo('a3000000-0000-0000-0000-0000000000a1')->'motores') = 2, 'a versão tem dois motores em períodos diferentes (N:N)');
select public.afirma(jsonb_array_length(public.grafo_do_veiculo('a3000000-0000-0000-0000-0000000000a1', 2012)->'motores') = 1 and (public.grafo_do_veiculo('a3000000-0000-0000-0000-0000000000a1', 2012)->'motores'->0->>'variante') = 'geração 1', 'em 2012 só o motor geração 1');
select public.afirma((public.grafo_do_veiculo('a3000000-0000-0000-0000-0000000000a1', 2018)->'motores'->0->>'variante') = 'geração 2', 'em 2018 só o motor geração 2');
select public.afirma(jsonb_array_length(public.grafo_do_veiculo('a3000000-0000-0000-0000-0000000000a2')->'motores') = 1, 'o mesmo motor aparece em outro veículo (N:N)');
select public.afirma((select count(*) from jsonb_array_elements(public.grafo_do_veiculo('a3000000-0000-0000-0000-0000000000a1', 2012)->'pecas') p where p->>'codigo' = '11111-1G111') = 1, 'em 2012 a peça do G1 geração 1 aparece');
select public.afirma((select count(*) from jsonb_array_elements(public.grafo_do_veiculo('a3000000-0000-0000-0000-0000000000a1', 2018)->'pecas') p where p->>'codigo' = '11111-1G111') = 0, 'em 2018 ela NÃO aparece (fora do intervalo)');
select public.afirma((select p->>'base' from jsonb_array_elements(public.grafo_do_veiculo('a3000000-0000-0000-0000-0000000000a1', 2018)->'pecas') p where p->>'codigo' = '22222-2G222') = 'motor', 'peça por motor vem marcada base = motor');
select public.afirma((select p->>'aviso' from jsonb_array_elements(public.grafo_do_veiculo('a3000000-0000-0000-0000-0000000000a1', 2018)->'pecas') p where p->>'codigo' = '22222-2G222') like '%não prova a versão%', 'aplicação por motor avisa que não prova a versão');
select public.afirma((select count(*) from jsonb_array_elements(public.grafo_do_veiculo('a3000000-0000-0000-0000-0000000000a1')->'pecas') p where p->>'codigo' = '33333-3G333') = 0, 'peça a confirmar não aparece por padrão');
select public.afirma((select count(*) from jsonb_array_elements(public.grafo_do_veiculo('a3000000-0000-0000-0000-0000000000a1', null, false)->'pecas') p where p->>'codigo' = '33333-3G333') = 1, 'pedindo, ela aparece rotulada pelo status');
select public.afirma(public.grafo_do_veiculo(gen_random_uuid()) ? 'erro', 'versão inexistente devolve erro claro');
select public.afirma((select count(*) from jsonb_array_elements(public.grafo_do_veiculo('a3000000-0000-0000-0000-0000000000a2', 2018)->'pecas') p where p->>'codigo' = '11111-1G111') = 0, 'peça aprovada só para o G1 não vaza para o G2');
rollback;
