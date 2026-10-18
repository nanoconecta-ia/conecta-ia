-- Testa a migração 21 revisada. Duas lojas fictícias; desfaz tudo.
begin;
create or replace function public.afirma(ok boolean, msg text) returns void language plpgsql as
$$ begin if not ok then raise exception 'FALHOU: %', msg; end if; raise notice 'ok: %', msg; end $$;
insert into public.lojas (id, nome, slug) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Loja A', 'loja-a'), ('bbbbbbbb-0000-0000-0000-000000000002', 'Loja B', 'loja-b');
-- U1 = lojista da A; U2 = editor da A; U3 = lojista da B
insert into public.usuarios_loja (loja_id, user_id, papel) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'lojista'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'editor'),
  ('bbbbbbbb-0000-0000-0000-000000000002', '33333333-3333-3333-3333-333333333333', 'lojista');

select public.bling_salvar_credenciais('aaaaaaaa-0000-0000-0000-000000000001', 'a', 'r', now() + interval '1 hour');
select public.bling_salvar_app('aaaaaaaa-0000-0000-0000-000000000001', 'client-id-aaaa', 'v2.k1.cifrado', '19903967000101');
select public.afirma((select count(*) from private.bling_credenciais where loja_id='aaaaaaaa-0000-0000-0000-000000000001') = 0, 'app novo apaga tokens do app anterior');
select public.bling_salvar_credenciais('aaaaaaaa-0000-0000-0000-000000000001', 'a2', 'r2', now() + interval '1 hour');
select public.bling_salvar_app('aaaaaaaa-0000-0000-0000-000000000001', 'client-id-aaaa', 'v2.k1.outro', '19903967000101');
select public.afirma((select count(*) from private.bling_credenciais where loja_id='aaaaaaaa-0000-0000-0000-000000000001') = 1, 'mesmo Client ID: trocar só o secret preserva a conexão');
select public.afirma((select client_secret_cifrado from public.bling_ler_app('aaaaaaaa-0000-0000-0000-000000000001')) = 'v2.k1.outro', 'secret atualizado');
do $$ begin
  begin perform public.bling_salvar_app('bbbbbbbb-0000-0000-0000-000000000002', 'curto', 'x', '19903967000101'); raise exception 'aceitou';
  exception when check_violation then null; end;
end $$;
select public.afirma(true, 'Client ID curto é recusado');
do $$ begin
  begin perform public.bling_salvar_app('bbbbbbbb-0000-0000-0000-000000000002', 'client-id-bbbb', 'x', '123'); raise exception 'aceitou';
  exception when check_violation then null; end;
end $$;
select public.afirma(true, 'CNPJ fora do formato é recusado');

-- papéis
select public.afirma(public.bling_usuario_administra('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111'), 'lojista administra a própria loja');
select public.afirma(not public.bling_usuario_administra('aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222'), 'EDITOR não administra a integração');
select public.afirma(not public.bling_usuario_administra('aaaaaaaa-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333'), 'lojista da loja B não administra a loja A');

-- state de uso único
create temp table n as select public.bling_estado_criar('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 600) as nonce;
select public.afirma((select count(*) from public.bling_estado_consumir((select nonce from n))) = 1, 'primeiro uso do state é aceito');
select public.afirma((select count(*) from public.bling_estado_consumir((select nonce from n))) = 0, 'REUSO do state é recusado');
create temp table n2 as select public.bling_estado_criar('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 600) as nonce;
update private.bling_oauth_estados set expira_em = now() - interval '1 second' where nonce = (select nonce from n2);
select public.afirma((select count(*) from public.bling_estado_consumir((select nonce from n2))) = 0, 'state expirado é recusado');
select public.afirma((select loja_id from public.bling_estado_consumir(public.bling_estado_criar('bbbbbbbb-0000-0000-0000-000000000002', '33333333-3333-3333-3333-333333333333', 600))) = 'bbbbbbbb-0000-0000-0000-000000000002', 'state devolve a loja a que pertence');

-- limite de tentativas
select public.afirma(public.limite_chamada('t:1', 2, 3600) and public.limite_chamada('t:1', 2, 3600) and not public.limite_chamada('t:1', 2, 3600), 'terceira tentativa na janela é bloqueada');
select public.afirma(public.limite_chamada('t:2', 2, 3600), 'outra chave tem a própria cota');

-- grants / RLS
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select public.afirma(public.pode_administrar_loja('aaaaaaaa-0000-0000-0000-000000000001') = false, 'logado como editor: pode_administrar_loja = falso');
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select public.afirma(public.pode_administrar_loja('aaaaaaaa-0000-0000-0000-000000000001') = true, 'logado como lojista: verdadeiro');
select public.afirma(public.pode_administrar_loja('bbbbbbbb-0000-0000-0000-000000000002') = false, 'lojista A não administra a loja B');
select public.afirma(public.bling_app_configurado('bbbbbbbb-0000-0000-0000-000000000002') = false, 'não vê configuração de outra loja');
do $$ begin begin perform * from public.bling_ler_app('aaaaaaaa-0000-0000-0000-000000000001'); raise exception 'leu';
  exception when insufficient_privilege then null; end; end $$;
select public.afirma(true, 'lojista nunca lê o secret (nem cifrado)');
do $$ begin begin perform public.bling_estado_consumir(gen_random_uuid()); raise exception 'executou';
  exception when insufficient_privilege then null; end; end $$;
select public.afirma(true, 'lojista não consome nem cria state (só o servidor)');
do $$ begin begin perform * from private.bling_apps; raise exception 'leu tabela';
  exception when insufficient_privilege then null; end; end $$;
select public.afirma(true, 'tabela private.bling_apps inacessível ao lojista');
set local role anon;
do $$ begin begin perform public.pode_administrar_loja('aaaaaaaa-0000-0000-0000-000000000001'); raise exception 'anon';
  exception when insufficient_privilege then null; end; end $$;
select public.afirma(true, 'visitante não consulta nada disso');
rollback;
