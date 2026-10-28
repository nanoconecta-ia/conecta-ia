// Portas de PRODUÇÃO do executor local sobre o cliente do Supabase (service_role, só no servidor). Mesmo código usado pela Edge Function
// e pelos testes de integração contra o esquema real (via cliente psql de teste). Nada aqui guarda segredo nem escreve fora da fila e da auditoria.
import type { EstadoTarefa, PortasFilaDb } from "./runner_db.ts";
import type { ChaveMcp } from "../conector/gateway.ts";

interface Rpc { rpc(fn: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string } | null }> }
interface Admin extends Rpc { from(tabela: string): any }

export function filaDbSupabase(admin: Rpc): PortasFilaDb {
  const chamar = async (fn: string, args: Record<string, unknown>) => {
    const { data, error } = await admin.rpc(fn, args);
    if (error) throw new Error(`${fn}: ${error.message}`);       // a mensagem do banco não carrega comando nem saída
    return data;
  };
  return {
    async enfileirar(a) {
      return String(await chamar("exec_local_enfileirar", { p_loja: a.loja_id, p_dispositivo: a.dispositivo_id, p_capacidade: a.capacidade,
        p_argv: a.argv, p_timeout_ms: a.timeout_ms, p_idem: a.idem ?? null, p_agente: a.agente ?? null }));
    },
    async estado(loja_id, tarefa_id) { return (await chamar("exec_local_estado", { p_loja: loja_id, p_tarefa: tarefa_id })) as EstadoTarefa | null; },
    async cancelar(loja_id, tarefa_id) { return (await chamar("exec_local_cancelar", { p_loja: loja_id, p_tarefa: tarefa_id })) === true; },
  };
}

/** Dispositivo agente_desktop ATIVO da loja. "Online" = visto há ≤ 90 s (pair_validar só atualiza ultimo_uso_em a cada 30 s). */
export async function dispositivoAtivo(admin: Admin, loja_id: string, agora = Date.now()): Promise<{ dispositivo_id: string; hosts_permitidos: readonly string[] } | null> {
  const { data, error } = await admin.from("pair_dispositivos").select("id, ultimo_uso_em").eq("loja_id", loja_id).eq("tipo", "agente_desktop").is("revogado_em", null).order("ultimo_uso_em", { ascending: false }).limit(5);
  if (error || !Array.isArray(data)) return null;
  const vivo = data.find((d: { ultimo_uso_em: string | null }) => d.ultimo_uso_em && agora - Date.parse(d.ultimo_uso_em) <= 90_000);
  return vivo ? { dispositivo_id: vivo.id, hosts_permitidos: [] } : null;
}

/** Auditoria do despacho (decisões do Policy local: negadas, falhas…). Só ids e motivo; nunca a saída nem o comando. Falhar aqui BLOQUEIA a entrega. */
export function auditarDespacho(admin: Admin, chave: ChaveMcp) {
  return async (e: { loja_id: string; dispositivo_id: string; agente: string; tarefa_id: string; capacidade: string; resultado: string; detalhe?: string }) => {
    const { error } = await admin.from("auditoria").insert({
      loja_id: e.loja_id, user_id: chave.criada_por, acao: `exec_local.despacho.${e.resultado.toLowerCase()}`, tabela: "exec_local_tarefas",
      depois: { tarefa_id: e.tarefa_id, dispositivo_id: e.dispositivo_id, capacidade: e.capacidade, agente: e.agente, chave_id: chave.chave_id, motivo: e.detalhe ?? null },
    });
    if (error) throw new Error("falha_na_auditoria");
  };
}
