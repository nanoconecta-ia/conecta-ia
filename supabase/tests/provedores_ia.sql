-- Vários provedores por loja: principal, base_url, leitura da chave ativa. Duas lojas fictícias; desfaz tudo.
begin;
create or replace function public.afirma(ok boolean, msg text) returns void language plpgsql as
$$ begin if not ok then raise exception 'FALHOU: %', msg; end if; raise notice 'ok: %', msg; end $$;
insert into public.lojas (id, nome, slug) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Loja A', 'loja-a'), ('bbbbbbbb-0000-0000-0000-000000000002', 'Loja B', 'loja-b');
\set A '\'aaaaaaaa-0000-0000-0000-000000000001\''
\set B '\'bbbbbbbb-0000-0000-0000-000000000002\''

select public.ia_salvar_chave(:A, 'gemini', 'v2.k1.g', 'gggg', 'gemini-x', null, null);
select public.afirma((select principal from public.loja_chaves_ia where loja_id = :A and provedor = 'gemini'), 'o primeiro provedor salvo vira o principal');
select public.ia_salvar_chave(:A, 'compativel_openai', 'v2.k1.l', 'llll', 'llama-x', 5000, 'https://api.groq.com/openai/v1');
select public.afirma(not (select principal from public.loja_chaves_ia where loja_id = :A and provedor = 'compativel_openai'), 'o segundo não toma o lugar do principal');
select public.afirma((select provedor from public.ia_chave_ativa(:A)) = 'gemini', 'sem pedido, devolve o principal');
select public.afirma((select base_url from public.ia_chave_ativa(:A, 'compativel_openai')) = 'https://api.groq.com/openai/v1', 'pedindo o provedor, devolve a base_url dele');
select public.afirma((select count(*) from public.ia_chave_ativa(:B)) = 0, 'outra loja não enxerga as chaves');

select public.afirma(public.ia_definir_principal(:A, 'compativel_openai'), 'trocar o principal');
select public.afirma((select count(*) from public.loja_chaves_ia where loja_id = :A and principal) = 1, 'só um principal por loja');
select public.afirma((select provedor from public.ia_chave_ativa(:A)) = 'compativel_openai', 'principal novo é o devolvido');
select public.afirma(not public.ia_definir_principal(:B, 'gemini'), 'não define principal de provedor sem chave');
select public.afirma(not public.ia_definir_principal(:A, 'claude'), 'não define principal de provedor não cadastrado');

select public.ia_desativar_chave(:A, 'compativel_openai');
select public.afirma((select provedor from public.ia_chave_ativa(:A)) = 'gemini', 'sem principal ativo, cai em outro provedor ativo');
select public.afirma((select principal from public.loja_chaves_ia where loja_id = :A and provedor = 'gemini'), 'desativar o principal promove o próximo provedor ativo');
select public.ia_salvar_chave(:A, 'compativel_openai', 'v2.k1.l2', 'l2l2', 'llama-y', null, 'https://api.groq.com/openai/v1');
select public.afirma((select principal from public.loja_chaves_ia where loja_id = :A and provedor = 'gemini'), 'reativar não rouba o principal quando há outro ativo');

do $$ begin
  begin perform public.ia_salvar_chave('aaaaaaaa-0000-0000-0000-000000000001', 'compativel_openai', 'x', '1', 'm', null, 'http://sem-tls.com/v1'); raise exception 'aceitou';
  exception when check_violation then null; end;
end $$;
select public.afirma(true, 'base_url http (sem TLS) é recusada');
do $$ begin
  begin perform public.ia_salvar_chave('aaaaaaaa-0000-0000-0000-000000000001', 'compativel_openai', 'x', '1', 'm', null, 'https://a.com/v1?key=1'); raise exception 'aceitou';
  exception when check_violation then null; end;
end $$;
select public.afirma(true, 'base_url com parâmetros é recusada');
rollback;
