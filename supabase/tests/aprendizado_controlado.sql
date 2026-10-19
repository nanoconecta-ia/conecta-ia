-- Testa a aprendizagem controlada e a proteção de registros aprovados com dados FICTÍCIOS; desfaz tudo no fim.
begin;
create or replace function public.afirma(ok boolean, msg text) returns void language plpgsql as
$$ begin if ok is distinct from true then raise exception 'FALHOU: %', msg; end if; raise notice 'ok: %', msg; end $$;
create or replace function public.recusa(cmd text, msg text) returns void language plpgsql as
$$ begin
  begin execute cmd; raise exception 'FALHOU: aceitou -> %', msg;
  exception when insufficient_privilege or check_violation or invalid_parameter_value or no_data_found or unique_violation then raise notice 'ok: %', msg; end;
end $$;
insert into public.lojas (id, nome, slug) values ('b1000000-0000-0000-0000-0000000000a1', 'Ap A', 'ap-a'), ('b1000000-0000-0000-0000-0000000000b2', 'Ap B', 'ap-b');
insert into public.usuarios_loja (loja_id, user_id, papel) values
  ('b1000000-0000-0000-0000-0000000000a1', 'b2000000-0000-0000-0000-000000000001', 'lojista'),
  ('b1000000-0000-0000-0000-0000000000a1', 'b2000000-0000-0000-0000-000000000002', 'editor'),
  ('b1000000-0000-0000-0000-0000000000b2', 'b2000000-0000-0000-0000-000000000003', 'lojista');

-- barreiras
select public.recusa($$select public.aprendizado_propor('b1000000-0000-0000-0000-0000000000a1', 'regra_fiscal', 'x', '{}', 'observacao_agente', 'fonte teste', 'agente')$$, 'escopo fiscal não existe: o agente não consegue propô-lo');
select public.recusa($$select public.aprendizado_propor('b1000000-0000-0000-0000-0000000000a1', 'politica_seguranca', 'x', '{}', 'observacao_agente', 'fonte teste', 'agente')$$, 'escopo de política de segurança não existe');
select public.recusa($$select public.aprendizado_propor('b1000000-0000-0000-0000-0000000000a1', 'aplicacao_tecnica', 'x', '{}', 'observacao_agente', 'fonte teste', 'agente')$$, 'escopo de aplicação técnica não existe');
select public.recusa($$select public.aprendizado_propor('b1000000-0000-0000-0000-0000000000a1', 'regra_classificacao', 'junta', '{"familia":"Jogo de Juntas","ncm":"84849000"}', 'observacao_agente', 'fonte teste', 'agente')$$, 'valor com NCM é recusado');
select public.recusa($$select public.aprendizado_propor('b1000000-0000-0000-0000-0000000000a1', 'regra_classificacao', 'junta', '{"dados":{"aplicacoes":["HR"]}}', 'observacao_agente', 'fonte teste', 'agente')$$, 'valor com aplicação aninhada é recusado');
select public.recusa($$select public.aprendizado_propor('b1000000-0000-0000-0000-0000000000a1', 'regra_classificacao', 'junta', '{"familia":"x"}', 'observacao_agente', '', 'agente')$$, 'sem procedência não entra');

-- ciclo: propor → (agente/editor não ativam) → lojista ativa → nova versão substitui → reverter restaura a anterior
create temp table v1 as select public.aprendizado_propor('b1000000-0000-0000-0000-0000000000a1', 'regra_classificacao', 'Kit de Juntas', '{"familia":"Jogo de Juntas"}', 'correcao_aprovada', 'correção do lojista em 2026-10-19', 'agente') as id;
select public.afirma((select status from public.aprendizado_regras where id = (select id from v1)) = 'proposta', 'nasce como proposta');
select public.afirma((select chave from public.aprendizado_regras where id = (select id from v1)) = 'kit de juntas', 'a chave é normalizada');
select public.afirma(public.aprendizado_ativas('b1000000-0000-0000-0000-0000000000a1', 'regra_classificacao') = '[]'::jsonb, 'proposta não vale ainda');
select public.recusa($$select public.aprendizado_ativar('b1000000-0000-0000-0000-0000000000a1', (select id from v1), 'b2000000-0000-0000-0000-000000000002')$$, 'editor não ativa');
select public.recusa($$select public.aprendizado_ativar('b1000000-0000-0000-0000-0000000000b2', (select id from v1), 'b2000000-0000-0000-0000-000000000003')$$, 'lojista de outra loja não ativa regra alheia');
select public.afirma(public.aprendizado_ativar('b1000000-0000-0000-0000-0000000000a1', (select id from v1), 'b2000000-0000-0000-0000-000000000001') = 1, 'lojista ativa a versão 1');
select public.afirma(jsonb_array_length(public.aprendizado_ativas('b1000000-0000-0000-0000-0000000000a1', 'regra_classificacao')) = 1, 'a regra ativa passa a valer');
select public.afirma(jsonb_array_length(public.aprendizado_ativas('b1000000-0000-0000-0000-0000000000b2', 'regra_classificacao')) = 0, 'não vale para outra loja');
create temp table v2 as select public.aprendizado_propor('b1000000-0000-0000-0000-0000000000a1', 'regra_classificacao', 'kit de juntas', '{"familia":"Junta de Cabeçote"}', 'correcao_aprovada', 'nova correção do lojista', 'pessoa') as id;
select public.afirma((select versao from public.aprendizado_regras where id = (select id from v2)) = 2, 'a nova proposta é a versão 2');
select public.aprendizado_ativar('b1000000-0000-0000-0000-0000000000a1', (select id from v2), 'b2000000-0000-0000-0000-000000000001');
select public.afirma((select status from public.aprendizado_regras where id = (select id from v1)) = 'substituida', 'a versão 1 foi substituída, não apagada');
select public.afirma((public.aprendizado_ativas('b1000000-0000-0000-0000-0000000000a1', 'regra_classificacao')->0->'valor'->>'familia') = 'Junta de Cabeçote', 'vale a versão 2');
select public.recusa($$select public.aprendizado_reverter('b1000000-0000-0000-0000-0000000000a1', (select id from v2), 'b2000000-0000-0000-0000-000000000002', 'errada')$$, 'editor não reverte');
select public.recusa($$select public.aprendizado_reverter('b1000000-0000-0000-0000-0000000000a1', (select id from v2), 'b2000000-0000-0000-0000-000000000001', '')$$, 'reverter exige motivo');
select public.afirma(public.aprendizado_reverter('b1000000-0000-0000-0000-0000000000a1', (select id from v2), 'b2000000-0000-0000-0000-000000000001', 'categoria errada para este caso') = (select id from v1), 'reverter devolve a vigência à versão 1');
select public.afirma((public.aprendizado_ativas('b1000000-0000-0000-0000-0000000000a1', 'regra_classificacao')->0->'valor'->>'familia') = 'Jogo de Juntas', 'depois da reversão vale de novo a versão 1');
select public.afirma((select count(*) from public.aprendizado_regras where chave = 'kit de juntas') = 2, 'nada foi apagado: histórico completo das 2 versões');
select public.afirma((select count(*) from public.auditoria where acao in ('aprendizado.ativado', 'aprendizado.revertido')) = 3, 'ativações e reversão ficaram na auditoria');
select public.recusa($$update public.aprendizado_regras set valor = '{"familia":"Outra"}' where id = (select id from v1)$$, 'o conteúdo de uma regra é imutável');
select public.recusa($$delete from public.aprendizado_regras$$, 'regra aprendida não se apaga');
select public.recusa($$select public.aprendizado_ativar('b1000000-0000-0000-0000-0000000000a1', (select id from v2), 'b2000000-0000-0000-0000-000000000001')$$, 'regra revertida não reativa por engano (nova versão é o caminho)');

