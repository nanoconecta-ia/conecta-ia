-- Apenas banco descartável. Dados fictícios, rollback no fim.
begin;
create function pg_temp.afirma(ok boolean,msg text) returns void language plpgsql as $fn$
begin if ok is distinct from true then raise exception 'FALHOU: %',msg; end if; raise notice 'ok: %',msg; end $fn$;
insert into public.lojas(id,nome,slug) values ('e5000000-0000-0000-0000-000000000001','Nano finalização A','nano-finaliza-a'),('e5000000-0000-0000-0000-000000000002','Nano finalização B','nano-finaliza-b');
insert into public.produtos(id,loja_id,bling_id,sku,nome,situacao,preco,estoque) values
 ('e5100000-0000-0000-0000-000000000001','e5000000-0000-0000-0000-000000000001','123','NANO-F1','Filtro teste','A',99,3),
 ('e5100000-0000-0000-0000-000000000002','e5000000-0000-0000-0000-000000000002','124','NANO-F2','Filtro teste B','A',88,2);
insert into public.nano_lifecycle_checkpoint(loja_id,habilitado) values ('e5000000-0000-0000-0000-000000000001',true);
set local role service_role;
select pg_temp.afirma(public.nano_lifecycle_reservar('e5000000-0000-0000-0000-000000000001','e5200000-0000-0000-0000-000000000001')->>'geracao'='1','reserva inicial');
select pg_temp.afirma(jsonb_array_length(public.nano_lifecycle_projecao('e5000000-0000-0000-0000-000000000001'))=1,'projeção da própria loja');
select pg_temp.afirma(not ((public.nano_lifecycle_projecao('e5000000-0000-0000-0000-000000000001')->0) ?| array['preco','estoque','publicado','fornecedor','custo']),'projeção sem campos comerciais');
select pg_temp.afirma(public.nano_lifecycle_finalizar('e5000000-0000-0000-0000-000000000001','e5200000-0000-0000-0000-000000000002',1,'sync_0001',null,'baseline','[]','[]',repeat('a',64),'[]')='reserva_invalida','execução alheia não grava');
select pg_temp.afirma(public.nano_lifecycle_finalizar('e5000000-0000-0000-0000-000000000001','e5200000-0000-0000-0000-000000000001',1,'sync_0001',null,'baseline','[]','[]',repeat('a',64),public.nano_lifecycle_projecao('e5000000-0000-0000-0000-000000000002'))='snapshot_divergente','snapshot de outra loja recusado');
select pg_temp.afirma((select revisao is null from public.nano_lifecycle_checkpoint where loja_id='e5000000-0000-0000-0000-000000000001'),'recusa não altera checkpoint');
select pg_temp.afirma(public.nano_lifecycle_finalizar('e5000000-0000-0000-0000-000000000001','e5200000-0000-0000-0000-000000000001',1,'sync_0001',null,'baseline','[]','[]',repeat('a',64),public.nano_lifecycle_projecao('e5000000-0000-0000-0000-000000000001'))='varredura_nao_confirmada','sem evidência não finaliza');
select pg_temp.afirma(public.nano_lifecycle_registrar_varredura('e5000000-0000-0000-0000-000000000001','e5200000-0000-0000-0000-000000000001',1,'{"ativos":[["123"]],"inativos":[[]],"excluidos":[[]]}')->>'estado'='registrada','evidência da mesma execução');
select pg_temp.afirma(public.nano_lifecycle_finalizar('e5000000-0000-0000-0000-000000000001','e5200000-0000-0000-0000-000000000001',1,'sync_0001',null,'baseline','[]','[]',repeat('a',64),public.nano_lifecycle_projecao('e5000000-0000-0000-0000-000000000001'))='gravado','baseline e snapshot atômicos');
select pg_temp.afirma((select count(*) from public.nano_lifecycle_snapshots s join public.nano_lifecycle_checkpoint c on c.loja_id=s.loja_id and c.revisao=s.revisao where s.loja_id='e5000000-0000-0000-0000-000000000001')=1,'leitura confirma checkpoint e snapshot');
select pg_temp.afirma(not public.nano_lifecycle_fence('e5000000-0000-0000-0000-000000000001','e5200000-0000-0000-0000-000000000001',1),'finalização encerra reserva');
select pg_temp.afirma(public.nano_lifecycle_reservar('e5000000-0000-0000-0000-000000000001','e5200000-0000-0000-0000-000000000002')->>'geracao'='2','segunda geração');
select pg_temp.afirma(public.nano_lifecycle_finalizar('e5000000-0000-0000-0000-000000000001','e5200000-0000-0000-0000-000000000001',1,'sync_0002','sync_0001','pronto_para_transacao','[]','[]',repeat('b',64),public.nano_lifecycle_projecao('e5000000-0000-0000-0000-000000000001'))='reserva_invalida','geração anterior não grava');
select pg_temp.afirma(public.nano_lifecycle_finalizar('e5000000-0000-0000-0000-000000000001','e5200000-0000-0000-0000-000000000002',2,'sync_0002','sync_0001','pronto_para_transacao','[]','[]',repeat('b',64),public.nano_lifecycle_projecao('e5000000-0000-0000-0000-000000000001'))='varredura_nao_confirmada','evidência de geração anterior não autoriza sucessor');
select pg_temp.afirma(public.nano_lifecycle_registrar_varredura('e5000000-0000-0000-0000-000000000001','e5200000-0000-0000-0000-000000000002',2,'{"ativos":[["123"]],"inativos":[[]],"excluidos":[[]]}')->>'estado'='registrada','evidência da nova geração');
-- Simula escritor legado ainda não protegido. A mudança após evidência é recusada.
update public.produtos set nome='Alterado depois da evidência' where loja_id='e5000000-0000-0000-0000-000000000001' and bling_id='123';
select pg_temp.afirma(public.nano_lifecycle_finalizar('e5000000-0000-0000-0000-000000000001','e5200000-0000-0000-0000-000000000002',2,'sync_0002','sync_0001','pronto_para_transacao','[]','[]',repeat('b',64),public.nano_lifecycle_projecao('e5000000-0000-0000-0000-000000000001'))='varredura_divergente','mudança depois da evidência não finaliza');
update public.produtos set nome='Filtro teste' where loja_id='e5000000-0000-0000-0000-000000000001' and bling_id='123';
select pg_temp.afirma(public.nano_lifecycle_finalizar('e5000000-0000-0000-0000-000000000001','e5200000-0000-0000-0000-000000000002',2,'sync_0002','sync_0001','pronto_para_transacao','[]','[]',repeat('b',64),public.nano_lifecycle_projecao('e5000000-0000-0000-0000-000000000001'))='gravado','sucessor com snapshot persistido');
select pg_temp.afirma((select count(*) from public.nano_lifecycle_snapshots where loja_id='e5000000-0000-0000-0000-000000000001')=2,'dois snapshots preservados');
select pg_temp.afirma(not exists(select 1 from public.pipeline_itens where loja_id='e5000000-0000-0000-0000-000000000001'),'não executa pipeline');
reset role;
select pg_temp.afirma(not has_function_privilege('anon','public.nano_lifecycle_projecao(uuid)','execute') and not has_table_privilege('authenticated','public.nano_lifecycle_snapshots','select'),'snapshot e projeção privados');
select pg_temp.afirma((select preco=99 and estoque=3 from public.produtos where id='e5100000-0000-0000-0000-000000000001'),'produto e valores preservados');
rollback;
