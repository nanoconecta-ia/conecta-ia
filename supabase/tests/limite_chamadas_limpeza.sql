-- Testa a limpeza de private.limite_chamadas: só apaga o vencido, respeita lote, não exposta, limite_chamada() intacto. Desfaz tudo.
begin;
create or replace function public.afirma(ok boolean, msg text) returns void language plpgsql as
$$ begin if not ok then raise exception 'FALHOU: %', msg; end if; raise notice 'ok: %', msg; end $$;
delete from private.limite_chamadas;

-- 5 vencidas (3 h e 2 h 1 min), 3 recentes (1 h 59 min, 10 min, agora); chaves variadas
insert into private.limite_chamadas (chave, janela, n) values
  ('a', now() - interval '3 hours', 1), ('b', now() - interval '3 hours', 1), ('c', now() - interval '3 hours', 1),
  ('d', now() - interval '2 hours 1 minute', 1), ('e', now() - interval '25 hours', 9),
  ('f', now() - interval '1 hour 59 minutes', 1), ('g', now() - interval '10 minutes', 1), ('h', now(), 1);

select public.afirma(private.limite_chamadas_limpar(2) = 2, 'lote de 2 apaga exatamente 2 vencidas');
select public.afirma((select count(*) from private.limite_chamadas) = 6, 'sobram 6 linhas depois do primeiro lote');
select public.afirma(private.limite_chamadas_limpar() = 3, 'segunda chamada apaga as 3 vencidas restantes');
select public.afirma(private.limite_chamadas_limpar() = 0, 'sem vencidas devolve 0 (idempotente)');
select public.afirma((select array_agg(chave order by chave) from private.limite_chamadas) = array['f','g','h'], 'só as 3 recentes ficam (inclusive a de 1 h 59 min)');
select public.afirma(private.limite_chamadas_limpar(0) = 0 and private.limite_chamadas_limpar(-5) = 0, 'lote zero ou negativo não quebra');

-- o limitador continua contando igual depois da limpeza
select public.afirma(public.limite_chamada('t', 2, 60) and public.limite_chamada('t', 2, 60) and not public.limite_chamada('t', 2, 60), 'limite_chamada() segue contando e negando');

-- permissões e índice
select public.afirma(not has_function_privilege('anon', 'private.limite_chamadas_limpar(int)', 'execute'), 'anon não executa');
select public.afirma(not has_function_privilege('authenticated', 'private.limite_chamadas_limpar(int)', 'execute'), 'authenticated não executa');
select public.afirma(not has_function_privilege('service_role', 'private.limite_chamadas_limpar(int)', 'execute'), 'service_role não executa (só o cron do dono)');
select public.afirma(exists (select 1 from pg_indexes where schemaname = 'private' and indexname = 'limite_chamadas_janela_idx'), 'índice por janela existe');
select public.afirma((select prosecdef from pg_proc where oid = 'private.limite_chamadas_limpar(int)'::regprocedure), 'função é security definer');
select public.afirma(exists (select 1 from pg_proc p, unnest(p.proconfig) c where p.oid = 'private.limite_chamadas_limpar(int)'::regprocedure and c = 'search_path=""'), 'search_path vazio');
rollback;
