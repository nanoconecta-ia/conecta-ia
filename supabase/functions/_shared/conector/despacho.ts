// Despachante único: Policy Engine -> validação de esquema -> handler -> registro de auditoria. Chat e gateway MCP passam por aqui.
import { HANDLERS, type ContextoFerramenta } from "./handlers.ts";
import { buscarDefinicao, ferramentasVisiveis, idDoNomeLlm, nomeParaLlm } from "./registro.ts";
import { decidir } from "./policy.ts";
import { resumirErros, validar } from "./schema.ts";
import type { Decisao, Origem, Permissao } from "./tipos.ts";
import type { Ferramenta } from "../ia/tipos.ts";

export interface ContextoDespacho extends ContextoFerramenta {
  origem: Exclude<Origem, "executor">;
  escopos?: readonly Permissao[];
  mcpChaveId?: string | null;
}
export interface ResultadoDespacho { ok: boolean; decisao: Decisao; resultado?: unknown; erro?: string; auditoria_falhou?: boolean }

async function registrar(c: ContextoDespacho, id: string, decisao: Decisao, motivo: string, entrada: unknown, saida: unknown, ms: number): Promise<boolean> {
  const def = buscarDefinicao(id);
  try {
    const { error } = await c.rpc("agente_chamada_registrar", { p_loja: c.lojaId, p_origem: c.origem, p_conversa: c.conversaId ?? null, p_tarefa: c.tarefaId ?? null,
      p_user: c.userId, p_mcp_chave: c.mcpChaveId ?? null, p_ferramenta: id, p_risco: def?.risco ?? null, p_decisao: decisao, p_motivo: motivo, p_entrada: entrada ?? null, p_saida: saida ?? null, p_duracao: ms });
    return !error;
  } catch { return false; }
}

export async function despachar(id: string, entrada: unknown, c: ContextoDespacho): Promise<ResultadoDespacho> {
  const ini = Date.now();
  const def = buscarDefinicao(id);
  const pol = decidir(def, { origem: c.origem, escopos: c.escopos });
  if (pol.decisao !== "permitida") {
    await registrar(c, id, pol.decisao, pol.motivo, entrada, null, Date.now() - ini);
    return { ok: false, decisao: pol.decisao, erro: pol.motivo };
  }
  const erros = validar(def!.entrada, entrada ?? {});
  if (erros.length) {
    const motivo = `entrada_invalida: ${resumirErros(erros)}`;
    await registrar(c, id, "negada", motivo, entrada, null, Date.now() - ini);
    return { ok: false, decisao: "negada", erro: motivo };
  }
  const h = HANDLERS[id];
  if (!h) { await registrar(c, id, "negada", "sem_handler", entrada, null, Date.now() - ini); return { ok: false, decisao: "negada", erro: "ferramenta sem implementação" }; }
  let resultado: unknown, falha: string | undefined;
  try { resultado = await h(entrada ?? {}, c); } catch (e) { falha = e instanceof Error ? e.message.slice(0, 300) : "falha na ferramenta"; }
  const ok = falha === undefined && !(resultado && typeof resultado === "object" && "erro" in (resultado as object));
  const gravou = await registrar(c, id, "permitida", falha ?? (ok ? pol.motivo : "retornou erro"), entrada, falha ? { erro: falha } : resultado, Date.now() - ini);
  const auditoria_falhou = gravou ? undefined : true;
  if (falha) return { ok: false, decisao: "permitida", erro: falha, auditoria_falhou };
  return { ok, decisao: "permitida", resultado, erro: ok ? undefined : String((resultado as any).erro), auditoria_falhou };
}

/** Lista de ferramentas no formato que os adaptadores de LLM entendem (nomes sem ponto). */
export function ferramentasParaLlm(origem: "chat" | "gateway_mcp", escopos: readonly Permissao[] = []): Ferramenta[] {
  return ferramentasVisiveis(origem, escopos).map((f) => ({ name: nomeParaLlm(f.id), description: f.descricao, input_schema: f.entrada as Record<string, unknown> }));
}

/** Callback para o laço de conversa: devolve sempre um objeto (nunca lança), para o modelo poder se corrigir. */
export function executorParaLlm(c: ContextoDespacho) {
  return async (nome: string, entrada: unknown): Promise<unknown> => {
    const r = await despachar(idDoNomeLlm(nome), entrada, c);
    return r.ok ? r.resultado : { erro: r.erro, decisao: r.decisao };
  };
}
