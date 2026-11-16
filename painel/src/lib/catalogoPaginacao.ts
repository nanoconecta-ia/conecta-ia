/** Paginação segura do espelho: cada requisição fica limitada e escopada à loja. */
export const TAMANHO_LOTE_CATALOGO = 100;

/** Filtro PostgREST: aceita somente letras, números, espaços, hífen e barra.
 * Nunca aceitar vírgula, parênteses ou curingas fornecidos pelo usuário.
 * Busca literal (sem inferir equivalência de peças); a comparação ilike é feita no banco.
 */
export function termoBuscaCatalogo(busca: string): string {
  return busca.trim().slice(0, 80).replace(/[^\p{L}\p{N} \-/]/gu, " ").replace(/\s+/g, " ").trim();
}
export function expressaoBuscaCatalogo(busca: string, idsReferencias: readonly string[] = []): string | null {
  const termo = termoBuscaCatalogo(busca);
  if (!termo) return null;
  const campos = ["sku", "nome", "marca", "gtin", "bling_id", "descricao_curta", "descricao_complementar"]
    .map(campo => `${campo}.ilike.%${termo}%`);
  const idsValidos = [...new Set(idsReferencias)]
    .filter(id => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
    .slice(0,100);
  if (idsValidos.length) campos.push("id.in.(" + idsValidos.join(",") + ")");
  return campos.join(",");
}

/** Ordenação da API: nome + ID; evita duplicações mesmo após um refresh. */
export function juntarProdutosPorId<T extends { id: string }>(existentes: readonly T[], novos: readonly T[]): T[] {
  const porId = new Map(existentes.map(p => [p.id, p]));
  for (const p of novos) porId.set(p.id, p);
  return [...porId.values()];
}
export function existemMaisProdutos(carregados: number, total: number | null, ultimoLote: number): boolean {
  if (total !== null) return carregados < total && ultimoLote > 0;
  return ultimoLote === TAMANHO_LOTE_CATALOGO;
}
