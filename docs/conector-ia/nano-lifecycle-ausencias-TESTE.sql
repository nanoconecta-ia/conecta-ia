begin;
create function pg_temp.afirma(ok boolean,msg text) returns void language plpgsql as $fn$
begin if ok is distinct from true then raise exception 'FALHOU: %',msg; end if; raise notice 'ok: %',msg; end $fn$;
create function pg_temp.recusa(cmd text,msg text) returns void language plpgsql as $fn$
begin
 begin execute cmd; exception when insufficient_privilege or raise_exception then raise notice 'ok: %',msg; return; end;
 raise exception 'FALHOU: aceitou %',msg;
end $fn$;
insert into public.lojas(id,nome,slug) values ('ea000000-0000-0000-0000-000000000001','Nano ausência A','nano-ausencia-a'),('ea000000-0000-0000-0000-000000000002','Nano ausência B','nano-ausencia-b');
insert into public.produtos(loja_id,bling_id,sku,nome,situacao,preco,estoque,publicado) values
 ('ea000000-0000-0000-0000-000000000001','123','NANO-A1','Visto','A',99,3,true),('ea000000-0000-0000-0000-000000000001','124','NANO-A2','Não visto','A',88,2,true),('ea000000-0000-0000-0000-000000000001','125','NANO-A3','Já ausente','ausente',77,1,false),('ea000000-0000-0000-0000-000000000002','126','NANO-A4','Outra loja','A',66,4,true);
insert into public.nano_lifecycle_checkpoint(loja_id,habilitado) values ('ea000000-0000-0000-0000-000000000001',true);
set local role service_role;
select pg_temp.afirma(public.nano_lifecycle_reservar('ea000000-0000-0000-0000-000000000001','ea100000-0000-0000-0000-000000000001')->>'geracao'='1','reserva ativa');
select pg_temp.recusa($t$select public.nano_lifecycle_registrar_varredura('ea000000-0000-0000-0000-000000000001','ea100000-0000-0000-0000-000000000001',1,'{"ativos":[["123"]],"inativos":[[]]}')$t$,'grupo faltante');
select pg_temp.recusa($t$select public.nano_lifecycle_registrar_varredura('ea000000-0000-0000-0000-000000000001','ea100000-0000-0000-0000-000000000001',1,jsonb_build_object('ativos',jsonb_build_array((select jsonb_agg(i::text) from generate_series(1,100) i)),'inativos','[[]]'::jsonb,'excluidos','[[]]'::jsonb))$t$,'página terminal cheia');
select pg_temp.recusa($t$select public.nano_lifecycle_registrar_varredura('ea000000-0000-0000-0000-000000000001','ea100000-0000-0000-0000-000000000001',1,'{"ativos":[["123"],[]],"inativos":[[]],"excluidos":[[]]}')$t$,'página intermediária curta');
select pg_temp.recusa($t$select public.nano_lifecycle_registrar_varredura('ea000000-0000-0000-0000-000000000001','ea100000-0000-0000-0000-000000000001',1,'{"ativos":[["123"]],"inativos":[["123"]],"excluidos":[[]]}')$t$,'ID repetido entre grupos');
select pg_temp.recusa($t$select public.nano_lifecycle_registrar_varredura('ea000000-0000-0000-0000-000000000001','ea100000-0000-0000-0000-000000000001',1,'{"ativos":[[]],"inativos":[[]],"excluidos":[[]]}')$t$,'varredura vazia para loja existente');
select pg_temp.recusa($t$select public.nano_lifecycle_registrar_varredura('ea000000-0000-0000-0000-000000000001','ea100000-0000-0000-0000-000000000001',1,'{"ativos":[["126"]],"inativos":[[]],"excluidos":[[]]}')$t$,'ID de outra loja');
select pg_temp.recusa($t$select public.nano_lifecycle_registrar_varredura('ea000000-0000-0000-0000-000000000001','ea100000-0000-0000-0000-000000000002',1,'{"ativos":[["123"]],"inativos":[[]],"excluidos":[[]]}'::jsonb)$t$,'reserva alheia');
select pg_temp.afirma(public.nano_lifecycle_registrar_varredura('ea000000-0000-0000-0000-000000000001','ea100000-0000-0000-0000-000000000001',1,'{"ativos":[["123"]],"inativos":[[]],"excluidos":[[]]}'::jsonb)->>'estado'='registrada','varredura completa registrada');
select pg_temp.afirma((select jsonb_array_length(candidatos)=1 and candidatos->0->>'bling_id'='124' from public.nano_lifecycle_varreduras where loja_id='ea000000-0000-0000-0000-000000000001' and execucao='ea100000-0000-0000-0000-000000000001'),'somente candidato real do escopo');
select pg_temp.afirma(public.nano_lifecycle_registrar_varredura('ea000000-0000-0000-0000-000000000001','ea100000-0000-0000-0000-000000000001',1,'{"ativos":[["123"]],"inativos":[[]],"excluidos":[[]]}'::jsonb)->>'estado'='ja_registrada','repetição não duplica');
select pg_temp.recusa($t$select public.nano_lifecycle_registrar_varredura('ea000000-0000-0000-0000-000000000001','ea100000-0000-0000-0000-000000000001',1,'{"ativos":[["123","124"]],"inativos":[[]],"excluidos":[[]]}')$t$,'revisão divergente recusada');
select pg_temp.afirma((select count(*)=2 from public.produtos where loja_id='ea000000-0000-0000-0000-000000000001' and situacao='A' and publicado),'nenhum ativo despublicado');
select pg_temp.afirma((select count(*)=1 from public.produtos where loja_id='ea000000-0000-0000-0000-000000000002' and publicado),'outra loja intacta');
select pg_temp.afirma(public.nano_lifecycle_encerrar_reserva('ea000000-0000-0000-0000-000000000001','ea100000-0000-0000-0000-000000000001',1),'reserva encerrada');
select pg_temp.recusa($t$select public.nano_lifecycle_registrar_varredura('ea000000-0000-0000-0000-000000000001','ea100000-0000-0000-0000-000000000001',1,'{"ativos":[["123"]],"inativos":[[]],"excluidos":[[]]}'::jsonb)$t$,'reserva encerrada não registra');
reset role;
select pg_temp.afirma(not has_function_privilege('anon','public.nano_lifecycle_registrar_varredura(uuid,uuid,bigint,jsonb)','execute') and not has_table_privilege('authenticated','public.nano_lifecycle_varreduras','select'),'evidência privada');
rollback;
