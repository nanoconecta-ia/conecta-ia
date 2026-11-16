-- Mobis: uma peça física no Bling, várias páginas consultivas por aplicação.
-- Aplicações são FILHOS COMERCIAIS da ficha, nunca variações ERP ou clones de estoque.
-- Aplicada inicialmente ao ambiente Mobis em 2026-11-15; mantida idempotente.
ALTER TABLE public.produto_aplicacoes
  ADD COLUMN IF NOT EXISTS pagina_slug text,
  ADD COLUMN IF NOT EXISTS pagina_titulo text,
  ADD COLUMN IF NOT EXISTS pagina_descricao text,
  ADD COLUMN IF NOT EXISTS pagina_indexavel boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS produto_aplicacoes_pagina_slug_loja_unq
  ON public.produto_aplicacoes(loja_id, pagina_slug) WHERE pagina_slug IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.produto_aplicacoes'::regclass
      AND conname='aplicacao_pagina_indexavel_somente_aprovada'
  ) THEN
    ALTER TABLE public.produto_aplicacoes
      ADD CONSTRAINT aplicacao_pagina_indexavel_somente_aprovada
      CHECK (NOT pagina_indexavel OR status='aprovado'::status_enriquecimento);
  END IF;
END $$;

COMMENT ON COLUMN public.produto_aplicacoes.pagina_slug IS 'Rota comercial por veículo; identificador único por loja. Não cria produto Bling.';
COMMENT ON COLUMN public.produto_aplicacoes.pagina_indexavel IS 'Somente após aplicação técnica OEM aprovada e demais requisitos de SEO; default false.';
