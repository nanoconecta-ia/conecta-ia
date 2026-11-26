begin;
create function pg_temp.afirma(ok boolean,msg text) returns void language plpgsql as $fn$
begin if ok is distinct from true then raise exception 'FALHOU: %',msg; end if; raise notice 'ok: %',msg; end $fn$;
create function pg_temp.recusa(cmd text,msg text) returns void language plpgsql as $fn$
begin
 begin execute cmd; exception when insufficient_privilege or raise_exception then raise notice 'ok: %',msg; return; end;
 raise exception 'FALHOU: aceitou %',msg;
end $fn$;
insert into public.lojas(id,nome,slug) values ('e9000000-0000-0000-0000-000000000001','Nano espelho A','nano-espelho-a'),('e9000000-0000-0000-0000-000000000002','Nano espelho B','nano-espelho-b');
insert into public.produtos(id,loja_id,bling_id,sku,nome,situacao,preco,estoque,publicado,protegido_por_nf) values ('e9200000-0000-0000-0000-000000000001','e9000000-0000-0000-0000-000000000001','123','NANO-M1','Original','A',99,3,true,true);
insert into public.produtos(loja_id,bling_id,sku,nome,situacao,preco,estoque) values ('e9000000-0000-0000-0000-000000000002','123','NANO-M1','Outra loja','A',88,2);
create temp table lote as select '[{"loja_id":"e9000000-0000-0000-0000-000000000001","bling_id":"123","sku":"NANO-M1","nome":"Atualizado","preco":120.5,"estoque":7,"situacao":"A","categoria_bling_id":null,"marca":null,"gtin":null,"gtin_tributario":"7891234567890","descricao_curta":null,"descricao_complementar":null,"peso_kg":null,"largura_cm":null,"altura_cm":null,"profundidade_cm":null,"unidade":"UN","condicao":"1","formato":null,"pai_bling_id":null,"volumes":2,"sincronizado_em":"2026-11-26T12:00:00Z"}]'::jsonb dados;
grant select on lote to service_role;
insert into public.nano_lifecycle_checkpoint(loja_id,habilitado) values ('e9000000-0000-0000-0000-000000000001',true);
set local role service_role;
select pg_temp.afirma(public.nano_lifecycle_reservar('e9000000-0000-0000-0000-000000000001','e9100000-0000-0000-0000-000000000001')->>'geracao'='1','reserva inicial');
select pg_temp.recusa($t$select public.nano_lifecycle_gravar_espelho('e9000000-0000-0000-0000-000000000001','e9100000-0000-0000-0000-000000000001',1,(select jsonb_set(dados,'{0,custo}','1') from lote))$t$,'custo extra recusado');
select pg_temp.recusa($t$select public.nano_lifecycle_gravar_espelho('e9000000-0000-0000-0000-000000000001','e9100000-0000-0000-0000-000000000001',1,(select jsonb_set(dados,'{0,publicado}','true') from lote))$t$,'publicação extra recusada');
select pg_temp.recusa($t$select public.nano_lifecycle_gravar_espelho('e9000000-0000-0000-0000-000000000001','e9100000-0000-0000-0000-000000000001',1,(select jsonb_build_array(dados->0-'estoque') from lote))$t$,'lote incompleto recusado');
select pg_temp.recusa($t$select public.nano_lifecycle_gravar_espelho('e9000000-0000-0000-0000-000000000001','e9100000-0000-0000-0000-000000000001',1,(select jsonb_set(dados,'{0,loja_id}','"e9000000-0000-0000-0000-000000000002"') from lote))$t$,'escopo divergente recusado');
select pg_temp.afirma(public.nano_lifecycle_gravar_espelho('e9000000-0000-0000-0000-000000000001','e9100000-0000-0000-0000-000000000001',1,(select dados from lote)) = 1,'lote integral confirmado');
select pg_temp.afirma((select nome='Atualizado' and preco=120.5 and estoque=7 and gtin_tributario='7891234567890' and unidade='UN' and condicao='1' and volumes=2 and sincronizado_em='2026-11-26T12:00:00Z'::timestamptz and publicado and protegido_por_nf from public.produtos where id='e9200000-0000-0000-0000-000000000001'),'identidade e espelho integral preservados');
select pg_temp.afirma((select nome='Outra loja' and preco=88 and estoque=2 from public.produtos where loja_id='e9000000-0000-0000-0000-000000000002'),'outra loja não alterada');
select pg_temp.afirma(public.nano_lifecycle_gravar_espelho('e9000000-0000-0000-0000-000000000001','e9100000-0000-0000-0000-000000000001',1,(select jsonb_set(jsonb_set(dados,'{0,bling_id}','"456"'),'{0,sku}','null') from lote)) = 1,'novo SKU sem publicação automática');
select pg_temp.afirma((select sku is null and not publicado and preco=120.5 and estoque=7 from public.produtos where loja_id='e9000000-0000-0000-0000-000000000001' and bling_id='456'),'cadastro sem SKU permanece privado');
select pg_temp.afirma(public.nano_lifecycle_gravar_espelho('e9000000-0000-0000-0000-000000000001','e9100000-0000-0000-0000-000000000001',1,(select jsonb_set(dados,'{0,situacao}','"I"') from lote)) = 1,'inativação preserva regra existente');
select pg_temp.afirma((select not publicado and situacao='I' from public.produtos where id='e9200000-0000-0000-0000-000000000001'),'inativo despublicado');
select pg_temp.afirma(public.nano_lifecycle_encerrar_reserva('e9000000-0000-0000-0000-000000000001','e9100000-0000-0000-0000-000000000001',1),'encerra reserva');
select pg_temp.recusa($t$select public.nano_lifecycle_gravar_espelho('e9000000-0000-0000-0000-000000000001','e9100000-0000-0000-0000-000000000001',1,(select dados from lote))$t$,'execução encerrada não grava');
reset role;
select pg_temp.afirma(not has_function_privilege('anon','public.nano_lifecycle_gravar_espelho(uuid,uuid,bigint,jsonb)','execute') and not has_function_privilege('authenticated','public.nano_lifecycle_gravar_espelho(uuid,uuid,bigint,jsonb)','execute'),'RPC privada');
rollback;
