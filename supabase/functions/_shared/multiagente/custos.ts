// Custos, orçamento, concorrência e limite de taxa do orquestrador. Funções puras ou com portas injetadas (banco ou memória).
export type CapacidadeId = "identificador" | "pesquisador" | "taxonomista" | "compatibilidade" | "enriquecedor" | "auditor";
export type TipoExecucao = "deterministica" | "api" | "llm";
export interface RegistroCusto { capacidade: CapacidadeId | "orquestrador"; tarefa: string; tipo: TipoExecucao; fonte?: string; chamadas: number; tokens_in: number; tokens_out: number; usd: number; duracao_ms: number }

export interface PortaCustos {
  /** Reserva o custo estimado antes de gastar. `ok:false` = estouraria o orçamento; nada é gasto. */
  tentar(capacidade: CapacidadeId, tipo: TipoExecucao, fonte: string, usdEstimado: number): Promise<{ ok: boolean; id?: string }>;
  confirmar(id: string, r: RegistroCusto): Promise<void>;
  registrar(r: RegistroCusto): Promise<void>;
}

/** Razão em memória com orçamento: usada nos testes e no experimento. A versão de produção é `custosRpc` (banco, reserva atômica). */
export function custosEmMemoria(limiteUsd: number): PortaCustos & { registros: RegistroCusto[]; gasto(): number } {
  const registros: RegistroCusto[] = [];
  const reservas = new Map<string, number>();
  let n = 0;
  const gasto = () => registros.reduce((t, r) => t + r.usd, 0) + [...reservas.values()].reduce((t, v) => t + v, 0);
  return {
    registros, gasto,
    async tentar(_c, _t, _f, usd) { if (gasto() + usd > limiteUsd) return { ok: false }; const id = String(++n); reservas.set(id, usd); return { ok: true, id }; },
    async confirmar(id, r) { reservas.delete(id); registros.push(r); },
    async registrar(r) { registros.push(r); },
  };
}

type Rpc = (fn: string, args: Record<string, unknown>) => Promise<{ data: any; error: { message: string } | null }>;
export function custosRpc(rpc: Rpc, lojaId: string, itemId: string | null): PortaCustos {
  const chamar = async (fn: string, args: Record<string, unknown>) => { const { data, error } = await rpc(fn, args); if (error) throw new Error(error.message); return data; };
  return {
    async tentar(c, t, f, usd) { const id = await chamar("pipeline_custo_tentar", { p_loja: lojaId, p_item: itemId, p_capacidade: c, p_tipo: t, p_fonte: f, p_usd_estimado: usd }); return id == null ? { ok: false } : { ok: true, id: String(id) }; },
    async confirmar(id, r) { await chamar("pipeline_custo_confirmar", { p_loja: lojaId, p_custo: Number(id), p_usd_real: r.usd, p_chamadas: r.chamadas, p_tokens_in: r.tokens_in, p_tokens_out: r.tokens_out, p_duracao_ms: Math.round(r.duracao_ms) }); },
    async registrar(r) { await chamar("pipeline_custo_registrar", { p_loja: lojaId, p_item: itemId, p_capacidade: r.capacidade === "orquestrador" ? "orquestrador" : r.capacidade, p_tipo: r.tipo, p_fonte: r.fonte ?? null, p_duracao_ms: Math.round(r.duracao_ms) }); },
  };
}

/** No máximo `max` tarefas ao mesmo tempo; as demais esperam na fila. */
export function criarLimitador(max: number): <T>(fn: () => Promise<T>) => Promise<T> {
  let ativos = 0;
  const fila: (() => void)[] = [];
  return async <T>(fn: () => Promise<T>): Promise<T> => {
    if (ativos >= max) await new Promise<void>((ok) => fila.push(ok));
    ativos++;
    try { return await fn(); } finally { ativos--; fila.shift()?.(); }
  };
}

/** Garante intervalo mínimo entre chamadas à MESMA fonte (limite de requisições da fonte). */
export function criarLimiteTaxa(agora: () => number = Date.now, esperar: (ms: number) => Promise<void> = (ms) => new Promise((ok) => setTimeout(ok, ms))) {
  const proxima = new Map<string, number>();
  return async (chave: string, intervaloMs: number): Promise<void> => {
    if (!intervaloMs) return;
    const t = agora();
    const livre = Math.max(t, proxima.get(chave) ?? 0);
    proxima.set(chave, livre + intervaloMs);
    if (livre > t) await esperar(livre - t);
  };
}

export const somar = (rs: RegistroCusto[]) => rs.reduce((t, r) => ({ usd: t.usd + r.usd, tokens_in: t.tokens_in + r.tokens_in, tokens_out: t.tokens_out + r.tokens_out, chamadas: t.chamadas + r.chamadas, duracao_ms: t.duracao_ms + r.duracao_ms }), { usd: 0, tokens_in: 0, tokens_out: 0, chamadas: 0, duracao_ms: 0 });
