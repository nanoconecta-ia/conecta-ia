// Dados estruturados (JSON-LD) só com o que é real e visível na página. Sem rating, review, aggregateRating nem availability
// presumida. Sem domínio ativo ou produto não indexável => nada é gerado.
import { disponibilidade, gtinValido, imagemPrincipal, nomePropGtin, precoFmt, produtoIndexavel, textoSimples, type LojaSeo, type ProdutoSeo } from "./dados.ts";
import { baseUrl, caminhoProduto, urlProduto } from "./url.ts";

const SCHEMA = "https://schema.org";
const DISP = { in_stock: `${SCHEMA}/InStock`, out_of_stock: `${SCHEMA}/OutOfStock` } as const;

export function jsonLdOrganizacao(loja: LojaSeo): Record<string, unknown> | null {
  const base = baseUrl(loja.dominio);
  if (!loja.ativa || !base) return null;
  const pol = loja.politicas;
  const o: Record<string, unknown> = { "@context": SCHEMA, "@type": "Organization", name: loja.nome, url: base };
  if (pol?.razao_social) o.legalName = pol.razao_social;
  if (pol?.telefone) o.telephone = pol.telefone;
  if (pol?.email_contato) o.email = pol.email_contato;
  if (pol?.endereco) o.address = pol.endereco;
  return o;
}
export function jsonLdWebSite(loja: LojaSeo): Record<string, unknown> | null {
  const base = baseUrl(loja.dominio);
  return loja.ativa && base ? { "@context": SCHEMA, "@type": "WebSite", name: loja.nome, url: base } : null;
}
export function jsonLdBreadcrumb(loja: LojaSeo, p: ProdutoSeo): Record<string, unknown> | null {
  const base = baseUrl(loja.dominio);
  if (!loja.ativa || !base || !produtoIndexavel(p)) return null;
  const itens: Record<string, unknown>[] = [{ "@type": "ListItem", position: 1, name: loja.nome, item: base + "/" }];
  if (p.categoria) itens.push({ "@type": "ListItem", position: itens.length + 1, name: p.categoria });
  itens.push({ "@type": "ListItem", position: itens.length + 1, name: p.nome, item: base + caminhoProduto(p.sku!) });
  return { "@context": SCHEMA, "@type": "BreadcrumbList", itemListElement: itens };
}
export function jsonLdProduto(loja: LojaSeo, p: ProdutoSeo): Record<string, unknown> | null {
  const url = p.sku ? urlProduto(loja.dominio, p.sku) : null;
  if (!loja.ativa || !url || !produtoIndexavel(p)) return null;
  const o: Record<string, unknown> = { "@context": SCHEMA, "@type": "Product", name: p.nome!.trim(), sku: p.sku!.trim(), url };
  const desc = textoSimples(p.descricao, 500) ?? textoSimples(p.descricao_longa, 500);
  if (desc) o.description = desc;
  if (p.marca?.trim()) o.brand = { "@type": "Brand", name: p.marca.trim() };
  if (p.gtin && gtinValido(p.gtin)) o[nomePropGtin(p.gtin)] = p.gtin.trim();
  if (p.mpn?.trim()) o.mpn = p.mpn.trim();
  const imgs = [...p.imagens].filter((i) => /^https:\/\//i.test(i.url));
  const principal = imagemPrincipal(p);
  if (principal) o.image = [principal.url, ...imgs.filter((i) => i.url !== principal.url).map((i) => i.url)].slice(0, 10);
  const preco = precoFmt(p.preco), disp = disponibilidade(p.estoque);
  // Oferta só com preço real; availability só com estoque real. Sem um deles, a oferta inteira é omitida.
  if (preco && disp) o.offers = { "@type": "Offer", url, price: preco, priceCurrency: "BRL", availability: DISP[disp], seller: { "@type": "Organization", name: loja.nome } };
  return o;
}
/** Todos os blocos da página de produto (já sem nulos). */
export function blocosProduto(loja: LojaSeo, p: ProdutoSeo): Record<string, unknown>[] {
  return [jsonLdProduto(loja, p), jsonLdBreadcrumb(loja, p), jsonLdOrganizacao(loja)].filter((x): x is Record<string, unknown> => x !== null);
}
