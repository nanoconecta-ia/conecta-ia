import type { Imagem, Produto } from "@/lib/tipos";

/**
 * Exigências PROVISÓRIAS para publicar (decisão em aberto no docs/ARQUITETURA.md, seção 11).
 * Produto incompleto não é publicado. O resultado alimenta o status visual: nunca aparência estática.
 */
export type Exigencia = { chave: string; rotulo: string; ok: boolean };

export function avaliarPublicacao(p: Produto, imagens: Imagem[]): Exigencia[] {
  const principalReal = imagens.some((i) => i.principal && i.tipo === "real" && i.aprovada);
  return [
    { chave: "nome", rotulo: "Nome", ok: !!p.nome?.trim() },
    { chave: "sku", rotulo: "SKU", ok: !!p.sku?.trim() },
    { chave: "preco", rotulo: "Preço", ok: p.preco !== null && p.preco > 0 },
    { chave: "categoria", rotulo: "Categoria", ok: !!p.categoria?.trim() },
    { chave: "imagem", rotulo: "Imagem principal real aprovada", ok: principalReal },
  ];
}

export const prontoParaPublicar = (e: Exigencia[]) => e.every((x) => x.ok);

export const brl = (v: number | null) =>
  v === null ? "—" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
