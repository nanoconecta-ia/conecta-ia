/** Liga fichas públicas por categoria do catálogo, NUNCA por compatibilidade inferida.
 * A entrada deve vir exclusivamente da API pública (já filtrada por permissões).
 */
export interface ProdutoRelacionado {
  sku: string;
  nome: string;
  marca: string | null;
  imagem: string | null;
  categoria?: string | null;
  consulta_previa?: boolean;
}

export function selecionarRelacionados<T extends ProdutoRelacionado>(
  atual: { sku: string; categoria?: string | null },
  visiveis: readonly T[],
  limite = 6,
): T[] {
  const distintos = new Set<string>();
  const candidatos = visiveis.filter((p) => {
    if (!p.sku || !p.nome || p.sku === atual.sku || distintos.has(p.sku)) return false;
    distintos.add(p.sku);
    return true;
  });
  // Mesma categoria é uma associação editorial de navegação; não significa
  // intercambiável, recomendado para o veículo ou aprovado para a mesma versão.
  const categoria = atual.categoria?.trim().toLocaleLowerCase("pt-BR");
  const rank = (p: T) => categoria && p.categoria?.trim().toLocaleLowerCase("pt-BR") === categoria ? 0 : 1;
  return candidatos.sort((a, b) => rank(a) - rank(b)).slice(0, Math.max(0, Math.min(12, limite)));
}
