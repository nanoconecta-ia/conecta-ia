// Tipos e normalizações dos dados que alimentam SEO e feed. Só dado real e aprovado; vazio fica vazio.
import { textoSimples } from "../loja/publica.ts";
export { textoSimples };

export interface PoliticasPublicas {
  razao_social: string | null; cnpj: string | null; endereco: string | null; telefone: string | null; email_contato: string | null;
  garantia_legal_dias: number | null; arrependimento_dias: number | null;
  garantia_texto: string | null; troca_devolucao_texto: string | null; entrega_texto: string | null; privacidade_texto: string | null; termos_texto: string | null;
}
/** `dominio` vem SEMPRE do servidor (dominios_ativos: DNS e SSL verificados), nunca do cliente. null = loja sem domínio ativo. */
export interface LojaSeo { nome: string; slug: string; ativa: boolean; dominio: string | null; whatsapp: string | null; politicas: PoliticasPublicas | null }
export interface ImagemPublica {
  url: string; principal: boolean; ordem: number; tipo: "real" | "gerada_ia" | "ilustrativa"; alt_texto: string | null;
  largura_px: number | null; altura_px: number | null; fundo_branco: boolean;
}
export interface ProdutoSeo {
  sku: string | null; nome: string | null; descricao: string | null; descricao_longa: string | null; marca: string | null; gtin: string | null;
  mpn: string | null; preco: number | null; estoque: number | null; publicado: boolean; situacao: string | null; atualizado_em: string | null;
  categoria: string | null; imagens: ImagemPublica[];
  /** Sempre false enquanto o mapeamento do campo `condicao` do Bling não for conferido: a condição nunca é publicada. */
  condicao_ok?: boolean;
}

/** Produto visível e indexável: publicado, ativo no ERP, com nome e SKU. Despublicado/ausente/incompleto => fora de sitemap e feed. */
export const produtoIndexavel = (p: ProdutoSeo): boolean => p.publicado === true && p.situacao === "A" && !!p.nome?.trim() && !!p.sku?.trim();

/** O Bling às vezes traz o rótulo no valor ("MARCA: TRIM GO"). Tira só o rótulo; o resto fica como veio. */
export function limparMarca(m: string | null | undefined): string | null {
  const t = (m ?? "").trim().replace(/^marca\s*:\s*/i, "").trim();
  return t ? t : null;
}

/** GS1: só dígitos, 8/12/13/14 posições e dígito verificador correto. GTIN inválido nunca é enviado. */
export function gtinValido(g: string | null | undefined): boolean {
  const d = (g ?? "").trim();
  if (!/^\d+$/.test(d) || ![8, 12, 13, 14].includes(d.length)) return false;
  let soma = 0;
  for (let i = d.length - 2, peso = 3; i >= 0; i--, peso = peso === 3 ? 1 : 3) soma += Number(d[i]) * peso;
  return (10 - (soma % 10)) % 10 === Number(d[d.length - 1]);
}
export const nomePropGtin = (g: string): "gtin8" | "gtin12" | "gtin13" | "gtin14" => (`gtin${g.length}` as "gtin8" | "gtin12" | "gtin13" | "gtin14");

/** Disponibilidade só do estoque real espelhado. Estoque desconhecido => null (não se afirma nada). */
export function disponibilidade(estoque: number | null | undefined): "in_stock" | "out_of_stock" | null {
  if (estoque == null || !Number.isFinite(estoque)) return null;
  return estoque > 0 ? "in_stock" : "out_of_stock";
}
/** "900.00". Preço ausente, zero ou negativo => null (não se publica preço inventado). */
export function precoFmt(n: number | null | undefined): string | null {
  return n != null && Number.isFinite(n) && n > 0 ? n.toFixed(2) : null;
}
/** Data ISO válida (YYYY-MM-DD) ou null. */
export function dataIso(v: string | null | undefined): string | null {
  if (!v) return null;
  const t = Date.parse(v);
  return Number.isFinite(t) ? new Date(t).toISOString().slice(0, 10) : null;
}
/** Imagem principal publicável (a leitura já veio filtrada por direitos/aprovação), na ordem principal > ordem. */
export function imagemPrincipal(p: ProdutoSeo): ImagemPublica | null {
  const l = [...p.imagens].filter((i) => /^https:\/\//i.test(i.url)).sort((a, b) => Number(b.principal) - Number(a.principal) || a.ordem - b.ordem);
  return l[0] ?? null;
}
