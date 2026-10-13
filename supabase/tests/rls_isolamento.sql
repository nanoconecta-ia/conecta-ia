-- Teste de isolamento entre duas lojas FICTÍCIAS. Roda numa transação e desfaz tudo.
-- Uso local: psql -v ON_ERROR_STOP=1 -f stub_supabase.sql -f ../migrations/*.sql -f rls_isolamento.sql
begin;
create or replace function public.afirma(ok boolean, msg text) returns void language plpgsql as
$$ begin if not ok then raise exception 'FALHOU: %', msg; end if; raise notice 'ok: %', msg; end $$;

insert into public.lojas (id, nome, slug, modo_venda) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Loja A', 'loja-a', 'checkout'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'Loja B', 'loja-b', 'checkout');
insert into public.usuarios_loja (loja_id, user_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111'),
  ('bbbbbbbb-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222');
insert into public.produtos (loja_id, bling_id, sku, nome, publicado) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '1', 'SKU-A', 'Produto A', true),
  ('bbbbbbbb-0000-0000-0000-000000000002', '1', 'SKU-B', 'Produto B', false);
insert into private.bling_credenciais values ('aaaaaaaa-0000-0000-0000-000000000001', 'x', 'y', now());
select public.afirma(has_table_privilege('service_role','private.bling_credenciais','select') and not has_table_privilege('authenticated','private.bling_credenciais','select'), 'só o servidor acessa credenciais do Bling');

-- Lojista A
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","aal":"aal1"}', true);
select public.afirma((select count(*) from public.produtos) = 1, 'lojista A vê só o produto da loja A');
select public.afirma((select count(*) from public.produtos where sku = 'SKU-B') = 0, 'lojista A não vê produto da loja B');
select public.afirma((select count(*) from public.lojas) = 1, 'lojista A vê só a própria loja');
do $$ begin
  begin perform 1 from private.bling_credenciais; raise exception 'vazou'; exception when insufficient_privilege then null; end;
end $$;
select public.afirma(true, 'lojista não lê credenciais do Bling');
do $$ begin
  begin update public.produtos set nome = 'hack'; if found then raise exception 'editou'; end if; exception when insufficient_privilege then null; end;
end $$;
select public.afirma(true, 'lojista não edita produto espelhado');
do $$ begin
  begin insert into public.restricoes_plataforma_uf (uf) values ('SP'); raise exception 'burlou';
  exception when insufficient_privilege or check_violation then null; when others then if sqlerrm = 'burlou' then raise; end if; end;
end $$;
select public.afirma(true, 'lojista não cria bloqueio de plataforma');
-- super admin sem MFA não vale
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","aal":"aal1","app_metadata":{"papel":"super_admin"}}', true);
select public.afirma((select count(*) from public.lojas) = 0, 'super admin sem MFA (aal1) não enxerga nada');
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","aal":"aal2","app_metadata":{"papel":"super_admin"}}', true);
select public.afirma((select count(*) from public.lojas) = 2, 'super admin com MFA (aal2) vê as duas lojas');
insert into public.restricoes_plataforma_uf (uf, motivo) values ('AM', 'teste');
-- anon: só publicados
reset role; set local role anon;
select public.afirma((select count(*) from public.produtos) = 1, 'anon vê só produto publicado');
reset role;

-- regra efetiva
set local role service_role;
select public.afirma(public.motivo_bloqueio_venda('aaaaaaaa-0000-0000-0000-000000000001', 'AM', 'pf') = 'uf_bloqueada_plataforma', 'UF bloqueada pelo super admin recusa');
select public.afirma(public.motivo_bloqueio_venda('aaaaaaaa-0000-0000-0000-000000000001', 'SP', 'pf') is null, 'UF livre permite');
insert into public.restricoes_loja (loja_id, ufs_permitidas, aceita_pj) values ('aaaaaaaa-0000-0000-0000-000000000001', '{SP,AM}', false);
select public.afirma(public.motivo_bloqueio_venda('aaaaaaaa-0000-0000-0000-000000000001', 'AM', 'pf') = 'uf_bloqueada_plataforma', 'lojista não libera o que o super admin bloqueou');
select public.afirma(public.motivo_bloqueio_venda('aaaaaaaa-0000-0000-0000-000000000001', 'RJ', 'pf') = 'uf_bloqueada_loja', 'UF fora da lista do lojista recusa');
select public.afirma(public.motivo_bloqueio_venda('aaaaaaaa-0000-0000-0000-000000000001', 'SP', 'pj') = 'pj_nao_aceita', 'PJ recusada quando lojista só aceita PF');
select public.afirma((select count(*) from public.auditoria) >= 2, 'mudanças de regra geraram auditoria');
do $$ begin
  begin delete from public.auditoria; raise exception 'apagou'; exception when others then if sqlerrm = 'apagou' then raise; end if; end;
end $$;
select public.afirma(true, 'auditoria é imutável');
rollback;
