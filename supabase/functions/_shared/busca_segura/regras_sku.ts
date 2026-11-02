// SKU automático (resposta A do dono, 02/11/2026: "proposta sim"): formato `CI` + 6 dígitos, o mesmo do CI000016/CI001086. Puro.
// O agente só PROPÕE o SKU; quem aprova é o lojista. Nunca reutiliza um código já conhecido (ativo, inativo ou excluído) e nunca altera SKU existente.
// LIMITE ASSUMIDO: a reserva atômica da sequência exige o banco; no piloto (um cadastro por vez) a colisão é evitada conferindo o espelho e o Bling na hora.
export const FORMATO_SKU = /^CI(\d{6})$/;
export const skuValido = (s: string): boolean => FORMATO_SKU.test(s);
const chave = (s: string) => s.trim().toUpperCase();

/** Maior número de sequência entre os códigos conhecidos que seguem o formato CI000000 (os outros formatos são ignorados). */
export function sequenciaMaxima(codigos: readonly string[]): number {
  let max = 0;
  for (const c of codigos) { const m = FORMATO_SKU.exec(chave(c)); if (m) max = Math.max(max, Number(m[1])); }
  return max;
}
/** Próximo SKU livre: depois do maior conhecido, pulando qualquer código ocupado. `ocupados` inclui o que o Bling acusou como existente (qualquer situação). */
export function proximoSku(conhecidos: readonly string[], ocupados: readonly string[] = []): string {
  const usados = new Set([...conhecidos, ...ocupados].map(chave));
  for (let n = sequenciaMaxima([...conhecidos, ...ocupados]) + 1; n <= 999_999; n++) {
    const sku = `CI${String(n).padStart(6, "0")}`;
    if (!usados.has(sku)) return sku;
  }
  throw new Error("Sequência CI esgotada (999999): definir novo prefixo com o dono.");
}
