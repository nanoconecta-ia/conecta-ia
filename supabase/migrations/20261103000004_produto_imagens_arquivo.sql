-- Imagens do Bling (piloto): onde guardar o ARQUIVO e a prova dele. Aditiva: nenhuma coluna existente muda; nada é apagado.
-- Aprovada pelo dono (D1) em 2026-11-03. Bucket PRIVADO: o público só recebe imagem aprovada + direitos, pela vitrine.
-- anon NÃO recebe as colunas novas: o grant por coluna de 20261014000003 continua valendo (colunas novas ficam fora dele).
alter table public.produto_imagens
  add column importada_de text check (importada_de in ('bling_interna', 'bling_externa')),
  add column arquivo_original_path text,
  add column arquivo_original_sha256 text check (arquivo_original_sha256 ~ '^[0-9a-f]{64}$'),
  add column arquivo_original_bytes integer check (arquivo_original_bytes > 0),
  add column arquivo_original_mime text check (arquivo_original_mime in ('image/jpeg', 'image/png', 'image/webp')),
  add column arquivo_tratado_path text,
  add column arquivo_tratado_sha256 text check (arquivo_tratado_sha256 ~ '^[0-9a-f]{64}$'),
  add column evidencias jsonb not null default '[]' check (jsonb_typeof(evidencias) = 'array');

-- isolamento por loja e por produto no próprio caminho do arquivo
alter table public.produto_imagens add constraint produto_imagens_caminho_da_loja check (
  (arquivo_original_path is null or arquivo_original_path like 'lojas/' || loja_id::text || '/produtos/' || produto_id::text || '/%')
  and (arquivo_tratado_path is null or arquivo_tratado_path like 'lojas/' || loja_id::text || '/produtos/' || produto_id::text || '/%'));

-- duplicidade por conteúdo no mesmo produto (imagem removida não conta)
create unique index produto_imagens_sha_unico on public.produto_imagens (produto_id, arquivo_original_sha256)
  where arquivo_original_sha256 is not null and removida_em is null;

-- bucket PRIVADO (sem política em storage.objects: só service_role escreve/lê); 8 MB; jpeg/png/webp
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('produto-imagens', 'produto-imagens', false, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
