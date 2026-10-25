// Redução ESTRUTURADA de resultado de ferramenta para o modelo: nunca corta JSON no meio.
// Encolhe a maior lista (metade por vez) até caber e declara o que foi omitido; o que não for lista vira resumo válido.
export interface MarcaReducao { truncado: true; tamanho_original: number; omitidos: Record<string, number> }

export function reduzirJson(valor: unknown, limite: number): string {
  const cheio = JSON.stringify(valor) ?? "null";
  if (cheio.length <= limite) return cheio;
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) {
    return JSON.stringify({ _reducao: { truncado: true, tamanho_original: cheio.length, omitidos: {} }, resumo: cheio.slice(0, Math.max(0, limite - 200)) });
  }
  const o: Record<string, unknown> = { ...(valor as Record<string, unknown>) };
  const omitidos: Record<string, number> = {};
  const marca = (): MarcaReducao => ({ truncado: true, tamanho_original: cheio.length, omitidos });
  for (let volta = 0; volta < 64; volta++) {
    const atual = JSON.stringify({ ...o, _reducao: marca() });
    if (atual.length <= limite) return atual;
    let maior: string | null = null;
    for (const [k, v] of Object.entries(o)) if (Array.isArray(v) && v.length > 0 && (maior === null || JSON.stringify(v).length > JSON.stringify(o[maior]).length)) maior = k;
    if (!maior) break;
    const lista = o[maior] as unknown[]; const fica = Math.floor(lista.length / 2);
    omitidos[maior] = (omitidos[maior] ?? 0) + lista.length - fica; o[maior] = lista.slice(0, fica);
  }
  // sem mais listas para encolher: descarta campos de texto/objeto grandes, preservando chaves pequenas
  for (const [k, v] of Object.entries(o)) if (JSON.stringify(v).length > 400 && !Array.isArray(v)) { o[k] = "[omitido por tamanho]"; omitidos[k] = 1; }
  return JSON.stringify({ ...o, _reducao: marca() });
}
