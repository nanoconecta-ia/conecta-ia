// Feed de produtos para o Google Merchant Center (RSS 2.0 com namespace g:). Somente geração local: nada é enviado a lugar nenhum.
// Formato XML escolhido por segurança de escape (TSV depende de tabulação em texto livre); a ESCOLHA não vem da documentação.
// NÃO CONFERIDO (documentação do Google inacessível neste ambiente): lista exata de atributos obrigatórios, namespace
// http://base.google.com/ns/1.0, formato "900.00 BRL", limites de título (150) e descrição (5000), máx. de imagens adicionais (10),
// valores "in stock"/"out of stock". Cada ponto está marcado em REGRAS_MERCHANT.conferido = false.
import { escXml, truncar } from "./escape.ts";
import { disponibilidade, gtinValido, imagemPrincipal, limparMarca, precoFmt, produtoIndexavel, textoSimples, type LojaSeo, type ProdutoSeo } from "./dados.ts";
import { baseUrl, urlProduto } from "./url.ts";

export const REGRAS_MERCHANT = {
  namespace: { valor: "http://base.google.com/ns/1.0", conferido: false },
  tituloMax: { valor: 150, conferido: false }, descricaoMax: { valor: 5000, conferido: false }, imagensAdicionaisMax: { valor: 10, conferido: false },
  imagemMinimaPx: { valor: 100, conferido: false }, imagemRecomendadaPx: { valor: 800, conferido: false },
} as const;

export interface ResultadoProduto { sku: string; ok: boolean; motivos: string[]; avisos: string[] }

/** Bloqueia o que não pode ser enviado sem inventar dado. Sem a regra do Google confirmada, bloqueia por segurança. */
export function validarProdutoMerchant(loja: LojaSeo, p: ProdutoSeo): ResultadoProduto {
  const motivos: string[] = [], avisos: string[] = [];
  const sku = p.sku?.trim() || "(sem SKU)";
  if (!loja.ativa) motivos.push("loja inativa");
  if (!loja.dominio) motivos.push("loja sem domínio ativo (link absoluto impossível)");
  if (!p.publicado) motivos.push("produto não publicado");
  else if (p.situacao !== "A") motivos.push("produto inativo ou ausente no Bling");
  if (!p.sku?.trim()) motivos.push("sem SKU (id do item)");
  if (!p.nome?.trim()) motivos.push("sem título");
  if (!precoFmt(p.preco)) motivos.push("sem preço válido");
  if (disponibilidade(p.estoque) === null) motivos.push("estoque desconhecido (availability não pode ser presumida)");
  if (!textoSimples(p.descricao, 5000) && !textoSimples(p.descricao_longa, 5000)) motivos.push("sem descrição");
  if (!limparMarca(p.marca)) motivos.push("sem marca");
  const temGtin = !!p.gtin && gtinValido(p.gtin);
  if (p.gtin && !temGtin) motivos.push("GTIN inválido (dígito verificador/tamanho)");
  if (!temGtin && !p.mpn?.trim()) motivos.push("sem GTIN válido nem MPN aprovado (identifier_exists não é decidido automaticamente)");
  const img = imagemPrincipal(p);
  if (!img) motivos.push("sem imagem principal publicável (aprovada, com direitos e https)");
  else {
    if (img.tipo === "gerada_ia") motivos.push("imagem principal é sintética (gerada por IA)");
    if (img.tipo === "ilustrativa") avisos.push("imagem ilustrativa: verificação manual de conformidade");
    if (img.largura_px == null || img.altura_px == null) avisos.push("resolução da imagem desconhecida: verificação manual");
    else if (Math.min(img.largura_px, img.altura_px) < REGRAS_MERCHANT.imagemMinimaPx.valor) motivos.push(`imagem menor que ${REGRAS_MERCHANT.imagemMinimaPx.valor}px (regra NÃO CONFERIDA)`);
    else if (Math.min(img.largura_px, img.altura_px) < REGRAS_MERCHANT.imagemRecomendadaPx.valor) avisos.push(`imagem abaixo do recomendado (${REGRAS_MERCHANT.imagemRecomendadaPx.valor}px, NÃO CONFERIDO)`);
    if (!img.fundo_branco) avisos.push("fundo branco não confirmado: verificação manual");
    avisos.push("marca d'água/sobreposição não é mensurável por metadados: verificação manual");
  }
  if (!p.condicao_ok) avisos.push("condição (novo/usado) não informada: o mapeamento do campo do Bling NÃO foi conferido");
  if (p.nome && p.nome.length > REGRAS_MERCHANT.tituloMax.valor) avisos.push(`título será cortado em ${REGRAS_MERCHANT.tituloMax.valor} caracteres`);
  return { sku, ok: motivos.length === 0, motivos, avisos };
}

