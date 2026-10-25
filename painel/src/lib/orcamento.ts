// Orçamento por WhatsApp: o cliente junta peças e envia UMA mensagem à loja. Não é checkout: nada é cobrado nem reservado.
// Preço é o de referência do espelho do Bling; a loja confirma preço e estoque na conversa. Puro e testável.
export interface ItemOrcamento { sku: string; nome: string; preco: number | null; qtd: number }
export const MAX_ITENS = 20, MAX_QTD = 99;

const limitar = (q: number) => Math.min(MAX_QTD, Math.max(1, Math.floor(Number.isFinite(q) ? q : 1)));
const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function adicionar(lista: ItemOrcamento[], item: Omit<ItemOrcamento, "qtd">, qtd = 1): ItemOrcamento[] {
  const i = lista.findIndex((x) => x.sku === item.sku);
  if (i >= 0) return lista.map((x, k) => (k === i ? { ...x, preco: item.preco, qtd: limitar(x.qtd + qtd) } : x));
  return lista.length >= MAX_ITENS ? lista : [...lista, { ...item, qtd: limitar(qtd) }];
}
export const alterarQtd = (lista: ItemOrcamento[], sku: string, qtd: number): ItemOrcamento[] => lista.map((x) => (x.sku === sku ? { ...x, qtd: limitar(qtd) } : x));
export const remover = (lista: ItemOrcamento[], sku: string): ItemOrcamento[] => lista.filter((x) => x.sku !== sku);

/** Total de referência; null se algum item não tem preço (não se soma o que não se sabe). */
export function totalReferencia(lista: ItemOrcamento[]): number | null {
  if (!lista.length || lista.some((x) => x.preco == null)) return null;
  return lista.reduce((s, x) => s + (x.preco as number) * x.qtd, 0);
}

export function mensagemOrcamento(lista: ItemOrcamento[], origem?: string): string {
  const linhas = ["Olá! Gostaria de um orçamento destas peças:"];
  lista.forEach((x, i) => linhas.push(`${i + 1}. ${x.qtd}x ${x.nome} (cód. ${x.sku})${x.preco != null ? ` — ref. ${brl(x.preco)} cada` : ""}`));
  const t = totalReferencia(lista);
  if (t != null) linhas.push(`Total de referência: ${brl(t)}`);
  linhas.push("Valores de referência do site; aguardo a confirmação de preço e estoque.");
  if (origem) linhas.push(origem);
  return linhas.join("\n");
}

/** Número (só dígitos, com 55) extraído do link wa.me que a vitrine já entrega por produto. */
export function numeroDoLink(link: string | null | undefined): string | null {
  const m = /^https:\/\/wa\.me\/(55\d{10,11})(?:\?|$)/.exec(link ?? "");
  return m ? m[1] : null;
}
export function linkOrcamento(numero: string | null, lista: ItemOrcamento[], origem?: string): string | null {
  if (!numero || !lista.length) return null;
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensagemOrcamento(lista, origem))}`;
}

/** Persistência por loja no navegador; qualquer falha de armazenamento vira lista vazia (a tela funciona sem). */
interface Armazem { getItem(k: string): string | null; setItem(k: string, v: string): void }
const chave = (slug: string) => `orcamento:${slug}`;
export function carregar(slug: string, a: Armazem | null): ItemOrcamento[] {
  try {
    const bruto = JSON.parse(a?.getItem(chave(slug)) ?? "[]");
    if (!Array.isArray(bruto)) return [];
    return bruto.filter((x) => x && typeof x.sku === "string" && typeof x.nome === "string").slice(0, MAX_ITENS)
      .map((x) => ({ sku: x.sku.slice(0, 80), nome: x.nome.slice(0, 200), preco: typeof x.preco === "number" && x.preco >= 0 ? x.preco : null, qtd: limitar(Number(x.qtd)) }));
  } catch { return []; }
}
export function salvar(slug: string, lista: ItemOrcamento[], a: Armazem | null): void {
  try { a?.setItem(chave(slug), JSON.stringify(lista)); } catch { /* sem armazenamento: segue em memória */ }
}
