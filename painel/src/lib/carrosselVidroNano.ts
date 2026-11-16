/** Navegação acessível do carrossel de fotografias, sem auto-play nem gravação. */
export function indiceVisivel(total: number, indice: number): number {
  if (total <= 0 || !Number.isFinite(indice)) return 0;
  return ((Math.trunc(indice) % total) + total) % total;
}
export function proximaFoto(total: number, atual: number, sentido: -1 | 1): number {
  return indiceVisivel(total, atual + sentido);
}
export function indiceDaFoto(itens: readonly {id:string}[], selecionada: string | null): number {
  if (itens.length === 0) return 0;
  return Math.max(0, itens.findIndex(x => x.id === selecionada));
}