export interface FeedGerado { xml: string | null; incluidos: string[]; bloqueados: ResultadoProduto[]; avisos: ResultadoProduto[] }

export function gerarFeedMerchant(loja: LojaSeo, produtos: ProdutoSeo[]): FeedGerado {
  const base = baseUrl(loja.dominio);
  const incluidos: string[] = [], bloqueados: ResultadoProduto[] = [], avisos: ResultadoProduto[] = [];
  const itens: string[] = [];
  const vistos = new Set<string>();
  for (const p of produtos) {
    const r = validarProdutoMerchant(loja, p);
    if (r.ok && vistos.has(p.sku!)) { r.ok = false; r.motivos.push("SKU duplicado no feed"); }
    if (!r.ok) { bloqueados.push(r); continue; }
    vistos.add(p.sku!);
    if (r.avisos.length) avisos.push(r);
    const img = imagemPrincipal(p)!;
    const extras = [...p.imagens].filter((i) => /^https:\/\//i.test(i.url) && i.url !== img.url).sort((a, b) => a.ordem - b.ordem).slice(0, REGRAS_MERCHANT.imagensAdicionaisMax.valor);
    const preco = precoFmt(p.preco)!, disp = disponibilidade(p.estoque)!;
    const desc = truncar(textoSimples(p.descricao, 5000) ?? textoSimples(p.descricao_longa, 5000)!, REGRAS_MERCHANT.descricaoMax.valor);
    const l = [
      `<g:id>${escXml(p.sku!.trim())}</g:id>`, `<title>${escXml(truncar(p.nome!, REGRAS_MERCHANT.tituloMax.valor))}</title>`,
      `<description>${escXml(desc)}</description>`, `<link>${escXml(urlProduto(loja.dominio, p.sku!)!)}</link>`,
      `<g:image_link>${escXml(img.url)}</g:image_link>`, ...extras.map((i) => `<g:additional_image_link>${escXml(i.url)}</g:additional_image_link>`),
      `<g:availability>${disp === "in_stock" ? "in stock" : "out of stock"}</g:availability>`, `<g:price>${preco} BRL</g:price>`,
      `<g:brand>${escXml(limparMarca(p.marca)!)}</g:brand>`,
    ];
    if (p.gtin && gtinValido(p.gtin)) l.push(`<g:gtin>${escXml(p.gtin.trim())}</g:gtin>`);
    if (p.mpn?.trim()) l.push(`<g:mpn>${escXml(p.mpn.trim())}</g:mpn>`);
    itens.push(`    <item>\n      ${l.join("\n      ")}\n    </item>`);
    incluidos.push(p.sku!.trim());
  }
  const xml = base && itens.length
    ? `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:g="${REGRAS_MERCHANT.namespace.valor}">\n  <channel>\n    <title>${escXml(loja.nome)}</title>\n    <link>${escXml(base)}</link>\n    <description>${escXml(`Catálogo ${loja.nome}`)}</description>\n${itens.join("\n")}\n  </channel>\n</rss>\n`
    : null;
  return { xml, incluidos, bloqueados, avisos };
}
