-- Executado somente no Postgres descartável, fixture sintética.
begin;
insert into public.lojas(id,nome,slug) values ('e1050000-0000-0000-0000-000000000001','CI decisão A','ci-decisao-a'),('e1050000-0000-0000-0000-000000000002','CI decisão B','ci-decisao-b');
insert into public.produtos(id,loja_id,bling_id,sku,nome,publicado) values ('e1051000-0000-0000-0000-000000000001','e1050000-0000-0000-0000-000000000001','105','CI-105','Peça teste',true);
insert into public.produto_aplicacoes(id,loja_id,produto_id,modelo,status,fonte,coletado_em,pagina_indexavel,pagina_slug)
values ('e1052000-0000-0000-0000-000000000001','e1050000-0000-0000-0000-000000000001','e1051000-0000-0000-0000-000000000001','Modelo teste','aprovado','fixture',now(),true,'ci-decisao-105');
do $$ begin
 if has_function_privilege('anon','public.aplicacao_decidir(uuid,uuid,uuid,text)','EXECUTE') or has_function_privilege('authenticated','public.aplicacao_decidir(uuid,uuid,uuid,text)','EXECUTE') or not has_function_privilege('service_role','public.aplicacao_decidir(uuid,uuid,uuid,text)','EXECUTE') then raise exception 'permissão indevida'; end if;
 raise notice 'ok: CAT-105-01 escopos preservados';
end $$;
set local role service_role;
do $$ begin
 begin perform public.aplicacao_decidir('e1050000-0000-0000-0000-000000000002','e1052000-0000-0000-0000-000000000001','e1053000-0000-0000-0000-000000000001','rejeitar');raise exception 'escopo indevido';exception when no_data_found then null;end;
 begin perform public.aplicacao_decidir('e1050000-0000-0000-0000-000000000001','e1052000-0000-0000-0000-000000000001',null,'aprovar');raise exception 'ator indevido';exception when invalid_parameter_value then null;end;
 raise notice 'ok: CAT-105-02 escopo e ator nulo rejeitados';
end $$;
select public.aplicacao_decidir('e1050000-0000-0000-0000-000000000001','e1052000-0000-0000-0000-000000000001','e1053000-0000-0000-0000-000000000001','rejeitar');
reset role;
do $$ begin
 if not exists(select 1 from public.produto_aplicacoes where id='e1052000-0000-0000-0000-000000000001' and status='rejeitado' and not pagina_indexavel) then raise exception 'revogação falhou';end if;
 if not exists(select 1 from public.auditoria where loja_id='e1050000-0000-0000-0000-000000000001' and acao='aplicacao.rejeitar' and antes->>'status'='aprovado' and antes->>'pagina_indexavel'='true' and depois->>'status'='rejeitado' and depois->>'pagina_indexavel'='false') then raise exception 'auditoria incorreta';end if;
 raise notice 'ok: CAT-105-03 rejeição revoga visibilidade atomicamente';
end $$;
set local role service_role;
select public.aplicacao_decidir('e1050000-0000-0000-0000-000000000001','e1052000-0000-0000-0000-000000000001','e1053000-0000-0000-0000-000000000001','aprovar');
reset role;
do $$ begin
 if not exists(select 1 from public.produto_aplicacoes where id='e1052000-0000-0000-0000-000000000001' and status='aprovado' and not pagina_indexavel) then raise exception 'reaprovação republicou';end if;
 if (select count(*) from public.auditoria where loja_id='e1050000-0000-0000-0000-000000000001' and tabela='produto_aplicacoes')<>2 then raise exception 'histórico indevido';end if;
 if not exists(select 1 from public.auditoria a join public.auditoria b on a.loja_id=b.loja_id where a.loja_id='e1050000-0000-0000-0000-000000000001' and a.acao='aplicacao.rejeitar' and b.acao='aplicacao.aprovar' and a.depois=b.antes and a.id<b.id) then raise exception 'cadeia quebrada';end if;
 raise notice 'ok: CAT-105-04 reaprovação não republica e preserva cadeia';
end $$;
rollback;
