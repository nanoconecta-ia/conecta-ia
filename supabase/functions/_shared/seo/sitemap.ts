// sitemap.xml e robots.txt. Só produto publicado/ativo/completo; despublicado sai do mapa. URLs absolutas só com domínio ativo.
// Limite por arquivo = 50.000 URLs (regra do protocolo sitemaps.org; a documentação do Google NÃO foi conferida neste ambiente).
import { escXml } from "./escape.ts";
import { dataIso, produtoIndexavel, type ProdutoSeo } from "./dados.ts";
import { baseUrl, caminhoPolitica, caminhoProduto } from "./url.ts";

export const MAX_URLS_SITEMAP = 50_000;
export interface UrlSitemap { loc: string; lastmod: string | null }

export function urlsDoSitemap(dominio: string | null, produtos: ProdutoSeo[], slugsPolitica: string[] = []): UrlSitemap[] {
  const base = baseUrl(dominio);
  if (!base) return [];
  const vistos = new Set<string>();
  const out: UrlSitemap[] = [{ loc: base + "/", lastmod: null }];
  for (const p of [...produtos].filter(produtoIndexavel).sort((a, b) => a.sku!.localeCompare(b.sku!))) {
    if (vistos.has(p.sku!)) continue;
    vistos.add(p.sku!);
    out.push({ loc: base + caminhoProduto(p.sku!), lastmod: dataIso(p.atualizado_em) });
  }
  for (const s of slugsPolitica) out.push({ loc: base + caminhoPolitica(s), lastmod: null });
  return out;
}
export const totalPaginasSitemap = (urls: UrlSitemap[]) => Math.max(1, Math.ceil(urls.length / MAX_URLS_SITEMAP));

export function gerarSitemap(dominio: string | null, produtos: ProdutoSeo[], pagina = 1, slugsPolitica: string[] = []): string | null {
  const urls = urlsDoSitemap(dominio, produtos, slugsPolitica);
  if (!urls.length || pagina < 1 || pagina > totalPaginasSitemap(urls)) return null;
  const fatia = urls.slice((pagina - 1) * MAX_URLS_SITEMAP, pagina * MAX_URLS_SITEMAP);
  const itens = fatia.map((u) => `  <url><loc>${escXml(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ""}</url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${itens}\n</urlset>\n`;
}
/** Índice de sitemaps: só existe quando passa de uma página. */
export function gerarIndiceSitemap(dominio: string | null, produtos: ProdutoSeo[], slugsPolitica: string[] = []): string | null {
  const base = baseUrl(dominio);
  const n = totalPaginasSitemap(urlsDoSitemap(dominio, produtos, slugsPolitica));
  if (!base || n < 2) return null;
  const itens = Array.from({ length: n }, (_, i) => `  <sitemap><loc>${escXml(`${base}/sitemap-${i + 1}.xml`)}</loc></sitemap>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${itens}\n</sitemapindex>\n`;
}

/** robots.txt. Loja SEM domínio ativo (acesso por slug/teste) bloqueia tudo: nada de prévia indexada por engano. */
export function gerarRobots(dominio: string | null): string {
  const base = baseUrl(dominio);
  if (!base) return "User-agent: *\nDisallow: /\n";
  return `User-agent: *\nAllow: /\nDisallow: /painel\nDisallow: /api/\n\nSitemap: ${base}/sitemap.xml\n`;
}
