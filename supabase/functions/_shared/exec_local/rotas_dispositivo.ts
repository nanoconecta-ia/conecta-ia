// Rotas do AGENTE (só ele chama): POST /dispositivo/proximo e POST /dispositivo/resultado, autenticadas pela SESSÃO do Conecta Pair
// (token <token>.<sal>, conferido no banco a cada chamada: revogação, replay e loja já tratados lá). Puro: o rpc é injetado.
import { HASH_RE, separarToken, sha256Hex } from "../pair/cripto.ts";

export interface RequisicaoDispositivo { metodo: string; caminho: string; authorization: string | null; corpo: string }
export interface RespostaDispositivo { status: number; corpo?: unknown }
export interface PortasDispositivo { rpc(fn: "exec_local_puxar" | "exec_local_resultado", args: Record<string, unknown>): Promise<unknown> }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export async function tratarDispositivo(req: RequisicaoDispositivo, p: PortasDispositivo): Promise<RespostaDispositivo> {
  if (req.metodo !== "POST") return { status: 405 };
  if (req.corpo.length > 140_000) return { status: 413 };
  const m = /^Bearer ([A-Za-z0-9_.-]+)$/.exec(req.authorization ?? "");
  const tk = m ? separarToken(m[1]) : null;
  if (!tk) return { status: 401 };
  const hash = await sha256Hex(tk.token), sal = await sha256Hex(tk.sal);
  if (!HASH_RE.test(hash) || !HASH_RE.test(sal)) return { status: 401 };
  let corpo: Record<string, unknown> = {};
  try { corpo = req.corpo ? JSON.parse(req.corpo) : {}; } catch { return { status: 400 }; }
  if (req.caminho === "/dispositivo/proximo") {
    const r = await p.rpc("exec_local_puxar", { p_token_hash: hash, p_sal_hash: sal });
    if (r === null || r === undefined) return { status: 401 };                       // sessão inválida/revogada/não é agente_desktop
    if (typeof r === "object" && Object.keys(r as object).length === 0) return { status: 204 };
    return { status: 200, corpo: r };
  }
  if (req.caminho === "/dispositivo/resultado") {
    if (typeof corpo.job_id !== "string" || !UUID.test(corpo.job_id) || typeof corpo.ok !== "boolean") return { status: 400 };
    const r = await p.rpc("exec_local_resultado", { p_token_hash: hash, p_sal_hash: sal, p_tarefa: corpo.job_id, p_ok: corpo.ok,
      p_saida: typeof corpo.saida === "string" ? corpo.saida : null, p_erro: typeof corpo.erro === "string" ? corpo.erro : null });
    if (r === null || r === undefined) return { status: 401 };
    return { status: 200, corpo: { estado: r } };
  }
  return { status: 404 };
}
