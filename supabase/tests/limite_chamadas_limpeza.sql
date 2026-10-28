-- Testa a limpeza de private.limite_chamadas: só apaga o vencido, retenção por tipo de chave, lotes repetidos com teto de 20, função não exposta, limite_chamada() intacto. Desfaz tudo.
begin;
create or replace function public.afirma(ok boolean, msg text) returns void language plpgsql as
$$ begin if not ok then raise exception 'FALHOU: %', msg; end if; raise notice 'ok: %', msg; end $$;
delete from private.limite_chamadas;

-- 5 vencidas (3 h e 2 h 1 min), 3 recentes (1 h 59 min, 10 min, agora); chaves variadas
insert into private.limite_chamadas (chave, janela, n) values
  ('a', now() - interval '3 hours', 1), ('b', now() - interval '3 hours', 1), ('c', now() - interval '3 hours', 1),
  ('d', now() - interval '2 hours 1 minute', 1), ('e', now() - interval '25 hours', 9),
  ('f', now() - interval '1 hour 59 minutes', 1), ('g', now() - interval '10 minutes', 1), ('h', now(), 1);

-- lote de 2 REPETE até acabar o vencido (5 vencidas = lotes de 2, 2 e 1) em uma execução
select public.afirma(private.limite_chamadas_limpar(2) = 5, 'lote de 2 repete e apaga as 5 vencidas numa execução');
select public.afirma((select count(*) from private.limite_chamadas) = 3, 'sobram 3 linhas');
select public.afirma(private.limite_chamadas_limpar() = 0, 'sem vencidas devolve 0 (idempotente)');
select public.afirma((select array_agg(chave order by chave) from private.limite_chamadas) = array['f','g','h'], 'só as 3 recentes ficam (inclusive a de 1 h 59 min)');
select public.afirma(private.limite_chamadas_limpar(0) = 0 and private.limite_chamadas_limpar(-5) = 0, 'lote zero ou negativo não quebra');

-- retenção POR TIPO DE CHAVE: janela curta (rajada, sem-ip, loja) sai com 10 min; sustentado e outras funções só com 2 h
delete from private.limite_chamadas;
insert into private.limite_chamadas (chave, janela, n) values
  ('pub:loja-publica:ip:rajada:17', now() - interval '30 minutes', 1),       -- apaga
  ('pub:vitrine-assistente:semip:abc', now() - interval '11 minutes', 1),    -- apaga
  ('pub:loja-publica:loja:xyz', now() - interval '15 minutes', 1),           -- apaga
  ('pub:loja-publica:ip:rajada:17', now() - interval '5 minutes', 1),        -- fica
  ('pub:loja-publica:ip:sustentado:17', now() - interval '30 minutes', 1),   -- fica (janela de 1 h)
  ('pub:loja-publica:ip:sustentado:18', now() - interval '3 hours', 1),      -- apaga (2 h)
  ('pair:ip:1', now() - interval '30 minutes', 1),                           -- fica (outra função)
  ('pair:ip:2', now() - interval '3 hours', 1);                              -- apaga (2 h)
select public.afirma(private.limite_chamadas_limpar() = 5, 'apaga as 5 que a regra manda (3 de janela curta com +10 min; sustentado e pair com +2 h)');
select public.afirma((select array_agg(chave order by chave) from private.limite_chamadas) = array['pair:ip:1','pub:loja-publica:ip:rajada:17','pub:loja-publica:ip:sustentado:17'], 'ficam: rajada de 5 min, sustentado de 30 min e pair de 30 min');

-- volume e teto de 20 lotes
delete from private.limite_chamadas;
insert into private.limite_chamadas (chave, janela, n) select 'pub:loja-publica:ip:rajada:'||g, now() - interval '20 minutes', 1 from generate_series(1, 50000) g;
insert into private.limite_chamadas (chave, janela, n) select 'pub:loja-publica:ip:rajada:r'||g, now() - interval '2 minutes', 1 from generate_series(1, 5000) g;
select public.afirma(private.limite_chamadas_limpar() = 50000, 'apaga as 50.000 velhas numa execução (5 lotes de 10.000)');
select public.afirma((select count(*) from private.limite_chamadas) = 5000, 'preserva as 5.000 recentes');
insert into private.limite_chamadas (chave, janela, n) select 'pub:loja-publica:ip:rajada:v'||g, now() - interval '20 minutes', 1 from generate_series(1, 250000) g;
select public.afirma(private.limite_chamadas_limpar() = 200000, 'teto de 20 lotes: apaga 200.000 e deixa o resto para a próxima execução');
select public.afirma(private.limite_chamadas_limpar() = 50000, 'próxima execução termina o atraso');
delete from private.limite_chamadas;

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
