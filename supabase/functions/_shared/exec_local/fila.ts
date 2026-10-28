// Fila de tarefas locais: o agente (qualquer LLM) ENFILEIRA; o executor do dispositivo PUXA (nunca recebe chamada de fora).
// Contrato em memória para a fase 1; a versão com banco entra depois, com a mesma interface.
import { executar, type Portas, type SessaoLocal, type Tarefa, type Veredito } from "./executor.ts";
import { buscarCapacidade } from "./capacidades.ts";

export interface ItemFila { tarefa: Tarefa; sessao: SessaoLocal; estado: "NA_FILA" | "EM_EXECUCAO" | Veredito["estado"]; veredito?: Veredito }

export class FilaLocal {
  private itens = new Map<string, ItemFila>();
  private portas: Portas;
  constructor(portas: Portas) { this.portas = portas; }

  /** Agente: pede uma capacidade. Idempotente por idempotency_key. Capacidade inexistente nem entra na fila. */
  enfileirar(sessao: SessaoLocal, tarefa: Tarefa): { ok: true; tarefa_id: string } | { ok: false; motivo: string } {
    if (!buscarCapacidade(tarefa.capacidade)) return { ok: false, motivo: "capacidade_desconhecida" };
    const chave = tarefa.idempotency_key;
    if (chave) for (const i of this.itens.values()) if (i.tarefa.idempotency_key === chave && i.sessao.sessao_id === sessao.sessao_id) return { ok: true, tarefa_id: i.tarefa.tarefa_id };
    this.itens.set(tarefa.tarefa_id, { tarefa, sessao, estado: "NA_FILA" });
    return { ok: true, tarefa_id: tarefa.tarefa_id };
  }

  /** Executor do dispositivo: puxa a próxima tarefa DA SUA LOJA e DISPOSITIVO, executa pelo despachante e devolve o veredito. */
  async puxarEExecutar(loja_id: string, dispositivo_id: string): Promise<ItemFila | null> {
    for (const i of this.itens.values()) {
      if (i.estado !== "NA_FILA" || i.sessao.loja_id !== loja_id || i.sessao.dispositivo_id !== dispositivo_id) continue;
      i.estado = "EM_EXECUCAO";
      i.veredito = await executar(i.sessao, i.tarefa, this.portas);
      i.estado = i.veredito.estado;
      return i;
    }
    return null;
  }
  estado(tarefa_id: string) { return this.itens.get(tarefa_id); }
}
