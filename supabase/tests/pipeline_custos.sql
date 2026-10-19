-- Testa razão de custos e orçamento mensal com dados FICTÍCIOS; desfaz tudo no fim.
begin;
create or replace function public.afirma(ok boolean, msg text) returns void language plpgsql as
$$ begin if ok is distinct from true then raise exception 'FALHOU: %', msg; end if; raise notice 'ok: %', msg; end $$;
insert into public.lojas (id, nome, slug) values ('f1000000-0000-0000-0000-0000000000a1', 'Custos A', 'cu-a'), ('f1000000-0000-0000-0000-0000000000b2', 'Custos B', 'cu-b');
select public.afirma(public.pipeline_custo_tentar('f1000000-0000-0000-0000-0000000000a1', null, 'pesquisador', 'api', 'conector-x', 0.01) is null, 'sem orçamento definido, nada que custe é autorizado');
insert into public.pipeline_orcamentos (loja_id, mes, limite_usd) values ('f1000000-0000-0000-0000-0000000000a1', date_trunc('month', now())::date, 0.05);
create temp table r1 as select public.pipeline_custo_tentar('f1000000-0000-0000-0000-0000000000a1', null, 'pesquisador', 'api', 'conector-x', 0.03) as id;
select public.afirma((select id from r1) is not null, 'reserva dentro do limite é autorizada');
select public.afirma(public.pipeline_custo_tentar('f1000000-0000-0000-0000-0000000000a1', null, 'taxonomista', 'llm', 'modelo-y', 0.03) is null, 'reserva que estouraria o limite é recusada (nada gravado)');
select public.afirma((select count(*) from public.pipeline_custos) = 1, 'a recusa não deixou rastro de custo');
select public.pipeline_custo_confirmar('f1000000-0000-0000-0000-0000000000a1', (select id from r1), 0.01, 2, 0, 0, 120);
select public.afirma((public.pipeline_orcamento_estado('f1000000-0000-0000-0000-0000000000a1')->>'gasto_usd')::numeric = 0.01, 'confirmar com custo real menor libera o saldo');
select public.afirma(public.pipeline_custo_tentar('f1000000-0000-0000-0000-0000000000a1', null, 'taxonomista', 'llm', 'modelo-y', 0.03) is not null, 'com o saldo liberado a nova reserva passa');
select public.afirma(public.pipeline_custo_tentar('f1000000-0000-0000-0000-0000000000b2', null, 'pesquisador', 'api', 'x', 0.001) is null, 'o orçamento de uma loja não vale para outra (isolamento)');
do $$ begin begin perform public.pipeline_custo_confirmar('f1000000-0000-0000-0000-0000000000b2', (select id from public.pipeline_custos limit 1), 0, 0, 0, 0, 0); raise exception 'aceitou'; exception when sqlstate 'P0002' then null; end; end $$;
select public.afirma(true, 'confirmar custo de outra loja é recusado');
select public.afirma(public.pipeline_custo_registrar('f1000000-0000-0000-0000-0000000000a1', null, 'identificador', 'deterministica', null, 3) is not null, 'capacidade determinística registra tempo com custo zero');
select public.afirma((select sum(usd) from public.pipeline_custos where tipo = 'deterministica') = 0, 'determinística custa 0 USD');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f2000000-0000-0000-0000-000000000009","role":"authenticated"}', true);
do $$ begin begin perform public.pipeline_custo_tentar('f1000000-0000-0000-0000-0000000000a1', null, 'pesquisador', 'api', 'x', 0.001); raise exception 'aceitou'; exception when insufficient_privilege then null; end; end $$;
select public.afirma(true, 'usuário logado não reserva custo');
reset role;
rollback;
