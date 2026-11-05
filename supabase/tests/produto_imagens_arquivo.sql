-- Imagens do Bling: colunas do arquivo, isolamento do caminho por loja/produto, duplicidade por hash, anon sem as colunas novas, bucket privado.
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
insert into public.produtos (id, loja_id, bling_id, sku, nome, situacao, publicado) values
  ('c0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-00000000000a', '1', 'SKU1', 'Produto A', 'A', false),
  ('c0000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-00000000000a', '2', 'SKU2', 'Produto A2', 'A', false);

-- linha válida: caminho dentro da loja e do produto, hash de 64 hex
insert into public.produto_imagens (id, loja_id, produto_id, url, tipo, origem, importada_de, arquivo_original_path, arquivo_original_sha256, arquivo_original_bytes, arquivo_original_mime, evidencias) values
  ('e0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-00000000000a', 'c0000000-0000-0000-0000-000000000001', 'https://exemplo/p.jpg', 'ilustrativa', 'bling_interna', 'bling_interna',
   'lojas/aaaaaaaa-0000-0000-0000-00000000000a/produtos/c0000000-0000-0000-0000-000000000001/e0000000-0000-0000-0000-000000000001/original.jpg', repeat('a', 64), 1234, 'image/jpeg', '[{"fato":"veio do cadastro do próprio produto"}]');
select public.afirma((select aprovada from public.produto_imagens where id = 'e0000000-0000-0000-0000-000000000001') = false, 'imagem importada nasce NÃO aprovada');

select public.espera_erro($$insert into public.produto_imagens (loja_id, produto_id, url, tipo, origem, arquivo_original_path) values ('aaaaaaaa-0000-0000-0000-00000000000a', 'c0000000-0000-0000-0000-000000000001', 'https://x/1.jpg', 'ilustrativa', 'o', 'lojas/bbbbbbbb-0000-0000-0000-00000000000b/produtos/c0000000-0000-0000-0000-000000000001/x/original.jpg')$$, 'produto_imagens_caminho_da_loja', 'caminho de OUTRA loja é recusado');
select public.espera_erro($$insert into public.produto_imagens (loja_id, produto_id, url, tipo, origem, arquivo_original_path) values ('aaaaaaaa-0000-0000-0000-00000000000a', 'c0000000-0000-0000-0000-000000000001', 'https://x/2.jpg', 'ilustrativa', 'o', 'lojas/aaaaaaaa-0000-0000-0000-00000000000a/produtos/c0000000-0000-0000-0000-000000000002/x/original.jpg')$$, 'produto_imagens_caminho_da_loja', 'caminho de OUTRO produto é recusado');
select public.espera_erro($$insert into public.produto_imagens (loja_id, produto_id, url, tipo, origem, arquivo_tratado_path) values ('aaaaaaaa-0000-0000-0000-00000000000a', 'c0000000-0000-0000-0000-000000000001', 'https://x/3.jpg', 'ilustrativa', 'o', 'lojas/bbbbbbbb-0000-0000-0000-00000000000b/produtos/c0000000-0000-0000-0000-000000000001/x/tratada.jpg')$$, 'produto_imagens_caminho_da_loja', 'caminho da versão tratada também é isolado');
select public.espera_erro($$insert into public.produto_imagens (loja_id, produto_id, url, tipo, origem, arquivo_original_sha256) values ('aaaaaaaa-0000-0000-0000-00000000000a', 'c0000000-0000-0000-0000-000000000001', 'https://x/4.jpg', 'ilustrativa', 'o', repeat('a', 64))$$, 'produto_imagens_sha_unico', 'mesmo hash no mesmo produto é recusado (sem duplicidade)');
select public.espera_erro($$insert into public.produto_imagens (loja_id, produto_id, url, tipo, origem, arquivo_original_sha256) values ('aaaaaaaa-0000-0000-0000-00000000000a', 'c0000000-0000-0000-0000-000000000001', 'https://x/5.jpg', 'ilustrativa', 'o', 'XYZ')$$, 'check', 'hash fora do formato SHA-256 é recusado');
select public.espera_erro($$insert into public.produto_imagens (loja_id, produto_id, url, tipo, origem, arquivo_original_mime) values ('aaaaaaaa-0000-0000-0000-00000000000a', 'c0000000-0000-0000-0000-000000000001', 'https://x/6.jpg', 'ilustrativa', 'o', 'image/gif')$$, 'check', 'tipo de arquivo fora de jpeg/png/webp é recusado');
select public.espera_erro($$insert into public.produto_imagens (loja_id, produto_id, url, tipo, origem, importada_de) values ('aaaaaaaa-0000-0000-0000-00000000000a', 'c0000000-0000-0000-0000-000000000001', 'https://x/7.jpg', 'ilustrativa', 'o', 'whatsapp')$$, 'check', 'origem de importação desconhecida é recusada');
-- o mesmo hash em OUTRO produto é permitido
insert into public.produto_imagens (loja_id, produto_id, url, tipo, origem, arquivo_original_sha256) values ('aaaaaaaa-0000-0000-0000-00000000000a', 'c0000000-0000-0000-0000-000000000002', 'https://x/8.jpg', 'ilustrativa', 'o', repeat('a', 64));
select public.afirma(true, 'mesmo hash em outro produto é permitido');
-- imagem removida libera o hash
update public.produto_imagens set removida_em = now() where id = 'e0000000-0000-0000-0000-000000000001';
insert into public.produto_imagens (loja_id, produto_id, url, tipo, origem, arquivo_original_sha256) values ('aaaaaaaa-0000-0000-0000-00000000000a', 'c0000000-0000-0000-0000-000000000001', 'https://x/9.jpg', 'ilustrativa', 'o', repeat('a', 64));
select public.afirma(true, 'hash de imagem removida pode ser importado de novo');

-- anon não recebe NENHUMA das colunas novas; as já públicas continuam
select public.afirma(not exists (select 1 from unnest(array['importada_de', 'arquivo_original_path', 'arquivo_original_sha256', 'arquivo_original_bytes', 'arquivo_original_mime', 'arquivo_tratado_path', 'arquivo_tratado_sha256', 'evidencias']) c where has_column_privilege('anon', 'public.produto_imagens', c, 'select')), 'anon NÃO lê as colunas novas (caminho, hash, evidências)');
select public.afirma(has_column_privilege('anon', 'public.produto_imagens', 'url', 'select') and not has_column_privilege('anon', 'public.produto_imagens', 'url_original', 'select'), 'grants públicos antigos intactos (url sim, url_original não)');
select public.afirma(not exists (select 1 from information_schema.columns where table_name = 'imagens_publicaveis' and column_name in ('evidencias', 'arquivo_original_path', 'arquivo_original_sha256', 'importada_de')), 'a visão publicável continua sem as colunas novas');

-- bucket privado e limitado
select public.afirma((select public from storage.buckets where id = 'produto-imagens') = false, 'bucket produto-imagens é PRIVADO');
select public.afirma((select file_size_limit from storage.buckets where id = 'produto-imagens') = 8388608, 'bucket limitado a 8 MB');
select public.afirma((select allowed_mime_types from storage.buckets where id = 'produto-imagens') = array['image/jpeg', 'image/png', 'image/webp'], 'bucket só aceita jpeg/png/webp');
rollback;
