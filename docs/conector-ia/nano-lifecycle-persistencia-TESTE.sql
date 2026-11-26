-- Somente banco descartável do runner; a minuta já foi aplicada.
begin;
create function pg_temp.afirma(ok boolean, msg text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FALHOU: %',msg; end if; raise notice 'ok: %',msg; end $$;
create function pg_temp.recusa(cmd text, msg text) returns void language plpgsql as $$
begin
 begin execute cmd; exception when insufficient_privilege or check_violation or raise_exception then raise notice 'ok: %',msg; return; end;
 raise exception 'FALHOU: aceitou %',msg;
end $$;
insert into public.lojas(id,nome,slug) values
 ('e1000000-0000-0000-0000-000000000001','Lifecycle teste A','nano-teste-a'),
 ('e1000000-0000-0000-0000-000000000002','Lifecycle teste B','nano-teste-b');
insert into public.produtos(id,loja_id,bling_id,sku,nome,situacao) values
 ('e2000000-0000-0000-0000-000000000001','e1000000-0000-0000-0000-000000000001','123','NANO-T1','Filtro fictício','A'),
 ('e2000000-0000-0000-0000-000000000002','e1000000-0000-0000-0000-000000000002','124','NANO-T2','Filtro fictício B','A');
insert into public.nano_lifecycle_checkpoint(loja_id) values('e1000000-0000-0000-0000-000000000001');
select pg_temp.afirma(public.nano_lifecycle_registrar('e1000000-0000-0000-0000-000000000001','sync_0001',null,'baseline','[]','[]')='desabilitado','desligado por padrão');
select pg_temp.afirma(public.nano_lifecycle_registrar('e1000000-0000-0000-0000-000000000002','sync_0001',null,'baseline','[]','[]')='desabilitado','loja sem checkpoint');
update public.nano_lifecycle_checkpoint set habilitado=true where loja_id='e1000000-0000-0000-0000-000000000001';
set local role service_role;
select pg_temp.afirma(public.nano_lifecycle_registrar('e1000000-0000-0000-0000-000000000001','sync_0001',null,'baseline','[]','[]')='gravado','baseline sem backlog');
select pg_temp.afirma(public.nano_lifecycle_registrar('e1000000-0000-0000-0000-000000000001','sync_0001',null,'baseline','[]','[]')='ja_gravado','repetição idempotente');
select pg_temp.afirma(public.nano_lifecycle_registrar('e1000000-0000-0000-0000-000000000001','sync_9999',null,'baseline','[]','[]')='conflito','CAS impede predecessor incorreto');
reset role;
create temp table evento as select jsonb_build_array(jsonb_build_object(
 'produto_id','e2000000-0000-0000-0000-000000000001','loja_id','e1000000-0000-0000-0000-000000000001',
 'bling_id','123','sku','NANO-T1','tipo','novo','campos',jsonb_build_array('nome'),'revisao','sync_0002',
 'idempotency_key','nano-lifecycle:'||repeat('a',64),'destino','pesquisa','pausado_na_captura',true
)) as dados;
grant select on evento to service_role;
set local role service_role;
select pg_temp.recusa($$select public.nano_lifecycle_registrar('e1000000-0000-0000-0000-000000000001','sync_0002','sync_0001','pronto_para_transacao',(select jsonb_set(dados,'{0,preco}','123'::jsonb) from evento),'[]')$$,'campos comerciais extras recusados');
select pg_temp.recusa($$select public.nano_lifecycle_registrar('e1000000-0000-0000-0000-000000000001','sync_0002','sync_0001','pronto_para_transacao',(select jsonb_set(dados,'{0,produto_id}','"e2000000-0000-0000-0000-000000000002"') from evento),'[]')$$,'produto de outra loja recusado');
select pg_temp.recusa($$select public.nano_lifecycle_registrar('e1000000-0000-0000-0000-000000000001','sync_0002','sync_0001','pronto_para_transacao',(select dados||dados from evento),'[]')$$,'evento duplicado recusado');
select pg_temp.recusa($select public.nano_lifecycle_registrar('e1000000-0000-0000-0000-000000000001','sync_0002','sync_0001','pronto_para_transacao',(select jsonb_set(dados,'{0,campos}','[null]'::jsonb) from evento),'[]')$,'campo nulo recusado');
select pg_temp.recusa($select public.nano_lifecycle_registrar('e1000000-0000-0000-0000-000000000001','sync_0002','sync_0001','pronto_para_transacao',(select jsonb_set(dados,'{0,destino}','"revisao_inativacao"'::jsonb) from evento),'[]')$,'destino divergente do tipo recusado');
select pg_temp.afirma((select revisao from public.nano_lifecycle_checkpoint where loja_id='e1000000-0000-0000-0000-000000000001')='sync_0001','erros não avançam checkpoint');
select pg_temp.afirma(public.nano_lifecycle_registrar('e1000000-0000-0000-0000-000000000001','sync_0002','sync_0001','pronto_para_transacao',(select dados from evento),'[]')='gravado','evento pausado preservado');
select pg_temp.afirma(public.nano_lifecycle_registrar('e1000000-0000-0000-0000-000000000001','sync_0002','sync_0001','pronto_para_transacao',(select dados from evento),'[]')='ja_gravado','mesma captura não duplica');
select pg_temp.afirma(public.nano_lifecycle_registrar('e1000000-0000-0000-0000-000000000001','sync_0002','sync_0001','pronto_para_transacao','[]','[]')='conflito','revisão com payload divergente recusada');
select pg_temp.afirma((select count(*) from public.nano_lifecycle_capturas where loja_id='e1000000-0000-0000-0000-000000000001')=2,'somente duas revisões');
select pg_temp.afirma((select eventos->0->>'pausado_na_captura' from public.nano_lifecycle_capturas where loja_id='e1000000-0000-0000-0000-000000000001' and revisao='sync_0002')='true','pausa gravada');
select pg_temp.afirma((select revisao from public.nano_lifecycle_checkpoint where loja_id='e1000000-0000-0000-0000-000000000001')='sync_0002','checkpoint e captura avançam juntos');
select pg_temp.afirma(not exists(select 1 from public.pipeline_itens where loja_id='e1000000-0000-0000-0000-000000000001'),'nenhuma tarefa executada');
select pg_temp.recusa($$update public.nano_lifecycle_capturas set eventos='[]'$$,'service role sem alteração de diário');
reset role;
select pg_temp.afirma(not has_function_privilege('anon','public.nano_lifecycle_registrar(uuid,text,text,text,jsonb,jsonb)','execute'),'anon sem RPC');
select pg_temp.afirma(not has_function_privilege('authenticated','public.nano_lifecycle_registrar(uuid,text,text,text,jsonb,jsonb)','execute'),'authenticated sem RPC');
select pg_temp.afirma(not has_table_privilege('anon','public.nano_lifecycle_capturas','select') and not has_table_privilege('authenticated','public.nano_lifecycle_capturas','select'),'diário privado');
select pg_temp.afirma((select bool_and(relrowsecurity) from pg_class where oid in ('public.nano_lifecycle_capturas'::regclass,'public.nano_lifecycle_checkpoint'::regclass)),'RLS ativa');
rollback;
