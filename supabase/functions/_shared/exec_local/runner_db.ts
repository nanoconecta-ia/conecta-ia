// Runner da Fase B: em vez de executar aqui, ENFILEIRA na fila persistente (exec_local_tarefas) e espera o agente do dispositivo
// devolver o resultado. O despachante (executor.ts: policy, consentimento, timeout, auditoria, evidência) segue o mesmo.
import type { Runner } from "./executor.ts";

export interface EstadoTarefa { estado: "NA_FILA" | "EM_EXECUCAO" | "CONCLUIDA" | "FALHOU" | "DESCONHECIDO" | "CANCELADA"; saida?: string | null; erro?: string | null }
export interface PortasFilaDb {
  enfileirar(a: { loja_id: string; dispositivo_id: string; capacidade: string; argv: string[]; timeout_ms: number; idem?: string; agente?: string }): Promise<string>;
  estado(loja_id: string, tarefa_id: string): Promise<EstadoTarefa | null>;
  cancelar(loja_id: string, tarefa_id: string): Promise<boolean>;
}
export interface ContextoRunnerDb { loja_id: string; dispositivo_id: string; capacidade: string; agente?: string; idem?: string; intervaloMs?: number }
const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function criarRunnerDb(db: PortasFilaDb, c: ContextoRunnerDb): Runner {
  return {
    async executar(executor, argvOuComando, timeoutMs, sinal) {
      if (executor !== "windows" || !Array.isArray(argvOuComando)) throw new Error("runner_db_so_windows");
      const id = await db.enfileirar({ loja_id: c.loja_id, dispositivo_id: c.dispositivo_id, capacidade: c.capacidade, argv: argvOuComando, timeout_ms: timeoutMs, idem: c.idem, agente: c.agente });
      const fim = Date.now() + timeoutMs + 12000;           // mesma folga da lease do banco
      while (Date.now() < fim) {
        if (sinal.aborted) { await db.cancelar(c.loja_id, id).catch(() => false); throw new Error("abortado"); }
        const t = await db.estado(c.loja_id, id);
        if (!t) throw new Error("tarefa_inexistente");
        if (t.estado === "CONCLUIDA") return { saida: t.saida ?? "" };
        if (t.estado === "FALHOU") throw new Error(t.erro ?? "falha_no_agente");
        if (t.estado === "CANCELADA") throw new Error(t.erro ?? "cancelada");
        if (t.estado === "DESCONHECIDO") throw new Error("resultado_nao_confirmado");
        await dormir(c.intervaloMs ?? 250);
      }
      await db.cancelar(c.loja_id, id).catch(() => false);
      throw new Error("timeout");
    },
  };
}
