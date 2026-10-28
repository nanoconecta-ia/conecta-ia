// Gateway MCP + capacidades locais, em COMPOSIÇÃO: o gateway de produção (conector/gateway.ts) NÃO é alterado.
// Este wrapper autentica igual (token → hash → chave → limite) e atende tools/list e tools/call das capacidades locais;
// todo o resto é delegado a tratarMcp. Fase local: a fila é em memória e o executor do dispositivo é um laço separado.
import { tratarMcp, type ChaveMcp, type PortasGateway, type RequisicaoMcp, type RespostaMcp } from "../conector/gateway.ts";
import { pareceTokenMcp, sha256Hex } from "../conector/cripto.ts";
import { buscarCapacidade, type Executor } from "./capacidades.ts";
import { ferramentasLocaisMcp } from "./catalogo_mcp.ts";
import type { FilaLocal } from "./fila.ts";
import type { SessaoLocal, Tarefa, Veredito } from "./executor.ts";

export interface PortasLocais {
  /** Só a fase local (fila em memória). Em produção (executarInline) não é usada. */
  fila?: FilaLocal;
  /** Dispositivo pareado da loja da chave (Pair). null = sem dispositivo autorizado. */
  dispositivo(chave: ChaveMcp): { dispositivo_id: string; hosts_permitidos: readonly string[] } | null | Promise<{ dispositivo_id: string; hosts_permitidos: readonly string[] } | null>;
  /** Executores com runner LIGADO neste ambiente (padrão: todos). Em produção, só "windows": o que não tem runner não é anunciado nem aceito. */
  executoresAtivos?: readonly Executor[];
  novoId(): string;
  esperaMs: number;
  /** Fase B: executa na hora (despachante + runner sobre a fila persistente) em vez de usar a fila em memória. */
  executarInline?(sessao: SessaoLocal, tarefa: Tarefa, chave: ChaveMcp): Promise<Veredito>;
}
const escoposLocais = (c: ChaveMcp) => c.escopos.flatMap((e) => (e === "leitura" ? ["consulta"] : e === "propor" ? ["proposta"] : [])) as ("consulta" | "proposta")[];
const J = { "content-type": "application/json" };
const ok = (id: unknown, result: unknown): RespostaMcp => ({ status: 200, cabecalhos: J, corpo: JSON.stringify({ jsonrpc: "2.0", id, result }) });
const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function tratarMcpComLocal(req: RequisicaoMcp, p: PortasGateway, l: PortasLocais): Promise<RespostaMcp> {
  let msg: { id?: unknown; method?: string; params?: { name?: unknown; arguments?: Record<string, unknown> } } | null = null;
  try { msg = JSON.parse(req.corpo); } catch { /* o gateway responde o erro de JSON */ }
  const delega = !msg || msg.id === undefined || (msg.method !== "tools/list" && msg.method !== "tools/call");
  const nome = typeof msg?.params?.name === "string" ? msg.params.name : "";
  const idLocal = nome.replaceAll("__", ".");
  if (delega || (msg!.method === "tools/call" && !buscarCapacidade(idLocal))) return tratarMcp(req, p);

  // Autenticação: mesmas regras do gateway (sem Origin de navegador, Bearer no formato, chave válida, limite).
  if (req.metodo !== "POST" || req.cabecalhos["origin"]) return tratarMcp(req, p);
  const auth = req.cabecalhos["authorization"] ?? ""; const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!pareceTokenMcp(token)) return tratarMcp(req, p);
  const chave = await p.validarChave(await sha256Hex(token));
  if (!chave) return tratarMcp(req, p);
  if (!(await p.limite(chave.chave_id))) return tratarMcp(req, p);
  const escopos = escoposLocais(chave);

  if (msg!.method === "tools/list") {
    const base = JSON.parse((await tratarMcp(req, p)).corpo);
    const locais = (await l.dispositivo(chave)) ? ferramentasLocaisMcp(escopos, l.executoresAtivos) : [];   // sem dispositivo pareado, nada local é anunciado
    return ok(msg!.id, { tools: [...(base.result?.tools ?? []), ...locais] });
  }
  // tools/call de capacidade local
  const falha = (texto: string, extra: object = {}) => ok(msg!.id, { content: [{ type: "text", text: JSON.stringify({ erro: texto, ...extra }) }], isError: true });
  const cap = buscarCapacidade(idLocal)!;
  if (l.executoresAtivos && !l.executoresAtivos.includes(cap.executor)) return falha("executor_nao_ligado");
  const disp = await l.dispositivo(chave);
  if (!disp) return falha("sem_dispositivo_pareado");
  const sessao: SessaoLocal = { sessao_id: chave.chave_id, loja_id: chave.loja_id, dispositivo_id: disp.dispositivo_id, agente: chave.nome, escopos, hosts_permitidos: disp.hosts_permitidos };
  const tarefa_id = l.novoId();
  if (l.executarInline) {
    const v = await l.executarInline(sessao, { tarefa_id, capacidade: idLocal, params: msg!.params?.arguments ?? {} }, chave);
    return ok(msg!.id, { content: [{ type: "text", text: JSON.stringify({ tarefa_id, ...v, origem: "executor_local", dispositivo_id: disp.dispositivo_id }) }], isError: v.estado !== "CONCLUIDA" });
  }
  if (!l.fila) return falha("fila_nao_configurada");
  const e = l.fila.enfileirar(sessao, { tarefa_id, capacidade: idLocal, params: msg!.params?.arguments ?? {} });
  if (!e.ok) return falha(e.motivo);
  const fim = Date.now() + l.esperaMs;
  while (Date.now() < fim) {
    const it = l.fila.estado(tarefa_id);
    if (it && it.estado !== "NA_FILA" && it.estado !== "EM_EXECUCAO") {
      const v = it.veredito!;
      return ok(msg!.id, { content: [{ type: "text", text: JSON.stringify({ tarefa_id, ...v, origem: "executor_local", dispositivo_id: disp.dispositivo_id }) }], isError: v.estado !== "CONCLUIDA" });
    }
    await dormir(10);
  }
  return falha("executor_nao_respondeu: tarefa continua na fila; estado não confirmado", { tarefa_id, estado: l.fila.estado(tarefa_id)?.estado });
}
