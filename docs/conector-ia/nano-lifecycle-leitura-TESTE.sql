begin;
create function pg_temp.afirma(ok boolean,msg text) returns void language plpgsql as $fn$
begin if ok is distinct from true then raise exception 'FALHOU: %',msg; end if; raise notice 'ok: %',msg; end $fn$;
insert into public.lojas(id,nome,slug) values ('e8000000-0000-0000-0000-000000000001','Nano leitura A','nano-leitura-a'),('e8000000-0000-0000-0000-000000000002','Nano leitura B','nano-leitura-b');
insert into public.produtos(id,loja_id,bling_id,sku,nome,situacao,preco,estoque) values ('e8100000-0000-0000-0000-000000000001','e8000000-0000-0000-0000-000000000001','123','NANO-R1','Filtro teste','A',99,3),('e8100000-0000-0000-0000-000000000002','e8000000-0000-0000-0000-000000000002','124','NANO-R2','Filtro B','A',88,2);
insert into public.nano_lifecycle_checkpoint(loja_id,habilitado) values ('e8000000-0000-0000-0000-000000000001',true);
set local role service_role;
select pg_temp.afirma(public.nano_lifecycle_ler('e8000000-0000-0000-0000-000000000002','checkpoint') is null,'checkpoint inexistente não vira baseline');
select pg_temp.afirma(public.nano_lifecycle_ler('e8000000-0000-0000-0000-000000000001','checkpoint')->>'habilitado'='true','checkpoint habilitado');
select pg_temp.afirma(public.nano_lifecycle_ler('e8000000-0000-0000-0000-000000000001','projecao')->>'total'='1','projeção completa por loja');
select pg_temp.afirma(not ((public.nano_lifecycle_ler('e8000000-0000-0000-0000-000000000001','projecao')->'produtos'->0) ?| array['preco','estoque']),'projeção sem financeiro');
select pg_temp.afirma(public.nano_lifecycle_ler('e8000000-0000-0000-0000-000000000001','pausas')->>'total'='0','pausas sem registros');
select pg_temp.afirma(public.nano_lifecycle_ler('e8000000-0000-0000-0000-000000000001','snapshot','sync_0001') is null,'snapshot ausente');
select pg_temp.afirma(public.nano_lifecycle_ler('e8000000-0000-0000-0000-000000000001','captura','sync_0001') is null,'captura ausente');
reset role;
select pg_temp.afirma(not has_function_privilege('anon','public.nano_lifecycle_ler(uuid,text,text)','execute') and not has_function_privilege('authenticated','public.nano_lifecycle_ler(uuid,text,text)','execute'),'RPC de leitura privada');
rollback;
