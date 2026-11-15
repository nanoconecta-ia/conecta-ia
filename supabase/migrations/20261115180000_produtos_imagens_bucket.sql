-- Registra o bucket de imagens de produto, que JÁ EXISTE em produção (criado fora das migrações; conferido em 15/11/2026:
-- público, limite de 5 MB, só PNG/JPEG/WebP). Esta migração não altera produção (on conflict do nothing): só torna o
-- ambiente reproduzível e a decisão rastreável. PROPOSTA: não aplicar sem aprovação específica.
-- Leitura pública (a URL vai para o Bling e para a loja); nenhuma política para o navegador: só a função grava, com service_role.
-- Caminho: <loja_id>/<produto_id>/<sha256>.<ext>. Só entra arquivo de imagem aprovada com direitos confirmados (nanogpt-midia).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('produtos-imagens', 'produtos-imagens', true, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;
