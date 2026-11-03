-- Ponte ERP: a extensão (pareamento) grava o produto aberto como a pessoa que aprovou a sessão; isolamento, SKU resolvido NA loja, fechar não apaga outro produto.
begin;
create or replace function public.afirma(ok boolean, msg text) returns void language plpgsql as
$$ begin if not ok then raise exception 'FALHOU: %', msg; end if; raise notice 'ok: %', msg; end $$;
insert into public.lojas (id, nome, slug) values ('aaaaaaaa-0000-0000-0000-00000000000a', 'Loja A', 'loja-a'), ('bbbbbbbb-0000-0000-0000-00000000000b', 'Loja B', 'loja-b');
insert into public.usuarios_loja (loja_id, user_id, papel) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111', 'lojista'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', '33333333-3333-3333-3333-333333333333', 'lojista');
insert into public.produtos (id, loja_id, bling_id, sku, nome, situacao, publicado) values
  ('c0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-00000000000a', '1', 'OC1224', 'Filtro', 'A', false),
  ('c0000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-00000000000a', '2', '80692', 'Junta', 'A', false),
  ('c0000000-0000-0000-0000-000000000003', 'bbbbbbbb-0000-0000-0000-00000000000b', '3', 'OC1224', 'Filtro da loja B', 'A', false);

select public.afirma('contexto:registrar' = any(private.pair_escopos_validos()), 'escopo contexto:registrar existe');
select public.afirma(not has_function_privilege('anon', 'public.contexto_registrar_extensao(uuid,uuid,text,text)', 'execute') and not has_function_privilege('authenticated', 'public.contexto_registrar_extensao(uuid,uuid,text,text)', 'execute'), 'só o service_role executa (navegador não chama direto)');
select public.afirma(has_function_privilege('service_role', 'public.contexto_registrar_extensao(uuid,uuid,text,text)', 'execute'), 'service_role executa');

\set A '\'aaaaaaaa-0000-0000-0000-00000000000a\''
\set U '\'11111111-1111-1111-1111-111111111111\''
select public.afirma((public.contexto_registrar_extensao(:A, :U, 'OC1224', 'aberto')->>'ok')::boolean, 'abrir produto pelo SKU da tela');
select public.afirma((select produto_ativo_id from public.contexto_sessoes where loja_id = :A and principal = 'u:11111111-1111-1111-1111-111111111111') = 'c0000000-0000-0000-0000-000000000001', 'ativo = produto da LOJA A (não o homônimo da loja B)');
select public.afirma((select origem from public.contexto_sessoes where loja_id = :A) = 'bling-ui', 'origem registrada como bling-ui');
select public.afirma(public.contexto_registrar_extensao(:A, :U, 'NAO-EXISTE', 'aberto')->>'erro' = 'produto_nao_encontrado', 'SKU inexistente na loja é recusado');
select public.afirma(public.contexto_registrar_extensao(:A, '33333333-3333-3333-3333-333333333333', 'OC1224', 'aberto')->>'erro' = 'sem_acesso', 'pessoa de outra loja não grava nesta');
select public.afirma(public.contexto_registrar_extensao(:A, :U, 'OC1224', 'apagar')->>'erro' = 'evento_invalido', 'ação desconhecida recusada');
select public.afirma(public.contexto_registrar_extensao(:A, :U, repeat('x', 81), 'aberto')->>'erro' = 'evento_invalido', 'SKU gigante recusado');
-- trocar de produto e fechar o ANTERIOR não apaga o atual
select public.contexto_registrar_extensao(:A, :U, '80692', 'aberto');
select public.afirma((public.contexto_registrar_extensao(:A, :U, 'OC1224', 'fechado')->>'ignorado')::boolean, 'fechar o produto antigo é ignorado');
select public.afirma((select produto_ativo_id from public.contexto_sessoes where loja_id = :A) = 'c0000000-0000-0000-0000-000000000002', 'o produto atual continua aberto');
select public.contexto_registrar_extensao(:A, :U, '80692', 'fechado');
select public.afirma((select produto_ativo_id is null and cardinality(produtos_selecionados) = 0 from public.contexto_sessoes where loja_id = :A), 'fechar o produto atual limpa o contexto');
select public.afirma((select count(*) from public.contexto_sessoes where loja_id = 'bbbbbbbb-0000-0000-0000-00000000000b') = 0, 'nada gravado na loja B');
-- expirado: recomeça da versão 0 + 1
update public.contexto_sessoes set expira_em = now() - interval '1 minute', versao = 9 where loja_id = :A;
select public.afirma((public.contexto_registrar_extensao(:A, :U, 'OC1224', 'aberto')->>'versao')::int = 1, 'contexto expirado recomeça a versão');
rollback;
