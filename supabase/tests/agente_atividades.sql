-- Atividade do agente externo: imutável, retenção de 90 dias, isolada por loja. Desfaz tudo.
begin;
create or replace function public.afirma(ok boolean, msg text) returns void language plpgsql as
$$ begin if not ok then raise exception 'FALHOU: %', msg; end if; raise notice 'ok: %', msg; end $$;
insert into public.lojas (id, nome, slug) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Loja A', 'loja-a');
insert into public.agente_atividades (loja_id, origem, tipo, ferramenta, resumo) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'gateway_mcp', 'resumo', 'nano.atividade.registrar', 'Verifiquei o CI000016: faltam GTIN e imagem');
select public.afirma((select count(*) from public.agente_atividades) = 1, 'atividade gravada');
do $$ begin begin update public.agente_atividades set resumo = 'x'; raise exception 'aceitou'; exception when check_violation then null; end; end $$;
select public.afirma(true, 'update é recusado (imutável)');
do $$ begin begin delete from public.agente_atividades; raise exception 'aceitou'; exception when check_violation then null; end; end $$;
select public.afirma(true, 'delete antes de 90 dias é recusado');
do $$ begin begin insert into public.agente_atividades (loja_id, origem, tipo, resumo) values ('aaaaaaaa-0000-0000-0000-000000000001', 'gateway_mcp', 'resumo', repeat('a', 601)); raise exception 'aceitou'; exception when check_violation then null; end; end $$;
select public.afirma(true, 'resumo acima de 600 caracteres é recusado');
do $$ begin begin insert into public.agente_atividades (loja_id, origem, tipo) values ('aaaaaaaa-0000-0000-0000-000000000001', 'chat', 'resumo'); raise exception 'aceitou'; exception when check_violation then null; end; end $$;
select public.afirma(true, 'origem fora da lista é recusada');
insert into public.agente_atividades (loja_id, origem, tipo, criado_em) values ('aaaaaaaa-0000-0000-0000-000000000001', 'gateway_mcp', 'consulta', now() - interval '91 days');
delete from public.agente_atividades where criado_em < now() - interval '90 days';
select public.afirma((select count(*) from public.agente_atividades) = 1, 'linha com mais de 90 dias pode ser limpa; a recente fica');
select public.afirma(not has_table_privilege('authenticated', 'public.agente_atividades', 'insert'), 'usuário não insere (só o servidor)');
select public.afirma(not has_table_privilege('authenticated', 'public.agente_atividades', 'update'), 'usuário não altera');
select public.afirma(has_table_privilege('service_role', 'public.agente_atividades', 'insert'), 'servidor insere');
rollback;
