// HTML mínimo renderizado no servidor para o robô (e para quem não executa JavaScript). Tudo escapado; o que está nos dados
// estruturados está visível na página (preço, disponibilidade, marca). Sem script executável: só o bloco JSON-LD (dados).
import { esc, scriptJsonLd } from "./escape.ts";
import { disponibilidade, imagemPrincipal, precoFmt, produtoIndexavel, textoSimples, type LojaSeo, type ProdutoSeo } from "./dados.ts";
import { blocosProduto, jsonLdOrganizacao, jsonLdWebSite } from "./jsonld.ts";
import { metadadosProduto, tagsHead } from "./metadados.ts";
import { paginasPublicadas } from "./politicas.ts";
import { baseUrl, caminhoPolitica } from "./url.ts";

export const CABECALHOS_HTML: Record<string, string> = {
  "content-type": "text/html; charset=utf-8",
  "content-security-policy": "default-src 'none'; img-src https:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  "x-content-type-options": "nosniff", "referrer-policy": "strict-origin-when-cross-origin",
  // HSTS só vale quando a hospedagem serve o domínio do cliente em HTTPS (dependência de infraestrutura; sem includeSubDomains/preload).
  "strict-transport-security": "max-age=31536000",
};

const ROTULO_IMAGEM = { real: null, ilustrativa: "Imagem ilustrativa", gerada_ia: "Imagem gerada por IA, apenas ilustração" } as const;
const moeda = (n: string) => `R$ ${n.replace(".", ",")}`;

function casca(loja: LojaSeo, head: string, corpo: string): string {
  const pol = paginasPublicadas(loja.politicas);
  const rodape = pol.length ? `<footer><nav>${pol.map((p) => `<a href="${esc(caminhoPolitica(p.slug))}">${esc(p.titulo)}</a>`).join(" · ")}</nav></footer>` : "";
  return `<!doctype html>\n<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">\n${head}\n<style>body{font-family:system-ui,sans-serif;margin:0 auto;max-width:48rem;padding:1rem;line-height:1.5}img{max-width:100%;height:auto}footer{margin-top:2rem;font-size:.9rem}</style></head>\n<body><header><a href="/">${esc(loja.nome)}</a></header>\n${corpo}\n${rodape}</body></html>\n`;
}

export function paginaProdutoHtml(loja: LojaSeo, p: ProdutoSeo): string {
  const m = metadadosProduto(loja, p);
  const blocos = blocosProduto(loja, p).map(scriptJsonLd).join("\n");
  const img = imagemPrincipal(p);
  const preco = precoFmt(p.preco), disp = disponibilidade(p.estoque);
  const desc = textoSimples(p.descricao, 2000) ?? textoSimples(p.descricao_longa, 2000);
  const corpo = [
    `<main><article><h1>${esc(p.nome)}</h1>`,
    p.marca ? `<p>Marca: ${esc(p.marca)}</p>` : "", `<p>Código: ${esc(p.sku)}</p>`,
    img ? `<figure><img src="${esc(img.url)}" alt="${esc(img.alt_texto || `${p.nome} (cód. ${p.sku})`)}"${img.largura_px && img.altura_px ? ` width="${img.largura_px}" height="${img.altura_px}"` : ""}>${ROTULO_IMAGEM[img.tipo] ? `<figcaption>${ROTULO_IMAGEM[img.tipo]}</figcaption>` : ""}</figure>` : "",
    preco ? `<p>Preço: ${esc(moeda(preco))}</p>` : "", disp ? `<p>${disp === "in_stock" ? "Em estoque" : "Indisponível no momento"}</p>` : "",
    desc ? `<p>${esc(desc)}</p>` : "", `</article></main>`,
  ].filter(Boolean).join("\n");
  return casca(loja, `${tagsHead(m)}\n${blocos}`, corpo);
}

export function paginaPoliticaHtml(loja: LojaSeo, slug: string): string | null {
  const pg = paginasPublicadas(loja.politicas).find((x) => x.slug === slug);
  if (!pg) return null;
  const indexa = loja.ativa && !!baseUrl(loja.dominio);
  const canon = indexa ? `${baseUrl(loja.dominio)}${caminhoPolitica(slug)}` : null;
  const head = [`<title>${esc(`${pg.titulo} | ${loja.nome}`)}</title>`, `<meta name="robots" content="${indexa ? "index,follow" : "noindex,nofollow"}">`, canon ? `<link rel="canonical" href="${esc(canon)}">` : ""].filter(Boolean).join("\n");
  const org = indexa ? [jsonLdOrganizacao(loja), jsonLdWebSite(loja)].filter((x) => x !== null).map(scriptJsonLd).join("\n") : "";
  const paragrafos = pg.texto.split(/\n+/).map((l) => `<p>${esc(l)}</p>`).join("\n");
  return casca(loja, `${head}\n${org}`, `<main><h1>${esc(pg.titulo)}</h1>\n${paragrafos}</main>`);
}

/** 404 genérico: não revela se a loja ou o produto existem. */
export const PAGINA_404 = `<!doctype html>\n<html lang="pt-BR"><head><meta charset="utf-8"><meta name="robots" content="noindex,nofollow"><title>Página não encontrada</title></head><body><h1>Página não encontrada</h1></body></html>\n`;
export { produtoIndexavel };
