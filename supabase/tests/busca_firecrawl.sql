-- Testa a chave da busca Firecrawl por loja: isolamento, limite mensal, virada de mês e remoção do segredo. Desfaz tudo.
begin;
create or replace function public.afirma(ok boolean, msg text) returns void language plpgsql as
$$ begin if not ok then raise exception 'FALHOU: %', msg; end if; raise notice 'ok: %', msg; end $$;
insert into public.lojas (id, nome, slug) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Loja A', 'loja-a'), ('bbbbbbbb-0000-0000-0000-000000000002', 'Loja B', 'loja-b');
\set A '\'aaaaaaaa-0000-0000-0000-000000000001\''
\set B '\'bbbbbbbb-0000-0000-0000-000000000002\''

select public.busca_firecrawl_salvar(:A, 'v2.k1.cifrado', 'ab12', 300);
select public.afirma((select chave_cifrada from public.busca_firecrawl_ler(:A)) = 'v2.k1.cifrado', 'chave salva e lida pelo servidor');
select public.afirma((select count(*) from public.busca_firecrawl_ler(:B)) = 0, 'outra loja não enxerga a chave');
select public.afirma((select limite_mensal from public.busca_firecrawl_ler(:A)) = 300, 'limite mensal guardado');

select public.busca_firecrawl_registrar(:A, 1);
select public.busca_firecrawl_registrar(:A, 2);
select public.afirma((select buscas_mes from public.busca_firecrawl_ler(:A)) = 3, 'uso acumulado no mês');
select public.busca_firecrawl_registrar(:A, -5);
select public.afirma((select buscas_mes from public.busca_firecrawl_ler(:A)) = 3, 'uso negativo é ignorado');

update public.loja_busca_firecrawl set mes_ref = (date_trunc('month', now()) - interval '1 month')::date where loja_id = :A;
select public.afirma((select buscas_mes from public.busca_firecrawl_ler(:A)) = 0, 'consumo zera na virada do mês');

select public.busca_firecrawl_desativar(:A);
select public.afirma((select count(*) from public.busca_firecrawl_ler(:A)) = 0, 'desativar some da leitura');
select public.afirma((select chave_cifrada from private.busca_firecrawl_segredos where loja_id = :A) = '', 'desativar apaga o segredo');
select public.afirma((select final_chave from public.loja_busca_firecrawl where loja_id = :A) is null, 'desativar apaga o final da chave');

do $$ begin begin perform public.busca_firecrawl_salvar('aaaaaaaa-0000-0000-0000-000000000001', 'x', 'ab12', 5); raise exception 'aceitou'; exception when check_violation then null; end; end $$;
select public.afirma(true, 'limite abaixo de 10 é recusado');
do $$ begin begin perform public.busca_firecrawl_salvar('aaaaaaaa-0000-0000-0000-000000000001', 'x', 'abc', 100); raise exception 'aceitou'; exception when check_violation then null; end; end $$;
select public.afirma(true, 'final de chave com tamanho errado é recusado');
rollback;
