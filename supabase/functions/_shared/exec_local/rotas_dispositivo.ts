// Rotas do AGENTE (só ele chama): POST /dispositivo/proximo e POST /dispositivo/resultado, autenticadas pela SESSÃO do Conecta Pair
// (token <token>.<sal>, conferido no banco a cada chamada: revogação, replay e loja já tratados lá). Puro: o rpc é injetado.
import { HASH_RE, separarToken, sha256Hex } from "../pair/cripto.ts";

export interface RequisicaoDispositivo { metodo: string; caminho: string; authorization: string | null; corpo: string; ip?: string }
export interface RespostaDispositivo { status: number; corpo?: unknown }
export interface PortasDispositivo {
  rpc(fn: "exec_local_puxar" | "exec_local_resultado", args: Record<string, unknown>): Promise<unknown>;
  /** Limite por chave (false = estourou). Opcional só para testes locais. */
  limite?(chave: string, max: number, janelaS: number): Promise<boolean>;
}
// polling do agente (~1 req/s) cabe folgado; tentativas com credencial inválida são contadas por IP
export const LIMITE_SESSAO_DISPOSITIVO = { max: 150, janelaS: 60 };
export const LIMITE_FALHAS_DISPOSITIVO_IP = { max: 20, janelaS: 60 };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export async function tratarDispositivo(req: RequisicaoDispositivo, p: PortasDispositivo): Promise<RespostaDispositivo> {
  if (req.metodo !== "POST") return { status: 405 };
  if (req.corpo.length > 420_000) return { status: 413 };   // 64 KB de saída podem virar até 6x em JSON escapado; o banco corta em 65536 BYTES
  const m = /^Bearer ([A-Za-z0-9_.-]+)$/.exec(req.authorization ?? "");
  const tk = m ? separarToken(m[1]) : null;
  const ip = req.ip ?? "?";
  const falhou = async (): Promise<RespostaDispositivo> => (p.limite && !(await p.limite(`dev401:${ip}`, LIMITE_FALHAS_DISPOSITIVO_IP.max, LIMITE_FALHAS_DISPOSITIVO_IP.janelaS))) ? { status: 429 } : { status: 401 };
  if (!tk) return falhou();
  const hash = await sha256Hex(tk.token), sal = await sha256Hex(tk.sal);
  if (!HASH_RE.test(hash) || !HASH_RE.test(sal)) return falhou();
  if (p.limite && !(await p.limite(`dev:${hash.slice(0, 16)}`, LIMITE_SESSAO_DISPOSITIVO.max, LIMITE_SESSAO_DISPOSITIVO.janelaS))) return { status: 429 };
  let corpo: Record<string, unknown> = {};
  try { corpo = req.corpo ? JSON.parse(req.corpo) : {}; } catch { return { status: 400 }; }
  if (req.caminho === "/dispositivo/proximo") {
    const r = await p.rpc("exec_local_puxar", { p_token_hash: hash, p_sal_hash: sal });
    if (r === null || r === undefined) return falhou();                              // sessão inválida/revogada/não é agente_desktop
    if (typeof r === "object" && Object.keys(r as object).length === 0) return { status: 204 };
    return { status: 200, corpo: r };
  }
  if (req.caminho === "/dispositivo/resultado") {
    if (typeof corpo.job_id !== "string" || !UUID.test(corpo.job_id) || typeof corpo.ok !== "boolean") return { status: 400 };
    const r = await p.rpc("exec_local_resultado", { p_token_hash: hash, p_sal_hash: sal, p_tarefa: corpo.job_id, p_ok: corpo.ok,
      p_saida: typeof corpo.saida === "string" ? corpo.saida : null, p_erro: typeof corpo.erro === "string" ? corpo.erro : null });
    if (r === null || r === undefined) return falhou();
    return { status: 200, corpo: { estado: r } };
  }
  return { status: 404 };
}
