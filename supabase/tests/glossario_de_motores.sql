-- PR #242: glossario_de_motores() só lê, só service_role, e devolve os motores do cadastro com aplicação e status. Desfaz tudo.
begin;
create or replace function public.afirma(ok boolean, msg text) returns void language plpgsql as
$$ begin if not ok then raise exception 'FALHOU: %', msg; end if; raise notice 'ok: %', msg; end $$;
select public.afirma((public.glossario_de_motores() -> 'termos') = '[]'::jsonb, 'sem motores cadastrados = lista vazia (nunca presume)');
select public.afirma(not has_function_privilege('anon', 'public.glossario_de_motores()', 'execute'), 'anon não executa');
select public.afirma(not has_function_privilege('authenticated', 'public.glossario_de_motores()', 'execute'), 'usuário logado não executa');
select public.afirma(has_function_privilege('service_role', 'public.glossario_de_motores()', 'execute'), 'service_role executa');
insert into public.familias_motor (id, nome) values ('f0000000-0000-0000-0000-000000000001', '4D56');
insert into public.motores (id, familia_id, codigo, cilindrada_cc) values ('e0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', '4D56', 2500);
select public.afirma((public.glossario_de_motores() -> 'termos' -> 0 ->> 'codigo') = '4D56', 'motor cadastrado aparece');
select public.afirma((public.glossario_de_motores() -> 'termos' -> 0 ->> 'status') = 'a_confirmar', 'o status do cadastro acompanha o termo');
select public.afirma((public.glossario_de_motores() -> 'termos' -> 0 ->> 'cilindrada') = '2.5', 'cilindrada em litros');
rollback;
