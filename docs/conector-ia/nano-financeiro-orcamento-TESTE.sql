-- Teste SQL reversível, apenas no PostgreSQL descartável.
begin;
create function pg_temp.afirma(ok boolean,msg text) returns void language plpgsql as $fin$
begin if ok is distinct from true then raise exception 'FALHOU: %',msg; end if; raise notice 'ok: %',msg; end $fin$;
insert into public.lojas(id,nome,slug) values ('f8600000-0000-0000-0000-000000000001','FIN 86 A','nano-fin-86-a'),('f8600000-0000-0000-0000-000000000002','FIN 86 B','nano-fin-86-b');
select pg_temp.afirma(not exists(select 1 from pg_roles where rolname in ('nano_orcamento_operador','nano_orcamento_escritor') and (rolcanlogin or rolsuper or rolbypassrls or rolcreaterole)),'FIN-86-01: papéis restritos');
select pg_temp.afirma(not exists(select 1 from unnest(array['anon','authenticated','service_role','nano_financeiro_escritor']) p where pg_has_role(p,'nano_orcamento_operador','MEMBER') or pg_has_role(p,'nano_orcamento_escritor','MEMBER') or has_function_privilege(p,'nano_financeiro_interno.definir_teto(uuid,date,numeric,text)','EXECUTE') or has_any_column_privilege(p,'public.pipeline_orcamentos','INSERT,UPDATE') or has_table_privilege(p,'public.pipeline_orcamentos','DELETE,TRUNCATE,TRIGGER')),'FIN-86-02: agentes sem autoridade');
select pg_temp.afirma(not has_any_column_privilege('nano_orcamento_operador','public.pipeline_orcamentos','INSERT,UPDATE') and not has_any_column_privilege('nano_orcamento_escritor','public.pipeline_custos','INSERT,UPDATE') and not has_table_privilege('nano_orcamento_escritor','public.pipeline_custos','DELETE,TRUNCATE,TRIGGER') and not has_table_privilege('nano_orcamento_escritor','nano_financeiro_interno.diario_orcamento','UPDATE,DELETE,TRUNCATE'),'FIN-86-03: poderes separados e diário append-only');
set local role nano_orcamento_operador;
select nano_financeiro_interno.definir_teto('f8600000-0000-0000-0000-000000000001',date_trunc('month',now())::date,0.05,'fixture criação');
select nano_financeiro_interno.definir_teto('f8600000-0000-0000-0000-000000000001',date_trunc('month',now())::date,0.04,'fixture revisão');
select nano_financeiro_interno.definir_teto('f8600000-0000-0000-0000-000000000001',date_trunc('month',now())::date,0.04,'fixture repetição');
do $fin$ begin
 begin
 perform nano_financeiro_interno.definir_teto('f8600000-0000-0000-0000-000000000001',date_trunc('month',now())::date,0.04001,'fixture inválida');
 raise exception 'precisão indevida aceita';
 exception when sqlstate '22023' then null; end;
 begin
 update public.pipeline_orcamentos set limite_usd=0;
 raise exception 'DML de operador aceito';
 exception when insufficient_privilege then null; end;
end $fin$;
reset role;
set local role service_role;
do $fin$ begin
 begin
 perform nano_financeiro_interno.definir_teto('f8600000-0000-0000-0000-000000000001',date_trunc('month',now())::date,1,'fixture ataque');
 raise exception 'agente alterou teto';
 exception when insufficient_privilege then null; end;
 if public.pipeline_custo_tentar('f8600000-0000-0000-0000-000000000001',null,'pesquisador','api','fixture-fin-86',0.05) is not null then raise exception 'teto revisado ignorado'; end if;
 if public.pipeline_custo_tentar('f8600000-0000-0000-0000-000000000002',null,'pesquisador','api','fixture-fin-86',0.01) is not null then raise exception 'outra loja obteve teto indevido'; end if;
end $fin$;
reset role;
select pg_temp.afirma((select count(*) from nano_financeiro_interno.diario_orcamento where loja_id='f8600000-0000-0000-0000-000000000001')=2 and (select count(*) from nano_financeiro_interno.diario_orcamento where loja_id='f8600000-0000-0000-0000-000000000001' and anterior_usd is null and novo_usd=0.05)=1 and (select count(*) from nano_financeiro_interno.diario_orcamento where loja_id='f8600000-0000-0000-0000-000000000001' and anterior_usd=0.05 and novo_usd=0.04)=1,'FIN-86-04: histórico exato, repetição sem evento');
rollback;
