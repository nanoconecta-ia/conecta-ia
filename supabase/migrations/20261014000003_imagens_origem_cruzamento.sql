-- Migração 9: origem, licença, cruzamento de código e retirada de imagens.
-- Imagem de catálogo/fabricante/web pública entra como ILUSTRATIVA, com origem registrada,
-- e pode ser retirada (takedown) a qualquer momento. Nunca se apresenta como foto real.

alter table public.produto_imagens
  add column url_original text,                 -- página/arquivo de onde a imagem veio
  add column url_tratada text,                  -- versão no nosso armazenamento (fundo branco etc.)
  add column licenca_tipo text check (licenca_tipo in ('propria', 'fornecedor', 'fabricante', 'publica_web', 'licenciada')),
  add column cruzamento_tipo text check (cruzamento_tipo in ('sku', 'ean', 'oem', 'fabricante', 'similar', 'substituto')),
  add column cruzamento_valor text,             -- código que confirmou que a imagem é da peça certa
  add column confianca numeric(3,2) check (confianca between 0 and 1),
  add column fundo_branco boolean not null default false,
  add column alt_texto text,                    -- descrição pública (nome + SKU/código aprovado)
  add column removida_em timestamptz,           -- retirada: some da vitrine e não é reenviada
  add column enviada_bling_em timestamptz,      -- escrita autorizada no Bling (auditada à parte)
  add constraint imagem_web_publica_ilustrativa check (
    licenca_tipo is distinct from 'publica_web' or (tipo = 'ilustrativa' and url_original is not null)),
  add constraint imagem_web_publica_url_propria check (
    licenca_tipo is distinct from 'publica_web' or url <> url_original),  -- nunca serve a URL de terceiros
  add constraint imagem_aprovada_com_origem check (
    not aprovada or origem is not null or url_original is not null),
  add constraint imagem_aprovada_com_cruzamento check (
    not aprovada or tipo = 'real' or (cruzamento_tipo is not null and cruzamento_valor is not null));

-- Vitrine: imagem retirada nunca aparece.
alter policy imagens_publicas on public.produto_imagens
  using (aprovada and removida_em is null
         and exists (select 1 from public.produtos p where p.id = produto_id));

-- Origem em sigilo no público: a vitrine/anon NÃO enxerga url_original, licença nem cruzamento.
-- A proveniência continua guardada internamente (lojista da loja e servidor) para auditoria e retirada.
revoke select on public.produto_imagens from anon;
grant select (id, produto_id, loja_id, url, ordem, tipo, principal, aprovada, alt_texto,
              largura_px, altura_px, fundo_branco, removida_em, criado_em)
  on public.produto_imagens to anon;
