// Regras do chat retrátil (como no chat do Claude): só as últimas respostas ficam abertas, as antigas viram uma linha
// e as muito longas mostram só o começo. Funções puras: a tela só desenha o que elas decidem.
export const MANTER_ABERTAS = 2;       // últimas mensagens sempre abertas
export const LIMITE_LONGA = 520;       // acima disso a resposta mostra só o começo
export const TRECHO_RECOLHIDO = 120;

/** Resumo de uma linha: sem marcação, sem quebra de linha, terminando em reticências quando cortado. */
export function resumoLinha(texto: string, max = TRECHO_RECOLHIDO): string {
  const t = texto.replace(/[*_`#>~|]/g, "").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const corte = t.lastIndexOf(" ", max);
  return `${t.slice(0, corte > max * 0.6 ? corte : max).trim()}…`;
}

/** Quais mensagens aparecem recolhidas. `abertas` = o que a pessoa abriu à mão; `todas` força tudo aberto/recolhido. */
export function mensagemRecolhida(indice: number, total: number, abertas: ReadonlySet<number>, modo: "auto" | "recolher" | "expandir"): boolean {
  if (modo === "expandir") return false;
  if (abertas.has(indice)) return false;
  if (modo === "recolher") return true;
  return indice < total - MANTER_ABERTAS;
}

export const ehLonga = (texto: string): boolean => texto.length > LIMITE_LONGA;
/** Começo de uma resposta longa, cortado em fim de frase quando possível. */
export function comecoDaLonga(texto: string): string {
  if (!ehLonga(texto)) return texto;
  const cabe = texto.slice(0, LIMITE_LONGA);
  const fim = Math.max(cabe.lastIndexOf(". "), cabe.lastIndexOf("\n"));
  return `${(fim > LIMITE_LONGA * 0.5 ? cabe.slice(0, fim + 1) : cabe).trimEnd()}…`;
}

/** Texto do cabeçalho da evidência recolhida (o que o agente fez, em uma linha). */
export function resumoEvidencia(ev: { origem?: string; total_candidatos?: number; candidatos?: unknown[]; simulado?: boolean }): string {
  const n = ev.total_candidatos ?? ev.candidatos?.length;
  const onde = ev.origem === "api_bling" ? "Bling (API)" : "espelho";
  return `${ev.simulado ? "Simulado · " : ""}Consulta ao ${onde}${typeof n === "number" ? ` · ${n} candidato${n === 1 ? "" : "s"}` : ""}`;
}
