/** Piloto de 10 SKUs: apenas seleção e estados públicos do lote, nunca conteúdo fiscal. */
export type ItemLote = { produto_id: string; sku: string | null; nome: string | null; estado: "apto" | "automacao_pausada" | "produto_inativo" | "ja_na_fila" };
export type PreviaLote = { itens: ItemLote[]; aptos: number; pausados: number; inativos: number; ja_na_fila: number; aviso: string; enfileirados?: number };
export const LIMITE_PILOTO_ENRIQUECIMENTO = 10;

export function chaveDaSelecao(ids: readonly string[]): string {
  return [...new Set(ids)].sort().join("|");
}

export function resumoDaPrevia(pre: PreviaLote): string {
  return `${pre.aptos} apto(s) · ${pre.pausados} pausado(s) · ${pre.inativos} inativo(s) · ${pre.ja_na_fila} já na fila`;
}

export function previaValida(pre: unknown): pre is PreviaLote {
  if (!pre || typeof pre !== "object") return false;
  const p = pre as Partial<PreviaLote>;
  if (!Array.isArray(p.itens) || p.itens.length > LIMITE_PILOTO_ENRIQUECIMENTO) return false;
  if (![p.aptos,p.pausados,p.inativos,p.ja_na_fila].every(x => Number.isSafeInteger(x) && (x as number)>=0)) return false;
  const estados = new Set(["apto","automacao_pausada","produto_inativo","ja_na_fila"]);
  return p.itens.every(i=>i && typeof i.produto_id==="string" && estados.has(i.estado)) &&
    Number(p.aptos) + Number(p.pausados) + Number(p.inativos) + Number(p.ja_na_fila) === p.itens.length;
}
