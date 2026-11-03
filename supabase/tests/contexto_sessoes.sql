-- Contexto Vivo: isolamento por loja/usuário, seleção múltipla, duplicidade, ordem, expiração, acesso direto negado.
begin;
create or replace function public.afirma(ok boolean, msg text) returns void language plpgsql as
$$ begin if not ok then raise exception 'FALHOU: %', msg; end if; raise notice 'ok: %', msg; end $$;
insert into public.lojas (id, nome, slug) values ('aaaaaaaa-0000-0000-0000-00000000000a', 'Loja A', 'loja-a'), ('bbbbbbbb-0000-0000-0000-00000000000b', 'Loja B', 'loja-b');
insert into public.usuarios_loja (loja_id, user_id, papel) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111', 'lojista'),
  ('aaaaaaaa-0000-0000-0000-00000000000a', '22222222-2222-2222-2222-222222222222', 'editor'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', '33333333-3333-3333-3333-333333333333', 'lojista');
insert into public.produtos (id, loja_id, bling_id, sku, nome, situacao, publicado) values
  ('c0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-00000000000a', '1', 'S1', 'P1', 'A', false),
  ('c0000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-00000000000a', '2', 'S2', 'P2', 'A', false),
  ('c0000000-0000-0000-0000-000000000003', 'bbbbbbbb-0000-0000-0000-00000000000b', '3', 'S3', 'P3 outra loja', 'A', false);
\set A '\'aaaaaaaa-0000-0000-0000-00000000000a\''
\set P1 '\'c0000000-0000-0000-0000-000000000001\''
\set P2 '\'c0000000-0000-0000-0000-000000000002\''
\set P3 '\'c0000000-0000-0000-0000-000000000003\''

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select public.afirma((public.contexto_registrar(:A, 'e0000000-0000-0000-0000-000000000001', 'produto.selecionado', 'conecta-ui', null, array[:P1::uuid, :P2::uuid], 0)->>'ok')::boolean, 'seleção de 2 produtos aceita');
select public.afirma((public.contexto_registrar(:A, 'e0000000-0000-0000-0000-000000000001', 'produto.selecionado', 'conecta-ui', null, array[:P1::uuid, :P2::uuid], 0)->>'duplicado')::boolean, 'evento duplicado é ignorado');
select public.afirma(public.contexto_registrar(:A, 'e0000000-0000-0000-0000-000000000002', 'produto.aberto', 'conecta-ui', :P1, array[:P1::uuid], 0)->>'erro' = 'versao_conflito', 'versão antiga (fora de ordem) vira conflito');
select public.afirma(public.contexto_registrar(:A, 'e0000000-0000-0000-0000-000000000003', 'produto.aberto', 'conecta-ui', :P1, array[:P1::uuid], 1)->>'versao' = '2', 'versão avança no servidor');
select public.afirma(public.contexto_registrar(:A, 'e0000000-0000-0000-0000-000000000004', 'produto.selecionado', 'conecta-ui', null, array[:P3::uuid], 2)->>'erro' = 'produto_fora_da_loja', 'produto de OUTRA loja é recusado');
select public.afirma(public.contexto_registrar(:A, 'e0000000-0000-0000-0000-000000000005', 'produto.selecionado', 'conecta-ui', null, array[:P1::uuid, :P1::uuid], 2)->>'erro' = 'selecao_duplicada', 'seleção duplicada recusada');
select public.afirma(public.contexto_registrar(:A, 'e0000000-0000-0000-0000-000000000006', 'produto.salvo', 'conecta-ui', null, '{}', 2)->>'erro' = 'evento_invalido', 'ação produto.salvo NÃO vem do cliente');
select public.afirma(public.contexto_registrar(:A, 'e0000000-0000-0000-0000-000000000007', 'produto.aberto', 'conecta-ui', null, '{}', 2)->>'erro' = 'produto_ativo_ausente', 'abrir sem produto recusado');
-- usuário de OUTRA loja não grava nesta
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
select public.afirma(public.contexto_registrar(:A, 'e0000000-0000-0000-0000-000000000008', 'selecao.limpa', 'conecta-ui', null, '{}', 0)->>'erro' = 'sem_acesso', 'usuário de outra loja é recusado');
-- navegador não lê nem escreve a tabela direto
select public.afirma(not has_table_privilege('authenticated', 'public.contexto_sessoes', 'select') and not has_table_privilege('authenticated', 'public.contexto_sessoes', 'insert'), 'sem acesso direto à tabela pelo navegador');
reset role;
-- cada usuário tem a SUA linha (sem vazamento entre usuários da mesma loja)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select public.afirma((public.contexto_registrar(:A, 'e0000000-0000-0000-0000-000000000009', 'produto.aberto', 'conecta-ui', :P2, array[:P2::uuid], 0)->>'ok')::boolean, 'segundo usuário da loja grava a própria sessão, versão 0 independente');
reset role;
select public.afirma((select count(*) from public.contexto_sessoes where loja_id = :A) = 2, 'duas sessões separadas na mesma loja');
select public.afirma((select count(*) from public.contexto_sessoes where loja_id = 'bbbbbbbb-0000-0000-0000-00000000000b') = 0, 'nada gravado na outra loja');
-- expiração: vencido volta a vazio e pede nova tentativa
update public.contexto_sessoes set expira_em = now() - interval '1 minute' where loja_id = :A and principal = 'u:11111111-1111-1111-1111-111111111111';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select public.afirma(public.contexto_registrar(:A, 'e0000000-0000-0000-0000-00000000000a', 'selecao.limpa', 'conecta-ui', null, '{}', 2)->>'erro' = 'contexto_expirado', 'contexto vencido recusa e reinicia');
select public.afirma((public.contexto_registrar(:A, 'e0000000-0000-0000-0000-00000000000b', 'produto.aberto', 'conecta-ui', :P1, array[:P1::uuid], 0)->>'ok')::boolean, 'após reinício a gravação volta a funcionar');
reset role;
rollback;
