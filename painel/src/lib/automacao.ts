// Catálogo: seleção visual de produtos (um ou um lote) para parar ou retomar o cadastro automático. Quem aplica é o banco (automacao_pausar).
export const LIMITE_LOTE = 500;

/** Liga/desliga um item na seleção sem alterar a lista original. */
export function alternar(selecionados: ReadonlySet<string>, id: string): Set<string> {
  const n = new Set(selecionados);
  if (n.has(id)) n.delete(id); else n.add(id);
  return n;
}
/** Seleciona todos os visíveis, ou limpa se já estavam todos selecionados. */
export function alternarTodos(selecionados: ReadonlySet<string>, ids: readonly string[]): Set<string> {
  return ids.length > 0 && ids.every((i) => selecionados.has(i)) ? new Set() : new Set(ids);
}
export const textoLote = (n: number) => (n === 1 ? "1 produto" : `${n} produtos`);

export function mensagemAutomacao(pausar: boolean, n: number): string {
  return pausar
    ? `Cadastro automático parado em ${textoLote(n)}. Nenhum agente propõe nada neles até você retomar.`
    : `Cadastro automático retomado em ${textoLote(n)}.`;
}
export function erroAutomacao(codigo: string | undefined, n: number): string {
  if (codigo === "42501") return "Só o lojista da loja pode parar ou retomar o cadastro automático.";
  if (n > LIMITE_LOTE) return `Selecione no máximo ${LIMITE_LOTE} produtos por vez.`;
  return "Não foi possível atualizar. Tente de novo.";
}
