-- Testa a migração 21 (app do Bling por loja). Dados fictícios; desfaz tudo.
begin;
create or replace function public.afirma(ok boolean, msg text) returns void language plpgsql as
$$ begin if not ok then raise exception 'FALHOU: %', msg; end if; raise notice 'ok: %', msg; end $$;
insert into public.lojas (id, nome, slug) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Loja A', 'loja-a'), ('bbbbbbbb-0000-0000-0000-000000000002', 'Loja B', 'loja-b');
insert into public.usuarios_loja (loja_id, user_id) values ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111');
select public.bling_salvar_credenciais('aaaaaaaa-0000-0000-0000-000000000001', 'a', 'r', now() + interval '1 hour');
select public.bling_salvar_app('aaaaaaaa-0000-0000-0000-000000000001', 'client-id-aaaa', 'v1.cifrado');
select public.afirma((select count(*) from private.bling_credenciais where loja_id='aaaaaaaa-0000-0000-0000-000000000001') = 0, 'trocar o app apaga os tokens do app anterior');
select public.afirma((select status from public.bling_conexoes where loja_id='aaaaaaaa-0000-0000-0000-000000000001') = 'pendente', 'e volta a pendente até reautorizar');
select public.afirma((select client_id from public.bling_ler_app('aaaaaaaa-0000-0000-0000-000000000001')) = 'client-id-aaaa', 'servidor lê o app da loja');
do $$ begin
  begin perform public.bling_salvar_app('bbbbbbbb-0000-0000-0000-000000000002', 'curto', 'x'); raise exception 'aceitou';
  exception when check_violation then null; end;
end $$;
select public.afirma(true, 'Client ID curto demais é recusado');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select public.afirma(public.bling_app_configurado('aaaaaaaa-0000-0000-0000-000000000001') = true, 'lojista vê que a própria loja está configurada');
select public.afirma(public.bling_app_configurado('bbbbbbbb-0000-0000-0000-000000000002') = false, 'não vê a configuração de outra loja');
do $$ begin
  begin perform * from public.bling_ler_app('aaaaaaaa-0000-0000-0000-000000000001'); raise exception 'leu';
  exception when insufficient_privilege then null; end;
end $$;
select public.afirma(true, 'lojista nunca lê o secret (nem cifrado)');
do $$ begin
  begin perform * from private.bling_apps; raise exception 'leu tabela';
  exception when insufficient_privilege then null; end;
end $$;
select public.afirma(true, 'tabela private.bling_apps inacessível ao lojista');
set local role anon;
do $$ begin
  begin perform public.bling_app_configurado('aaaaaaaa-0000-0000-0000-000000000001'); raise exception 'anon';
  exception when insufficient_privilege then null; end;
end $$;
select public.afirma(true, 'visitante não consulta a configuração');
rollback;
