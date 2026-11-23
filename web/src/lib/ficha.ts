import type { Produto, ProdutoAplicacao } from "@/lib/tipos";

/**
 * Regras da ficha pública (catálogo enriquecido). Funções puras, sem acesso a banco,
 * para poderem ser testadas e reaproveitadas pela página e pelo JSON-LD.
 *
 * Decisões aplicadas (docs/conector-ia/regra-mestra-catalogo-enriquecido-sem-preco-sem-foto):
 *  - O preço do Bling NÃO é preço autorizado de catálogo: catálogo informativo não mostra preço.
 *  - Compatibilidade incerta nunca é anunciada: só aplicação/OEM `aprovado` aparece.
 *  - Aplicações pendentes → página informativa fica noindex.
 */

export type OrigemFicha = "catalogo_informativo" | "oferta_comercial";

/**
 * Hoje toda ficha pública é `catalogo_informativo` (piloto, Fase 1 — modo WhatsApp, sem checkout).
 * Vira `oferta_comercial` só quando o lojista autorizar a exposição de preço/imagem por produto
 * (decisão em aberto em docs/ARQUITETURA.md §11). Até lá, sem preço.
 */
export function origemFicha(_loja: { modo_venda: string }): OrigemFicha {
  return "catalogo_informativo";
}

/** Preço só pode aparecer numa oferta comercial autorizada. Informativo → nunca. */
export function precoPublicoAutorizado(loja: { modo_venda: string }): boolean {
  return origemFicha(loja) === "oferta_comercial";
}

/**
 * Página informativa sem aplicação confirmada é incerta → noindex (não disputa busca).
 * Passa a indexável quando há oferta autorizada ou pelo menos uma aplicação aprovada.
 */
export function deveIndexar(args: { precoAutorizado: boolean; aplicacoesAprovadas: number }): boolean {
  return args.precoAutorizado || args.aplicacoesAprovadas > 0;
}

/** Faixa de anos legível a partir de ano_inicial/ano_final (sem inventar o que falta). */
export function faixaAnos(a: Pick<ProdutoAplicacao, "ano_inicial" | "ano_final">): string | null {
  if (a.ano_inicial && a.ano_final) return a.ano_inicial === a.ano_final ? `${a.ano_inicial}` : `${a.ano_inicial}–${a.ano_final}`;
  if (a.ano_inicial) return `${a.ano_inicial}+`;
  if (a.ano_final) return `até ${a.ano_final}`;
  return null;
}

/**
 * Dados estruturados schema.org com os MESMOS valores exibidos na página.
 * Sem Offer quando o preço não é autorizado (nunca anuncia preço/estoque que a página não mostra).
 * Sem campos vazios (não inventa GTIN, imagem nem descrição).
 */
export function montarJsonLdProduto(args: {
  produto: Produto;
  url: string;
  imagemUrl?: string | null;
  precoAutorizado: boolean;
}): Record<string, unknown> {
  const { produto, url, imagemUrl, precoAutorizado } = args;
  const ld: Record<string, unknown> = { "@context": "https://schema.org", "@type": "Product", name: produto.nome ?? undefined };
  if (produto.sku) ld.sku = produto.sku;
  if (produto.gtin) ld.gtin = produto.gtin;
  if (produto.marca) ld.brand = { "@type": "Brand", name: produto.marca };
  if (imagemUrl) ld.image = imagemUrl;
  if (produto.descricao) ld.description = produto.descricao;
  if (precoAutorizado && produto.preco && produto.preco > 0) {
    ld.offers = {
      "@type": "Offer",
      price: produto.preco,
      priceCurrency: "BRL",
      url,
      availability: (produto.estoque ?? 0) > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    };
  }
  return ld;
}
