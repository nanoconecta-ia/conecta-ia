/** Catálogo informativo: só a resposta pública esconde preço e estoque.
 * O ERP e o espelho retêm os valores originais. Não divulgar oferta/checkout
 * nem alegar disponibilidade. Essa regra é específica do estado informativo,
 * não modifica o portão comercial `publicar_produto`.
 */
export function linhaInformativaSemComercial<T extends { preco?: unknown; estoque?: unknown }>(
  linha: T, informativa: boolean,
): T {
  return informativa ? { ...linha, preco: null, estoque: null } : linha;
}

/** A exibição de teste anterior também é informativa, mas não habilita produção.
 * A coluna `exibicao_informativa` é a permissão explícita e persistente do
 * lojista para exibir ficha pública sem oferta comercial.
 */
export function modoInformativoProduto(
  previaLegacy: boolean,
  produto: { exibicao_informativa?: unknown },
): boolean {
  return previaLegacy || produto.exibicao_informativa === true;
}
