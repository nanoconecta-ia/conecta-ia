-- Teste descartável, preserva as fixtures prévias e desfaz todo DML.
begin;
create function pg_temp.afirma(ok boolean,msg text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FALHOU: %',msg; end if; raise notice 'ok: %',msg; end $$;
insert into public.lojas(id,nome,slug) values ('f8200000-0000-0000-0000-000000000001','FIN 82 A','nano-fin-82-a'),('f8200000-0000-0000-0000-000000000002','FIN 82 B','nano-fin-82-b');
insert into public.pipeline_orcamentos(loja_id,mes,limite_usd) values ('f8200000-0000-0000-0000-000000000001',date_trunc('month',now())::date,0.05),('f8200000-0000-0000-0000-000000000002',date_trunc('month',now())::date,0.05);
select pg_temp.afirma(not pg_has_role('service_role','nano_financeiro_escritor','MEMBER'),'serviço não integra autoridade');
select pg_temp.afirma(not has_table_privilege('service_role','public.pipeline_custos','INSERT,UPDATE,DELETE,TRUNCATE,TRIGGER') and not has_table_privilege('service_role','public.pipeline_orcamentos','INSERT,UPDATE,DELETE,TRUNCATE,TRIGGER'),'FIN-02: DML direto negado');
select pg_temp.afirma(not has_table_privilege('nano_financeiro_escritor','nano_financeiro_interno.diario','UPDATE,DELETE,TRUNCATE'),'diário append-only para autoridade');
set local role service_role;
do $$ declare a uuid:='f8200000-0000-0000-0000-000000000001'; b uuid:='f8200000-0000-0000-0000-000000000002'; r bigint;
begin
 begin update public.pipeline_orcamentos set limite_usd=1 where loja_id=a; raise exception 'DML orçamento aceito'; exception when insufficient_privilege then null; end;
 begin insert into public.pipeline_custos(loja_id,capacidade,tipo,usd) values(a,'pesquisador','api',0.01); raise exception 'DML custo aceito'; exception when insufficient_privilege then null; end;
 begin perform public.pipeline_custo_tentar(a,null,'pesquisador','api','fixture',-0.01); raise exception 'estimativa negativa aceita'; exception when sqlstate '22023' then null; end;
 r:=public.pipeline_custo_tentar(a,null,'pesquisador','api','fixture',0.03);
 if r is null then raise exception 'reserva negada'; end if;
 begin perform public.pipeline_custo_confirmar(b,r,0.06,1,0,0,1); raise exception 'confirmação cruzada aceita'; exception when sqlstate 'P0002' then null; end;
 perform public.pipeline_custo_confirmar(a,r,0.06,1,0,0,1);
 if (public.pipeline_orcamento_estado(a)->>'restante_usd')::numeric<>-0.01 then raise exception 'custo real não preservado'; end if;
 if public.pipeline_custo_tentar(a,null,'pesquisador','api','fixture',0) is not null then raise exception 'reserva após excesso aceita'; end if;
 begin perform public.pipeline_custo_confirmar(a,r,0.01,1,0,0,1); raise exception 'confirmação duplicada aceita'; exception when sqlstate 'P0002' then null; end;
 if public.pipeline_custo_tentar(b,null,'pesquisador','api','fixture',0.03) is null then raise exception 'outra loja bloqueada'; end if;
 if public.pipeline_custo_registrar(b,null,'identificador','deterministica','fixture',1) is null then raise exception 'registro zero negado'; end if;
end $$;
reset role;
select pg_temp.afirma((select count(*) from nano_financeiro_interno.diario where loja_id='f8200000-0000-0000-0000-000000000001' and evento='confirmacao' and reservado_usd=0.03 and real_usd=0.06 and saldo_usd=-0.01)=1,'FIN-01: divergência preservada e novas reservas negadas');
select pg_temp.afirma((select count(*) from nano_financeiro_interno.diario where loja_id in ('f8200000-0000-0000-0000-000000000001','f8200000-0000-0000-0000-000000000002'))=4,'diário atômico sem duplicação');
rollback;
select count(*)=0 as fixtures_removidas from public.lojas where id in ('f8200000-0000-0000-0000-000000000001','f8200000-0000-0000-0000-000000000002') \gset
\if :fixtures_removidas
\else
  \quit 1
\endif
