-- Testa o tema por loja. Duas lojas fictícias; desfaz tudo.
begin;
create or replace function public.afirma(ok boolean, msg text) returns void language plpgsql as
$$ begin if not ok then raise exception 'FALHOU: %', msg; end if; raise notice 'ok: %', msg; end $$;
insert into public.lojas (id, nome, slug) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Loja A', 'loja-a'), ('bbbbbbbb-0000-0000-0000-000000000002', 'Loja B', 'loja-b');
\set A '\'aaaaaaaa-0000-0000-0000-000000000001\''
\set B '\'bbbbbbbb-0000-0000-0000-000000000002\''
select public.tema_salvar(:A, 'vinho', '#8e1b3a', '#e0a526', '#2a0f18', 'serifada');
select public.afirma((select cor_primaria from public.loja_tema where loja_id = :A) = '#8e1b3a', 'tema salvo');
select public.afirma((select count(*) from public.loja_tema where loja_id = :B) = 0, 'outra loja sem tema');
select public.tema_definir_imagem(:A, 'logo', 'https://x.supabase.co/storage/v1/object/public/lojas-marca/aaaaaaaa-0000-0000-0000-000000000001/logo-ab12.png');
select public.tema_salvar(:A, 'azul_conecta', '#0864a0', '#04a88d', '#102335', 'inter');
select public.afirma((select logo_url is not null from public.loja_tema where loja_id = :A), 'salvar cores não apaga o logo');
select public.tema_definir_imagem(:A, 'logo', null);
select public.afirma((select logo_url is null from public.loja_tema where loja_id = :A), 'remover o logo');
do $$ begin begin perform public.tema_salvar('aaaaaaaa-0000-0000-0000-000000000001', 'azul_conecta', 'vermelho', '#04a88d', '#102335', 'inter'); raise exception 'aceitou'; exception when check_violation then null; end; end $$;
select public.afirma(true, 'cor fora do formato é recusada');
do $$ begin begin perform public.tema_salvar('aaaaaaaa-0000-0000-0000-000000000001', 'azul_conecta', '#0864a0', '#04a88d', '#102335', 'comic-sans'); raise exception 'aceitou'; exception when check_violation then null; end; end $$;
select public.afirma(true, 'fonte fora da lista é recusada');
do $$ begin begin perform public.tema_definir_imagem('aaaaaaaa-0000-0000-0000-000000000001', 'icone', 'https://evil.com/x.png'); raise exception 'aceitou'; exception when check_violation then null; end; end $$;
select public.afirma(true, 'imagem fora do armazenamento das marcas é recusada');
do $$ begin begin perform public.tema_definir_imagem('aaaaaaaa-0000-0000-0000-000000000001', 'icone', 'https://x.supabase.co/storage/v1/object/public/lojas-marca/aaaaaaaa-0000-0000-0000-000000000001/a.png?x=1'); raise exception 'aceitou'; exception when check_violation then null; end; end $$;
select public.afirma(true, 'URL de imagem com parâmetros é recusada');
do $$ begin begin perform public.tema_definir_imagem('aaaaaaaa-0000-0000-0000-000000000001', 'banner', null); raise exception 'aceitou'; exception when invalid_parameter_value then null; end; end $$;
select public.afirma(true, 'tipo de imagem desconhecido é recusado');
insert into public.usuarios_loja (loja_id, user_id, papel) values (:A, '11111111-1111-1111-1111-111111111111', 'lojista');
select public.tema_salvar(:B, 'azul_conecta', '#0864a0', '#04a88d', '#102335', 'inter');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select public.afirma((select count(*) from public.loja_tema) = 1, 'RLS: só o tema da própria loja');
do $$ begin begin perform public.tema_salvar('aaaaaaaa-0000-0000-0000-000000000001', 'vinho', '#8e1b3a', '#e0a526', '#2a0f18', 'inter'); raise exception 'aceitou'; exception when insufficient_privilege then null; end; end $$;
select public.afirma(true, 'usuário logado não grava tema direto');
rollback;
