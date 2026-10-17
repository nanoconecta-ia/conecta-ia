-- Testa a PARTE 1 da proposta propostas/20261018000001_bling_renovacao_automatica.sql (reserva e RPCs).
-- Pré-requisito local: migrações 1–19 + parte 1 aplicada:
--   sed '/===== PARTE 2/,$d' propostas/20261018000001_bling_renovacao_automatica.sql | psql -v ON_ERROR_STOP=1 -d t
begin;
create or replace function public.afirma(ok boolean, msg text) returns void language plpgsql as
$$ begin if not ok then raise exception 'FALHOU: %', msg; end if; raise notice 'ok: %', msg; end $$;

insert into public.lojas (id, nome, slug) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Loja A', 'loja-a'), ('bbbbbbbb-0000-0000-0000-000000000002', 'Loja B', 'loja-b'),
  ('cccccccc-0000-0000-0000-000000000003', 'Loja C', 'loja-c');
select public.bling_salvar_credenciais('aaaaaaaa-0000-0000-0000-000000000001', 'a1', 'r1', now() + interval '10 minutes');
select public.bling_salvar_credenciais('bbbbbbbb-0000-0000-0000-000000000002', 'a2', 'r2', now() + interval '5 hours');
select public.bling_salvar_credenciais('cccccccc-0000-0000-0000-000000000003', 'a3', 'r3', now() + interval '10 minutes');
select public.bling_marcar_status('cccccccc-0000-0000-0000-000000000003', 'expirada', 'x');

select public.afirma((select count(*) from public.bling_lojas_para_renovar(60)) = 1, 'só renova loja conectada cujo token vence na janela');
select public.afirma((select loja_id from public.bling_lojas_para_renovar(60)) = 'aaaaaaaa-0000-0000-0000-000000000001', 'a loja certa é a que vence em 10 min');

select public.afirma(public.bling_reservar_renovacao('aaaaaaaa-0000-0000-0000-000000000001', 'inst-1', 60) = true, 'primeira reserva funciona');
select public.afirma(public.bling_reservar_renovacao('aaaaaaaa-0000-0000-0000-000000000001', 'inst-2', 60) = false, 'segunda reserva simultânea é recusada');
select public.afirma((select count(*) from public.bling_lojas_para_renovar(60)) = 0, 'loja reservada sai da lista do cron');
select public.bling_liberar_renovacao('aaaaaaaa-0000-0000-0000-000000000001', 'inst-2');
select public.afirma(public.bling_reservar_renovacao('aaaaaaaa-0000-0000-0000-000000000001', 'inst-3', 60) = false, 'só quem reservou consegue liberar');
select public.bling_liberar_renovacao('aaaaaaaa-0000-0000-0000-000000000001', 'inst-1');
select public.afirma(public.bling_reservar_renovacao('aaaaaaaa-0000-0000-0000-000000000001', 'inst-3', 60) = true, 'depois de liberar, nova reserva funciona');

update private.bling_credenciais set renovando_ate = now() - interval '1 second' where loja_id = 'aaaaaaaa-0000-0000-0000-000000000001';
select public.afirma(public.bling_reservar_renovacao('aaaaaaaa-0000-0000-0000-000000000001', 'inst-4', 60) = true, 'reserva vencida (instância morreu) pode ser retomada');

select public.bling_salvar_credenciais('aaaaaaaa-0000-0000-0000-000000000001', 'a1n', 'r1n', now() + interval '6 hours');
select public.afirma((select renovando_ate is null and renovando_por is null from private.bling_credenciais where loja_id='aaaaaaaa-0000-0000-0000-000000000001'), 'salvar credenciais libera a reserva');

set local role authenticated;
do $$ begin
  begin perform public.bling_reservar_renovacao('aaaaaaaa-0000-0000-0000-000000000001', 'x', 60); raise exception 'executou';
  exception when insufficient_privilege then null; end;
end $$;
select public.afirma(true, 'usuário logado não executa as RPCs de renovação');
set local role anon;
do $$ begin
  begin perform * from public.bling_lojas_para_renovar(60); raise exception 'anon executou';
  exception when insufficient_privilege then null; end;
end $$;
select public.afirma(true, 'visitante não executa as RPCs de renovação');
rollback;
