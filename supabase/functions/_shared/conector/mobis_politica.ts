/** Política absoluta do tenant Mobis Autopeças.
 * Bling é fonte SOMENTE LEITURA, mesmo após aprovação humana,
 * mudança futura de flags de ambiente ou liberação de campos.
 * Propostas e enriquecimentos gravam só no Conecta.IA conforme os portões próprios.
 */
export const MOBIS_LOJA_ID = "cd9d7570-f095-44f2-be28-b9b9cba6578e" as const;
export function blingEscritaNegadaPorPolitica(lojaId: string, operacao: string): boolean {
  return lojaId.toLowerCase() === MOBIS_LOJA_ID && operacao.startsWith("bling.");
}
export const MENSAGEM_MOBIS_BLING_SOMENTE_LEITURA =
  "Mobis Autopeças: Bling somente leitura. O agente pode consultar e propor no Conecta.IA, mas não criar, alterar ou excluir no ERP.";
