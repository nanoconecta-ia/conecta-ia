// Apagar várias conversas do histórico, uma por uma. Uma conversa com turno em execução recusa a exclusão: ela é contada
// à parte e as demais seguem. Função pura (recebe quem apaga), testável sem rede.
export interface ResultadoApagar { apagadas: string[]; recusadas: { id: string; motivo: string }[] }

export async function apagarVarias(ids: readonly string[], apagar: (id: string) => Promise<void>): Promise<ResultadoApagar> {
  const r: ResultadoApagar = { apagadas: [], recusadas: [] };
  for (const id of ids) {
    try { await apagar(id); r.apagadas.push(id); }
    catch (e) { r.recusadas.push({ id, motivo: e instanceof Error ? e.message : String(e) }); }
  }
  return r;
}

export function mensagemApagar(r: ResultadoApagar): string {
  if (r.recusadas.length === 0) return r.apagadas.length === 0 ? "Não havia conversa para apagar." : `${r.apagadas.length} conversa(s) apagada(s). A auditoria foi preservada.`;
  return `${r.apagadas.length} apagada(s); ${r.recusadas.length} não foi possível apagar agora (pode haver resposta em andamento). Tente de novo em alguns minutos.`;
}
