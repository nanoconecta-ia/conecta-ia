// Fase 2 (issue #166): liga a extensão à loja pelo Conecta Pair, que JÁ está implantado (edge `pair` + `conecta-gateway`).
// Puro, com fetch e cripto injetáveis: testável no Node. Contrato: docs/conecta-pair/API.md.
// - O token nasce AQUI (1ª metade); o servidor só recebe o SHA-256 e devolve o sal uma vez. Token completo = <token>.<sal>.
// - O lojista aprova no painel do Conecta.IA (QR/link + código de verificação). Escopos mínimos: ler produtos e PROPOR.
//   Não existe escopo de aprovar, executar ou escrever no ERP.
import { SUPABASE_CHAVE_PUBLICAVEL, SUPABASE_URL } from "../../painel/src/config.ts";

export const ESCOPOS_GUARDIAO = ["produtos:ler", "enriquecimento:propor"] as const;
export const URL_PAIR = `${SUPABASE_URL}/functions/v1/pair`;
export const URL_GATEWAY = `${SUPABASE_URL}/functions/v1/conecta-gateway`;

const b64u = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
export const gerarMetadeToken = (c: Crypto = crypto) => b64u(c.getRandomValues(new Uint8Array(32)));
export async function sha256Hex(s: string, c: Crypto = crypto): Promise<string> {
  const h = new Uint8Array(await c.subtle.digest("SHA-256", new TextEncoder().encode(s)));
  return Array.from(h, (x) => x.toString(16).padStart(2, "0")).join("");
}

export interface Desafio { codigo: string; url: string; verificacao: string; segredo: string; sal: string; expira_em: string; metade: string }
export type EstadoConsulta = { estado: "pendente" } | { estado: "resgatado"; loja_id: string; escopos: string[]; sessao_expira_em: string } | { estado: "recusado" | "expirado" | "invalido" };

const cab = (extra: Record<string, string> = {}) => ({ "Content-Type": "application/json", apikey: SUPABASE_CHAVE_PUBLICAVEL, ...extra });
async function erroDe(r: Response): Promise<string> {
  try { const j = await r.json() as { erro?: unknown }; if (typeof j.erro === "string") return j.erro; } catch { /* sem corpo */ }
  return r.status === 503 ? "Pareamento ainda não configurado no servidor." : r.status === 429 ? "Muitas tentativas. Aguarde um pouco." : "Não foi possível falar com o Conecta.IA agora.";
}

/** Pede o pareamento. A 1ª metade do token fica só aqui (devolvida em `metade`), nunca vai ao servidor. */
export async function iniciarPareamento(nome: string, f: typeof fetch = fetch, c: Crypto = crypto): Promise<Desafio> {
  const metade = gerarMetadeToken(c);
  let r: Response;
  try { r = await f(URL_PAIR, { method: "POST", headers: cab(), body: JSON.stringify({ acao: "iniciar", nome: nome.slice(0, 80), tipo: "navegador", escopos: [...ESCOPOS_GUARDIAO], duracao_min: 480, renovavel: true, token_hash: await sha256Hex(metade, c) }) }); }
  catch { throw new Error("Sem conexão com o Conecta.IA. Verifique a internet."); }
  if (!r.ok) throw new Error(await erroDe(r));
  const d = await r.json() as Omit<Desafio, "metade">;
  if (!d?.codigo || !d?.segredo || !d?.sal || !d?.url) throw new Error("Resposta de pareamento incompleta.");
  return { codigo: d.codigo, url: d.url, verificacao: d.verificacao, segredo: d.segredo, sal: d.sal, expira_em: d.expira_em, metade };
}

export async function consultarPareamento(d: Pick<Desafio, "codigo" | "segredo">, f: typeof fetch = fetch): Promise<EstadoConsulta> {
  const r = await f(URL_PAIR, { method: "POST", headers: cab(), body: JSON.stringify({ acao: "consultar", codigo: d.codigo, segredo: d.segredo }) });
  if (!r.ok) throw new Error(await erroDe(r));
  return await r.json() as EstadoConsulta;
}

export const tokenCompleto = (metade: string, sal: string) => `${metade}.${sal}`;

export async function encerrarPareamento(token: string, f: typeof fetch = fetch): Promise<void> {
  try { await f(URL_PAIR, { method: "POST", headers: cab({ Authorization: `Bearer ${token}` }), body: JSON.stringify({ acao: "encerrar" }) }); } catch { /* sem rede: a sessão expira sozinha */ }
}

/** tools/call no gateway com o token da sessão. Devolve o JSON do resultado; erro de ferramenta vira Error com a mensagem curta. */
export class SessaoExpirada extends Error {}
export async function chamarFerramenta<T = Record<string, unknown>>(token: string, nome: string, args: Record<string, unknown>, f: typeof fetch = fetch): Promise<T> {
  let r: Response;
  try { r = await f(URL_GATEWAY, { method: "POST", headers: cab({ Authorization: `Bearer ${token}` }), body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method: "tools/call", params: { name: nome, arguments: args } }) }); }
  catch { throw new Error("Sem conexão com o Conecta.IA."); }
  if (r.status === 401) throw new SessaoExpirada("A conexão com a loja expirou ou foi revogada. Conecte de novo.");
  const j = await r.json().catch(() => null) as { result?: { content?: { type: string; text: string }[]; isError?: boolean }; error?: { message?: string } } | null;
  if (!r.ok || !j) throw new Error(r.status === 503 ? "Registro de auditoria indisponível; nada foi feito." : "Resposta inesperada do Conecta.IA.");
  if (j.error) throw new Error(j.error.message ?? "Ferramenta recusada.");
  const texto = j.result?.content?.find((x) => x.type === "text")?.text ?? "";
  if (j.result?.isError) throw new Error(texto || "Ferramenta recusada.");
  try { return JSON.parse(texto) as T; } catch { return { mensagem: texto } as T; }
}
