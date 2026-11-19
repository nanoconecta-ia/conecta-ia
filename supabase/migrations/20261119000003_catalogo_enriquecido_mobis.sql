-- MOBIS: Estado público INFORMATIVO, distinto de publicado/venda e de exibicao_teste.
-- Migração proposta no GitHub. Executar apenas em deploy autorizado, com rollback/testes.
-- Preço e saldo do Bling permanecem intactos; a Edge Function deverá omitir ambos no modo informativo.
BEGIN;

ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS exibicao_informativa boolean NOT NULL DEFAULT false;

-- Impede um SKU de ser simultaneamente oferta publicada e ficha informativa.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.produtos'::regclass
      AND conname = 'produtos_publicacao_informativa_exclusiva'
  ) THEN
    ALTER TABLE public.produtos
      ADD CONSTRAINT produtos_publicacao_informativa_exclusiva
      CHECK (NOT (publicado AND exibicao_informativa));
  END IF;
END $$;

-- Unico SKU de prévia previamente selecionado pelo dono, preservando decisão já existente.
-- NÃO ativar o espelho inteiro, nem outros tenants, nem produtos pausados não selecionados.
UPDATE public.produtos p SET exibicao_informativa = true
  FROM public.lojas l
 WHERE l.id = p.loja_id AND l.slug = 'mobis'
   AND p.sku = 'CI003696' AND p.exibicao_teste = true
   AND p.publicado = false AND p.situacao::text = 'A'
   AND btrim(coalesce(p.nome, '')) <> '' AND btrim(coalesce(p.sku, '')) <> '';

-- A única porta de edição da visibilidade informativa é ato de LOJISTA autenticado.
-- Não expor ferramenta de execução desta RPC ao agente, que somente prepara propostas.
CREATE OR REPLACE FUNCTION public.catalogo_informativo_definir(p_produto uuid, p_ativo boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $fn$
DECLARE
  v_user uuid := auth.uid();
  v_prod public.produtos%rowtype;
  v_antes boolean;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE='28000';
  END IF;

  SELECT * INTO v_prod FROM public.produtos WHERE id = p_produto FOR UPDATE;
  IF NOT FOUND OR NOT private.administra_loja(v_prod.loja_id, v_user) THEN
    RAISE EXCEPTION 'Produto indisponível ou usuário sem permissão' USING ERRCODE='42501';
  END IF;
  IF p_ativo IS NULL THEN
    RAISE EXCEPTION 'Informe a visibilidade informativa' USING ERRCODE='22023';
  END IF;
  IF p_ativo AND (
      v_prod.publicado OR v_prod.situacao::text <> 'A'
      OR coalesce(btrim(v_prod.sku),'') = '' OR coalesce(btrim(v_prod.nome),'') = ''
    ) THEN
    RAISE EXCEPTION 'Produto precisa estar ativo, identificado e não publicado comercialmente'
      USING ERRCODE='22023';
  END IF;
  -- Escopo do piloto: não relaxar exigências nem replicar regra a outro tenant.
  IF p_ativo AND NOT EXISTS (
      SELECT 1 FROM public.lojas l WHERE l.id = v_prod.loja_id AND l.slug='mobis'
    ) THEN
    RAISE EXCEPTION 'Catálogo informativo ainda não habilitado para esta loja' USING ERRCODE='42501';
  END IF;

  v_antes := v_prod.exibicao_informativa;
  UPDATE public.produtos
     SET exibicao_informativa=p_ativo
   WHERE id=p_produto AND loja_id=v_prod.loja_id;
  INSERT INTO public.auditoria(loja_id,user_id,acao,tabela,antes,depois)
  VALUES(v_prod.loja_id,v_user,'catalogo.informativo.definir','produtos',
    jsonb_build_object('sku',v_prod.sku,'exibicao_informativa',v_antes),
    jsonb_build_object('sku',v_prod.sku,'exibicao_informativa',p_ativo));
  RETURN jsonb_build_object('ok',true,'produto_id',p_produto,'exibicao_informativa',p_ativo);
END
$fn$;

REVOKE ALL ON FUNCTION public.catalogo_informativo_definir(uuid,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.catalogo_informativo_definir(uuid,boolean) TO authenticated;
COMMIT;
