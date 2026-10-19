// URLs absolutas só com domínio ativo vindo do servidor. Sem domínio ativo => null (nada de canonical inventado).
import { normalizarHost } from "../loja/publica.ts";

export function baseUrl(dominio: string | null | undefined): string | null {
  const h = normalizarHost(dominio ?? "");
  return h ? `https://${h}` : null;
}
export const caminhoProduto = (sku: string) => `/produto/${encodeURIComponent(sku)}`;
export function urlProduto(dominio: string | null | undefined, sku: string): string | null {
  const b = baseUrl(dominio);
  return b ? b + caminhoProduto(sku) : null;
}
/** Segmento do caminho -> SKU, ou null se for inválido (vazio, grande, com barra ou caractere de controle). */
export function skuDoCaminho(segmento: string): string | null {
  let s: string;
  try { s = decodeURIComponent(segmento); } catch { return null; }
  if (!s || s.length > 80 || /[\u0000-\u001F\u007F/\\]/.test(s)) return null;
  return s;
}
export const caminhoPolitica = (slug: string) => `/politicas/${slug}`;
