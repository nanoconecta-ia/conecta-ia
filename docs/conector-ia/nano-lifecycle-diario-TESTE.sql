begin;
create function pg_temp.afirma(ok boolean,msg text) returns void language plpgsql as $fn$
begin if ok is distinct from true then raise exception 'FALHOU: %',msg; end if; raise notice 'ok: %',msg; end $fn$;
create function pg_temp.recusa(cmd text,msg text) returns void language plpgsql as $fn$
begin
 begin execute cmd; exception when insufficient_privilege then raise notice 'ok: %',msg; return; end;
 raise exception 'FALHOU: aceitou %',msg;
end $fn$;
insert into public.lojas(id,nome,slug) values ('ec000000-0000-0000-0000-000000000001','Nano diário','nano-diario');
insert into public.produtos(loja_id,bling_id,sku,nome,situacao) values ('ec000000-0000-0000-0000-000000000001','123','NANO-D1','Original','A');
insert into public.nano_lifecycle_checkpoint(loja_id,habilitado) values ('ec000000-0000-0000-0000-000000000001',true);
set local role service_role;
select pg_temp.recusa($t$update public.nano_lifecycle_checkpoint set revisao='sync_fake' where loja_id='ec000000-0000-0000-0000-000000000001'$t$,'checkpoint não avança direto');
select pg_temp.recusa($t$insert into public.nano_lifecycle_capturas(loja_id,revisao,estado,eventos,bloqueios) values ('ec000000-0000-0000-0000-000000000001','sync_fake','baseline','[]','[]')$t$,'captura direta bloqueada');
select pg_temp.recusa($t$insert into public.nano_lifecycle_execucoes(loja_id,execucao,geracao) values ('ec000000-0000-0000-0000-000000000001','ec100000-0000-0000-0000-000000000001',99)$t$,'histórico direto bloqueado');
select pg_temp.recusa($t$update public.nano_lifecycle_reserva set encerrada=false where loja_id='ec000000-0000-0000-0000-000000000001'$t$,'reserva direta bloqueada');
select pg_temp.recusa($t$insert into public.nano_lifecycle_varreduras(loja_id,execucao,geracao,grupos,candidatos,digest_projecao) values ('ec000000-0000-0000-0000-000000000001','ec100000-0000-0000-0000-000000000001',1,'{}','[]',repeat('a',64))$t$,'evidência direta bloqueada');
select pg_temp.recusa($t$insert into public.nano_lifecycle_snapshots(loja_id,revisao,execucao,geracao,digest,produtos) values ('ec000000-0000-0000-0000-000000000001','sync_fake','ec100000-0000-0000-0000-000000000001',1,repeat('a',64),'[]')$t$,'snapshot direto bloqueado');
select pg_temp.recusa($t$select nano_lifecycle_interno.nano_lifecycle_registrar('ec000000-0000-0000-0000-000000000001','sync_fake',null,'baseline','[]','[]')$t$,'registrador interno não acessível ao serviço');
select pg_temp.afirma(to_regprocedure('public.nano_lifecycle_registrar(uuid,text,text,text,jsonb,jsonb)') is null,'registrador antigo não exposto');
select pg_temp.afirma(not pg_has_role('service_role','nano_lifecycle_diario','MEMBER'),'serviço sem membership do diário');
select pg_temp.afirma(public.nano_lifecycle_reservar('ec000000-0000-0000-0000-000000000001','ec100000-0000-0000-0000-000000000001')->>'geracao'='1','RPC de reserva autorizada');
select pg_temp.afirma(public.nano_lifecycle_finalizar('ec000000-0000-0000-0000-000000000001','ec100000-0000-0000-0000-000000000001',1,'sync_0001',null,'baseline','[]','[]',repeat('a',64),public.nano_lifecycle_projecao('ec000000-0000-0000-0000-000000000001'))='varredura_nao_confirmada','sem evidência não finaliza');
select pg_temp.afirma(public.nano_lifecycle_registrar_varredura('ec000000-0000-0000-0000-000000000001','ec100000-0000-0000-0000-000000000001',1,'{"ativos":[["123"]],"inativos":[[]],"excluidos":[[]]}')->>'estado'='registrada','RPC de evidência autorizada');
select pg_temp.afirma(public.nano_lifecycle_finalizar('ec000000-0000-0000-0000-000000000001','ec100000-0000-0000-0000-000000000001',1,'sync_0001',null,'baseline','[]','[]',repeat('a',64),public.nano_lifecycle_projecao('ec000000-0000-0000-0000-000000000001'))='gravado','finalização autorizada atômica');
select pg_temp.afirma((select revisao='sync_0001' from public.nano_lifecycle_checkpoint where loja_id='ec000000-0000-0000-0000-000000000001'),'leitura de checkpoint preservada');
select pg_temp.afirma((select encerrada from public.nano_lifecycle_reserva where loja_id='ec000000-0000-0000-0000-000000000001'),'finalização encerra reserva');
select pg_temp.afirma(coalesce(current_setting('nano.lifecycle_fence',true),'')='','escopo restaurado');
reset role;
select pg_temp.afirma((select not rolcanlogin and not rolbypassrls and not rolsuper and not rolcreaterole from pg_roles where rolname='nano_lifecycle_diario'),'diário sem login ou bypass');
select pg_temp.afirma(not has_column_privilege('nano_lifecycle_diario','public.produtos','nome','update') and not has_column_privilege('nano_lifecycle_diario','public.nano_lifecycle_checkpoint','habilitado','update'),'diário sem gravação de produto ou ativação');
select pg_temp.afirma(not has_function_privilege('anon','public.nano_lifecycle_finalizar(uuid,uuid,bigint,text,text,text,jsonb,jsonb,text,jsonb)','execute'),'finalização não pública');
rollback;
