// Metadados de página (title, description, canonical, robots, Open Graph) com dado real. Sem domínio ativo ou produto
// despublicado => noindex e sem canonical. Descrição ausente fica ausente (não se escreve texto genérico no lugar).
import { esc, truncar } from "./escape.ts";
import { imagemPrincipal, produtoIndexavel, textoSimples, type LojaSeo, type ProdutoSeo } from "./dados.ts";
import { urlProduto } from "./url.ts";

export interface Metadados {
  indexavel: boolean; title: string; description: string | null; canonical: string | null; robots: string;
  og: { title: string; description: string | null; type: "product" | "website"; url: string | null; image: string | null; site_name: string; locale: "pt_BR" };
}
// Limites de exibição abaixo são escolha de projeto (corte de segurança), NÃO regra do Google (NÃO CONFERIDO).
export const LIMITE_TITLE = 70, LIMITE_DESCRIPTION = 160;

export function metadadosProduto(loja: LojaSeo, p: ProdutoSeo): Metadados {
  const indexavel = loja.ativa && !!loja.dominio && produtoIndexavel(p);
  const nome = p.nome?.trim() || "Produto";
  const title = truncar([nome, p.marca && !nome.toLowerCase().includes(p.marca.toLowerCase()) ? p.marca : null, loja.nome].filter(Boolean).join(" | "), LIMITE_TITLE);
  const bruta = textoSimples(p.descricao, 400) ?? textoSimples(p.descricao_longa, 400);
  const description = bruta ? truncar(bruta, LIMITE_DESCRIPTION) : null;
  const canonical = indexavel && p.sku ? urlProduto(loja.dominio, p.sku) : null;
  const img = indexavel ? imagemPrincipal(p) : null;
  return {
    indexavel, title, description, canonical, robots: indexavel ? "index,follow" : "noindex,nofollow",
    og: { title, description, type: "product", url: canonical, image: img?.url ?? null, site_name: loja.nome, locale: "pt_BR" },
  };
}

/** Tags do <head>, escapadas. */
export function tagsHead(m: Metadados): string {
  const l: string[] = [`<title>${esc(m.title)}</title>`, `<meta name="robots" content="${esc(m.robots)}">`];
  if (m.description) l.push(`<meta name="description" content="${esc(m.description)}">`);
  if (m.canonical) l.push(`<link rel="canonical" href="${esc(m.canonical)}">`);
  if (m.indexavel) {
    l.push(`<meta property="og:title" content="${esc(m.og.title)}">`, `<meta property="og:type" content="${m.og.type}">`,
      `<meta property="og:site_name" content="${esc(m.og.site_name)}">`, `<meta property="og:locale" content="${m.og.locale}">`);
    if (m.og.description) l.push(`<meta property="og:description" content="${esc(m.og.description)}">`);
    if (m.og.url) l.push(`<meta property="og:url" content="${esc(m.og.url)}">`);
    if (m.og.image) l.push(`<meta property="og:image" content="${esc(m.og.image)}">`);
  }
  return l.join("\n");
}
