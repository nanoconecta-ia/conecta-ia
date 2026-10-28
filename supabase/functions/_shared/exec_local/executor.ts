// Despachante local: policy → consentimento → pausa/revogação → timeout → auditoria → evidência.
// Puro: o runner (quem de fato abre PowerShell/Browser) é injetado. Na fase 1 só existe runner de mock.
import { argvPowerShell, buscarCapacidade, renderizar } from "./capacidades.ts";
import { sha256Hex } from "../conector/cripto.ts";

export interface SessaoLocal {
  sessao_id: string; loja_id: string; dispositivo_id: string; agente: string; // agente = "claude" | "gemini" | "gpt"... (só rótulo)
  escopos: readonly ("consulta" | "proposta")[];                                 // aprovacao/escrita nunca vêm do escopo: vêm do consentimento
  hosts_permitidos: readonly string[];
}
export interface Consentimento { tarefa_hash: string; aprovado_por: string; expira_em: number }
export interface Tarefa { tarefa_id: string; capacidade: string; params: Record<string, unknown>; idempotency_key?: string }
export interface Runner { executar(executor: "windows" | "browser", argvOuComando: string[] | string, timeoutMs: number, sinal: AbortSignal): Promise<{ saida: string }> }
export interface Portas {
  agora(): number;
  revogada(sessao_id: string): Promise<boolean>;
  pausada(loja_id: string): Promise<boolean>;
  consentimento(tarefa_id: string): Promise<Consentimento | null>;
  auditar(e: { sessao_id: string; loja_id: string; dispositivo_id: string; agente: string; tarefa_id: string; capacidade: string; resultado: string; detalhe?: string }): Promise<void>;
  runner: Runner;
}
export type Veredito = { estado: "CONCLUIDA"; evidencia: { saida: string; sha256: string; em: number; capacidade: string } }
  | { estado: "NEGADA" | "REQUER_APROVACAO" | "FALHOU" | "DESCONHECIDO"; motivo: string };

export const hashTarefa = (t: Tarefa) => sha256Hex(JSON.stringify([t.capacidade, Object.entries(t.params).sort()]));

export async function executar(s: SessaoLocal, t: Tarefa, p: Portas): Promise<Veredito> {
  const fim = async (v: Veredito, detalhe?: string): Promise<Veredito> => {
    try {
      await p.auditar({ sessao_id: s.sessao_id, loja_id: s.loja_id, dispositivo_id: s.dispositivo_id, agente: s.agente, tarefa_id: t.tarefa_id, capacidade: t.capacidade, resultado: v.estado, detalhe: detalhe ?? ("motivo" in v ? v.motivo : undefined) });
    } catch { return { estado: "FALHOU", motivo: "auditoria_indisponivel: nada é entregue sem registro" }; }
    return v;
  };
  const c = buscarCapacidade(t.capacidade);
  if (!c) return fim({ estado: "NEGADA", motivo: "capacidade_desconhecida" });
  if (c.estado !== "ativa") return fim({ estado: "NEGADA", motivo: "capacidade_desligada" });
  if (await p.revogada(s.sessao_id)) return fim({ estado: "NEGADA", motivo: "sessao_revogada" });
  if (await p.pausada(s.loja_id)) return fim({ estado: "NEGADA", motivo: "loja_pausada" });
  if (c.camada === "escrita") return fim({ estado: "NEGADA", motivo: "escrita_desligada_na_fase_1" });
  if ((c.camada === "consulta" || c.camada === "proposta") && !s.escopos.includes(c.camada)) return fim({ estado: "NEGADA", motivo: `escopo_insuficiente:${c.camada}` });
  const r = renderizar(c, t.params);
  if (!r.ok) return fim({ estado: "NEGADA", motivo: r.motivo });
  if (c.executor === "browser") {
    const host = new URL(String(t.params.url)).hostname;
    if (!s.hosts_permitidos.includes(host)) return fim({ estado: "NEGADA", motivo: `host_fora_da_lista:${host}` });
  }
  if (c.camada === "aprovacao") {
    const k = await p.consentimento(t.tarefa_id);
    if (!k) return fim({ estado: "REQUER_APROVACAO", motivo: "sem_consentimento_para_esta_operacao" });
    if (k.expira_em <= p.agora()) return fim({ estado: "REQUER_APROVACAO", motivo: "consentimento_expirado" });
    if (k.tarefa_hash !== await hashTarefa(t)) return fim({ estado: "NEGADA", motivo: "consentimento_de_outra_tarefa" });
  }
  const ctl = new AbortController(); let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const exec = p.runner.executar(c.executor, c.executor === "windows" ? argvPowerShell(r.comando) : r.comando, c.timeoutMs, ctl.signal);
    const limite = new Promise<never>((_, rej) => { timer = setTimeout(() => { ctl.abort(); rej(new Error("timeout")); }, c.timeoutMs); });
    const { saida } = await Promise.race([exec, limite]);
    return fim({ estado: "CONCLUIDA", evidencia: { saida, sha256: await sha256Hex(saida), em: p.agora(), capacidade: c.id } });
  } catch (e) {
    return fim({ estado: "DESCONHECIDO", motivo: (e as Error).message === "timeout" ? "timeout: estado não confirmado, não repetir às cegas" : "falha_do_runner" });
  } finally { if (timer) clearTimeout(timer); }
}
