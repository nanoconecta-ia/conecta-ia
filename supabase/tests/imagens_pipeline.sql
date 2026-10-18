-- Pipeline de imagens: direitos de uso separados da aprovação; vitrine anon só vê publicável; url_original nunca exposta.
begin;
create or replace function public.afirma(ok boolean, msg text) returns void language plpgsql as
$$ begin if not ok then raise exception 'FALHOU: %', msg; end if; raise notice 'ok: %', msg; end $$;
create or replace function public.espera_erro(cmd text, trecho text, msg text) returns void language plpgsql as
$$ begin
  begin execute cmd; exception when others then
    if sqlerrm like '%' || trecho || '%' then raise notice 'ok: %', msg; return; end if;
    raise exception 'FALHOU: % (erro diferente do esperado: %)', msg, sqlerrm;
  end;
  raise exception 'FALHOU: % (não levantou erro)', msg;
end $$;

insert into public.lojas (id, nome, slug) values ('aaaaaaaa-0000-0000-0000-00000000000a', 'Loja A', 'loja-a'), ('bbbbbbbb-0000-0000-0000-00000000000b', 'Loja B', 'loja-b');
insert into public.usuarios_loja (loja_id, user_id, papel) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111', 'lojista'),
  ('aaaaaaaa-0000-0000-0000-00000000000a', '22222222-2222-2222-2222-222222222222', 'editor'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', '33333333-3333-3333-3333-333333333333', 'lojista');
insert into public.produtos (id, loja_id, bling_id, sku, nome, situacao, publicado) values
  ('c0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-00000000000a', '1', 'SKU1', 'Com imagem própria', 'A', true),
  ('c0000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-00000000000a', '2', 'SKU2', 'Só imagem web sem direito', 'A', true),
  ('c0000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-00000000000a', '3', 'SKU3', 'Sem imagem', 'A', true),
  ('c0000000-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-00000000000a', '4', 'SKU4', 'Ausente no ERP', 'ausente', false),
  ('c0000000-0000-0000-0000-000000000005', 'bbbbbbbb-0000-0000-0000-00000000000b', '5', 'SKU5', 'Outra loja', 'A', true);
\set A '\'aaaaaaaa-0000-0000-0000-00000000000a\''
\set U1 '\'11111111-1111-1111-1111-111111111111\''
\set U2 '\'22222222-2222-2222-2222-222222222222\''

insert into public.produto_imagens (id, loja_id, produto_id, url, tipo, origem, licenca_tipo, aprovada, principal) values
  ('e0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-00000000000a', 'c0000000-0000-0000-0000-000000000001', 'https://cdn.exemplo/p1.jpg', 'real', 'foto da loja', 'propria', true, true);
insert into public.produto_imagens (id, loja_id, produto_id, url, tipo, origem, licenca_tipo, url_original, cruzamento_tipo, cruzamento_valor, aprovada) values
  ('e0000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-00000000000a', 'c0000000-0000-0000-0000-000000000002', 'https://cdn.exemplo/p2.jpg', 'ilustrativa', 'busca web', 'publica_web', 'https://terceiro.exemplo/foto', 'sku', 'SKU2', true);

-- visão do servidor: só publicáveis, sem proveniência
select public.afirma((select count(*) from public.imagens_publicaveis) = 1, 'servidor só enxerga a imagem com direito (própria); a web aprovada sem direito fica fora');
select public.afirma(not exists (select 1 from information_schema.columns where table_name = 'imagens_publicaveis' and column_name in ('url_original', 'direitos_referencia', 'licenca_tipo', 'origem')), 'a visão não carrega proveniência nem licença');

-- fila do pipeline
select public.afirma((select array_agg(sku order by sku) from public.produtos_sem_imagem_publicavel where loja_id = 'aaaaaaaa-0000-0000-0000-00000000000a') = array['SKU2', 'SKU3'], 'fila: produto ativo sem imagem publicável (inclui o que só tem imagem sem direito); ausente fica fora');

-- vitrine anon
set local role anon;
select public.afirma((select count(*) from public.produto_imagens) = 1, 'anon só vê imagem publicável');
select public.espera_erro($$select url_original from public.produto_imagens$$, 'permission denied', 'anon não lê url_original');
select public.espera_erro($$select direitos_referencia from public.produto_imagens$$, 'permission denied', 'anon não lê a referência de direitos');
reset role;

-- confirmar direitos
select public.espera_erro($$select public.imagem_confirmar_direitos('aaaaaaaa-0000-0000-0000-00000000000a', 'e0000000-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'publica_web', 'autorização do fabricante em 2026-10-19')$$,
  'sem_permissao', 'editor não confirma direitos');
select public.espera_erro($$select public.imagem_confirmar_direitos('aaaaaaaa-0000-0000-0000-00000000000a', 'e0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'publica_web', 'curto')$$,
  'referencia_obrigatoria', 'sem evidência não confirma');
select public.espera_erro($$select public.imagem_confirmar_direitos('aaaaaaaa-0000-0000-0000-00000000000a', 'e0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'inventada', 'autorização do fabricante em 2026-10-19')$$,
  'licenca_invalida', 'tipo de licença inválido');
select public.espera_erro($$update public.produto_imagens set direitos_confirmados_em = now() where id = 'e0000000-0000-0000-0000-000000000002'$$,
  'imagem_direitos_com_referencia', 'o banco exige quem confirmou e a referência');
select public.imagem_confirmar_direitos(:A, 'e0000000-0000-0000-0000-000000000002', :U1, 'publica_web', 'autorização do fabricante em 2026-10-19');
select public.afirma((select count(*) from public.imagens_publicaveis) = 2, 'com direito confirmado a imagem passa a ser publicável');
select public.afirma((select count(*) from public.auditoria where acao = 'imagem.direitos_confirmados') = 1, 'confirmação auditada');
select public.afirma((select array_agg(sku) from public.produtos_sem_imagem_publicavel where loja_id = 'aaaaaaaa-0000-0000-0000-00000000000a') = array['SKU3'], 'fila encolhe');
set local role anon;
select public.afirma((select count(*) from public.produto_imagens) = 2, 'anon passa a ver as duas');
reset role;

-- takedown
select public.imagem_retirar(:A, 'e0000000-0000-0000-0000-000000000002', :U2, 'pedido do titular');
select public.afirma((select count(*) from public.imagens_publicaveis) = 1, 'imagem retirada sai da visão pública');
select public.espera_erro($$select public.imagem_retirar('aaaaaaaa-0000-0000-0000-00000000000a', 'e0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'x')$$, 'imagem_nao_encontrada', 'retirar duas vezes é recusado');
select public.espera_erro($$select public.imagem_retirar('aaaaaaaa-0000-0000-0000-00000000000a', 'e0000000-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'x')$$, 'sem_permissao', 'quem é de outra loja não retira');

-- RLS da fila: lojista de outra loja não enxerga produtos da loja A
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
select public.afirma((select count(*) from public.produtos_sem_imagem_publicavel where loja_id = 'aaaaaaaa-0000-0000-0000-00000000000a') = 0, 'fila respeita a RLS (outra loja não vê)');
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select public.afirma((select count(*) from public.produtos_sem_imagem_publicavel) >= 1, 'lojista vê a fila da própria loja');
select public.espera_erro($$select public.imagem_confirmar_direitos('aaaaaaaa-0000-0000-0000-00000000000a', 'e0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'propria', 'foto feita pela loja em 2026')$$, 'permission denied', 'usuário logado não chama a RPC direto');
reset role;
rollback;
