// Vitrine pública de uma loja. Lógica pura (testável sem rede): normaliza host/slug e monta só os campos públicos.
// Nunca expõe custo, fornecedor, bling_id nem dado de outra loja. Produto só entra se `publicado` (a leitura filtra no banco).
export const SLUG_RE = /^[a-z0-9-]{2,63}$/;

/** "WWW.Loja.com.br:443" -> "www.loja.com.br". Devolve null se não parecer um host. */
export function normalizarHost(h: unknown): string | null {
  if (typeof h !== "string") return null;
  const x = h.trim().toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "");
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(x) && x.length <= 253 ? x : null;
}

export interface LinhaProduto {
  nome: string | null; sku: string | null; preco: number | string | null; estoque: number | string | null;
  marca: string | null; descricao_curta: string | null; atualizado_em?: string | null; sincronizado_em?: string | null;
  imagem?: string | null;
}
export interface ProdutoVitrine {
  nome: string; sku: string; preco: number | null; em_estoque: boolean | null; marca: string | null;
  descricao: string | null; imagem: string | null; whatsapp: string | null; atualizado_em: string | null;
}

const num = (v: unknown) => (v == null || v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null);
/** Texto simples: o espelho pode trazer HTML do Bling; a vitrine mostra só texto. */
export function textoSimples(s: string | null | undefined, max = 240): string | null {
  if (!s) return null;
  const t = s.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
  return t ? t.slice(0, max) : null;
}

export function linkWhatsapp(numero: string | null | undefined, nome: string, sku: string): string | null {
  let d = (numero ?? "").replace(/\D/g, "");
  if (d.length === 10 || d.length === 11) d = "55" + d; // DDD + número => acrescenta o país
  if (!/^55\d{10,11}$/.test(d)) return null;
  return `https://wa.me/${d}?text=${encodeURIComponent(`Olá! Tenho interesse em ${nome} (cód. ${sku}).`)}`;
}

/** Linhas sem nome ou SKU não aparecem (produto incompleto não é publicado). */
export function montarVitrine(linhas: LinhaProduto[], whatsapp: string | null): ProdutoVitrine[] {
  const out: ProdutoVitrine[] = [];
  for (const l of linhas) {
    if (!l.nome || !l.sku) continue;
    const est = num(l.estoque);
    out.push({
      nome: l.nome, sku: l.sku, preco: num(l.preco), em_estoque: est == null ? null : est > 0,
      marca: l.marca, descricao: textoSimples(l.descricao_curta), imagem: l.imagem ?? null,
      whatsapp: linkWhatsapp(whatsapp, l.nome, l.sku), atualizado_em: l.sincronizado_em ?? l.atualizado_em ?? null,
    });
  }
  return out;
}

export interface Aplicacao { produto_id: string; modelo: string; motorizacao: string | null; ano_inicial: number | null; ano_final: number | null }
/** O ano cai no intervalo (aberto quando falta um dos lados)? Sem nenhum limite informado, NÃO confirma. */
export function anoNoIntervalo(ano: number, ini: number | null, fim: number | null): boolean {
  if (ini == null && fim == null) return false;
  return (ini == null || ano >= ini) && (fim == null || ano <= fim);
}
/** Ids de produto cujas aplicações APROVADAS batem com os filtros escolhidos (modelo, motor e ano; todos opcionais). */
export function produtosDoVeiculo(apls: Aplicacao[], f: { modelo?: string; motor?: string; ano?: number }): Set<string> {
  const ids = new Set<string>();
  for (const a of apls) {
    if (f.modelo && a.modelo !== f.modelo) continue;
    if (f.motor && a.motorizacao !== f.motor) continue;
    if (f.ano != null && !anoNoIntervalo(f.ano, a.ano_inicial, a.ano_final)) continue;
    ids.add(a.produto_id);
  }
  return ids;
}
/** Opções da busca por veículo (cascata), só do que existe aprovado nos produtos publicados. */
export function opcoesVeiculo(apls: Aplicacao[]) {
  return apls.map((a) => ({ modelo: a.modelo, motor: a.motorizacao, de: a.ano_inicial, ate: a.ano_final }))
    .filter((v, i, arr) => arr.findIndex((o) => o.modelo === v.modelo && o.motor === v.motor && o.de === v.de && o.ate === v.ate) === i)
    .slice(0, 500);
}
