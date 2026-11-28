-- Apenas dados fictícios do CI. Rollback ao fim.
begin;
create function pg_temp.afirma(ok boolean,msg text) returns void language plpgsql as $fn$
begin if ok is distinct from true then raise exception 'FALHOU: %',msg; end if; raise notice 'ok: %',msg; end $fn$;
create function pg_temp.recusa(cmd text,msg text) returns void language plpgsql as $fn$
begin
 begin execute cmd; exception when insufficient_privilege or raise_exception then raise notice 'ok: %',msg; return; end;
 raise exception 'FALHOU: aceitou %',msg;
end $fn$;
insert into public.lojas(id,nome,slug) values ('e6000000-0000-0000-0000-000000000001','Nano lote A','nano-lote-a'),('e6000000-0000-0000-0000-000000000002','Nano lote B','nano-lote-b');
insert into public.produtos(loja_id,bling_id,sku,nome,situacao,preco,estoque,publicado) values
 ('e6000000-0000-0000-0000-000000000001','123','NANO-L1','Original','A',99,3,true),
 ('e6000000-0000-0000-0000-000000000002','123','NANO-L1','Outra loja','A',88,2,false);
create temp table lote as select jsonb_build_array(jsonb_build_object('loja_id','e6000000-0000-0000-0000-000000000001','bling_id','123','sku','NANO-L1','nome','Atualizado','situacao','A','categoria_bling_id',null,'marca','Marca teste','gtin',null,'descricao_curta',null,'descricao_complementar',null,'peso_kg',null,'largura_cm',null,'altura_cm',null,'profundidade_cm',null,'formato',null,'pai_bling_id',null)) dados;
grant select on lote to service_role;
insert into public.nano_lifecycle_checkpoint(loja_id,habilitado) values ('e6000000-0000-0000-0000-000000000001',true);
set local role service_role;
select pg_temp.afirma(public.nano_lifecycle_reservar('e6000000-0000-0000-0000-000000000001','e6100000-0000-0000-0000-000000000001')->>'geracao'='1','reserva ativa');
select pg_temp.recusa($t$select public.nano_lifecycle_gravar_tecnico('e6000000-0000-0000-0000-000000000001','e6100000-0000-0000-0000-000000000002',1,(select dados from lote))$t$,'execução alheia');
select pg_temp.recusa($t$select public.nano_lifecycle_gravar_tecnico('e6000000-0000-0000-0000-000000000001','e6100000-0000-0000-0000-000000000001',1,(select jsonb_set(dados,'{0,loja_id}','"e6000000-0000-0000-0000-000000000002"') from lote))$t$,'lote de outra loja');
select pg_temp.recusa($t$select public.nano_lifecycle_gravar_tecnico('e6000000-0000-0000-0000-000000000001','e6100000-0000-0000-0000-000000000001',1,(select jsonb_set(dados,'{0,preco}','1') from lote))$t$,'preço extra proibido');
select pg_temp.recusa($t$select public.nano_lifecycle_gravar_tecnico('e6000000-0000-0000-0000-000000000001','e6100000-0000-0000-0000-000000000001',1,(select jsonb_set(dados,'{0,publicado}','true') from lote))$t$,'publicação extra proibida');
select pg_temp.recusa($t$select public.nano_lifecycle_gravar_tecnico('e6000000-0000-0000-0000-000000000001','e6100000-0000-0000-0000-000000000001',1,(select dados||dados from lote))$t$,'ID duplicado');
select pg_temp.recusa($t$select public.nano_lifecycle_gravar_tecnico('e6000000-0000-0000-0000-000000000001','e6100000-0000-0000-0000-000000000001',1,(select jsonb_set(jsonb_set(dados,'{0,bling_id}','"456"'),'{0,sku}','"nano-l1"') from lote))$t$,'colisão SKU independente de maiúsculas');
select pg_temp.afirma((select nome='Original' and preco=99 and estoque=3 and publicado from public.produtos where loja_id='e6000000-0000-0000-0000-000000000001' and bling_id='123'),'recusas não alteram original');
select pg_temp.afirma(public.nano_lifecycle_gravar_tecnico('e6000000-0000-0000-0000-000000000001','e6100000-0000-0000-0000-000000000001',1,(select dados from lote))=1,'lote técnico válido');
select pg_temp.afirma((select nome='Atualizado' and preco=99 and estoque=3 and publicado from public.produtos where loja_id='e6000000-0000-0000-0000-000000000001' and bling_id='123'),'campos comerciais preservados');
select pg_temp.afirma((select nome='Outra loja' and preco=88 from public.produtos where loja_id='e6000000-0000-0000-0000-000000000002' and bling_id='123'),'outra loja preservada');
select pg_temp.afirma(public.nano_lifecycle_gravar_tecnico('e6000000-0000-0000-0000-000000000001','e6100000-0000-0000-0000-000000000001',1,(select jsonb_set(jsonb_set(dados,'{0,bling_id}','"456"'),'{0,sku}','"NANO-L2"') from lote))=1,'novo SKU técnico');
select pg_temp.afirma((select preco is null and estoque is null and not publicado from public.produtos where loja_id='e6000000-0000-0000-0000-000000000001' and bling_id='456'),'novo SKU sem preço saldo ou publicação');
select pg_temp.afirma(public.nano_lifecycle_gravar_tecnico('e6000000-0000-0000-0000-000000000001','e6100000-0000-0000-0000-000000000001',1,(select jsonb_set(dados,'{0,situacao}','"I"') from lote))=1,'inativação espelhada');
select pg_temp.afirma((select situacao='I' and not publicado and preco=99 and estoque=3 from public.produtos where loja_id='e6000000-0000-0000-0000-000000000001' and bling_id='123'),'inativo despublicado sem alterar financeiro');
select pg_temp.afirma(public.nano_lifecycle_encerrar_reserva('e6000000-0000-0000-0000-000000000001','e6100000-0000-0000-0000-000000000001',1),'encerra reserva');
select pg_temp.recusa($t$select public.nano_lifecycle_gravar_tecnico('e6000000-0000-0000-0000-000000000001','e6100000-0000-0000-0000-000000000001',1,(select dados from lote))$t$,'executor encerrado não grava');
reset role;
select pg_temp.afirma(not has_function_privilege('anon','public.nano_lifecycle_gravar_tecnico(uuid,uuid,bigint,jsonb)','execute') and not has_function_privilege('authenticated','public.nano_lifecycle_gravar_tecnico(uuid,uuid,bigint,jsonb)','execute'),'RPC privada');
rollback;