-- registros aprovados do catálogo: o agente não altera nem apaga; só rebaixa
insert into public.fontes (id, tipo, titulo, url) values ('f0000000-0000-0000-0000-0000000000f2', 'outra', 'Fonte AP', 'https://exemplo.invalid/ap');
insert into public.montadoras (id, nome) values ('a0000000-0000-0000-0000-0000000000b1', 'MarcaAP');
insert into public.modelos (id, montadora_id, nome, categoria) values ('a1000000-0000-0000-0000-0000000000b1', 'a0000000-0000-0000-0000-0000000000b1', 'ModeloAP', 'van');
insert into public.geracoes (id, modelo_id, ordem) values ('a2000000-0000-0000-0000-0000000000b1', 'a1000000-0000-0000-0000-0000000000b1', 1);
insert into public.versoes (id, geracao_id, mercado, nome_comercial) values ('a3000000-0000-0000-0000-0000000000b1', 'a2000000-0000-0000-0000-0000000000b1', 'BR', 'AP BR');
insert into public.pecas_ref (id, classe, montadora_id, codigo, fonte_id, verificado_em, status) values ('a6000000-0000-0000-0000-0000000000b1', 'genuina', 'a0000000-0000-0000-0000-0000000000b1', '44444-4AP44', 'f0000000-0000-0000-0000-0000000000f2', now(), 'aprovado');
insert into public.pecas_aplicacoes_tecnicas (id, peca_id, versao_id, periodo_inicio, fonte_id, verificado_em, status) values
  ('a8000000-0000-0000-0000-0000000000b1', 'a6000000-0000-0000-0000-0000000000b1', 'a3000000-0000-0000-0000-0000000000b1', 2014, 'f0000000-0000-0000-0000-0000000000f2', now(), 'aprovado');
select public.recusa($$update public.pecas_aplicacoes_tecnicas set periodo_inicio = 2010 where id = 'a8000000-0000-0000-0000-0000000000b1'$$, 'aplicação aprovada não muda o período automaticamente');
select public.recusa($$update public.pecas_ref set codigo = '99999-9XX99' where id = 'a6000000-0000-0000-0000-0000000000b1'$$, 'peça aprovada não muda o código automaticamente');
select public.recusa($$delete from public.pecas_aplicacoes_tecnicas where id = 'a8000000-0000-0000-0000-0000000000b1'$$, 'aplicação aprovada não é apagada automaticamente');
update public.pecas_aplicacoes_tecnicas set status = 'desatualizado' where id = 'a8000000-0000-0000-0000-0000000000b1';
select public.afirma((select status from public.pecas_aplicacoes_tecnicas where id = 'a8000000-0000-0000-0000-0000000000b1') = 'desatualizado', 'rebaixar para "desatualizado" é permitido (pede nova revisão)');
select public.recusa($$update public.pecas_aplicacoes_tecnicas set status = 'aprovado' where id = 'a8000000-0000-0000-0000-0000000000b1'$$, 'rebaixar e re-aprovar direto é barrado: a re-aprovação é humana');
set local conecta.revisao_humana = 'sim';
update public.pecas_aplicacoes_tecnicas set periodo_inicio = 2015 where id = 'a8000000-0000-0000-0000-0000000000b1';
select public.afirma((select periodo_inicio from public.pecas_aplicacoes_tecnicas where id = 'a8000000-0000-0000-0000-0000000000b1') = 2015, 'a revisão humana explícita (transação própria) consegue corrigir');
rollback;
