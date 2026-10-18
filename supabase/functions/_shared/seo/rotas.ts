// Roteador puro da função loja-seo: dado o caminho, a loja (já resolvida no servidor) e os produtos publicados, devolve a resposta.
// Sem rede e sem banco: tudo testável. A função só busca os dados e chama responderSeo.
import { produtoIndexavel, type LojaSeo, type ProdutoSeo } from "./dados.ts";
import { gerarFeedMerchant } from "./feed_merchant.ts";
import { CABECALHOS_HTML, PAGINA_404, paginaPoliticaHtml, paginaProdutoHtml } from "./pagina.ts";
import { paginasPublicadas, SLUGS_POLITICA } from "./politicas.ts";
import { gerarIndiceSitemap, gerarRobots, gerarSitemap } from "./sitemap.ts";
import { skuDoCaminho } from "./url.ts";

export interface RespostaSeo { status: number; cabecalhos: Record<string, string>; corpo: string }
const XML = { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=300", "x-content-type-options": "nosniff" };
const TXT = { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=300", "x-content-type-options": "nosniff" };
const naoEncontrada = (): RespostaSeo => ({ status: 404, cabecalhos: { ...CABECALHOS_HTML, "x-robots-tag": "noindex" }, corpo: PAGINA_404 });
const indisponivel = (msg: string): RespostaSeo => ({ status: 409, cabecalhos: { ...TXT, "cache-control": "no-store" }, corpo: msg });

export function responderSeo(caminho: string, loja: LojaSeo | null, produtos: ProdutoSeo[]): RespostaSeo {
  if (!loja || !loja.ativa) return naoEncontrada(); // loja desconhecida e inativa respondem igual
  const slugsPol = paginasPublicadas(loja.politicas).map((p) => p.slug);

  if (caminho === "/robots.txt") return { status: 200, cabecalhos: TXT, corpo: gerarRobots(loja.dominio) };

  if (caminho === "/sitemap.xml" || /^\/sitemap-\d{1,3}\.xml$/.test(caminho)) {
    if (!loja.dominio) return indisponivel("Domínio ainda não ativo (DNS e SSL): sitemap indisponível.");
    const indice = caminho === "/sitemap.xml" ? gerarIndiceSitemap(loja.dominio, produtos, slugsPol) : null;
    const pagina = caminho === "/sitemap.xml" ? 1 : Number(caminho.match(/\d+/)![0]);
    const xml = indice ?? gerarSitemap(loja.dominio, produtos, pagina, slugsPol);
    return xml ? { status: 200, cabecalhos: XML, corpo: xml } : naoEncontrada();
  }

  if (caminho === "/feed/merchant.xml") {
    if (!loja.dominio) return indisponivel("Domínio ainda não ativo (DNS e SSL): feed indisponível.");
    const f = gerarFeedMerchant(loja, produtos);
    return f.xml ? { status: 200, cabecalhos: XML, corpo: f.xml } : indisponivel("Nenhum produto atende aos requisitos do feed.");
  }

  const prod = caminho.match(/^\/produto\/([^/]+)$/);
  if (prod) {
    const sku = skuDoCaminho(prod[1]);
    const p = sku ? produtos.find((x) => x.sku === sku) : undefined;
    if (!p || !produtoIndexavel(p)) return naoEncontrada(); // despublicado/ausente/incompleto: 404
    const previa = !loja.dominio; // acesso por slug: página existe, mas noindex e sem canonical
    return { status: 200, cabecalhos: { ...CABECALHOS_HTML, "cache-control": "public, max-age=300", ...(previa ? { "x-robots-tag": "noindex" } : {}) }, corpo: paginaProdutoHtml(loja, p) };
  }

  const pol = caminho.match(/^\/politicas\/([a-z-]+)$/);
  if (pol && SLUGS_POLITICA.includes(pol[1])) {
    const html = paginaPoliticaHtml(loja, pol[1]);
    return html ? { status: 200, cabecalhos: { ...CABECALHOS_HTML, "cache-control": "public, max-age=300" }, corpo: html } : naoEncontrada();
  }
  return naoEncontrada();
}
