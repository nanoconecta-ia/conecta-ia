// Cliente das Edge Functions do Nano.ia (contrato em docs/conector-ia/api-contratos.md). Sem DOM nem supabase-js: testável no Node.
import { SUPABASE_CHAVE_PUBLICAVEL, SUPABASE_URL } from "../config.ts";
import { jsonDe, lerSSE, type EventoSSE } from "./sse.ts";

export type Provedor = "claude" | "gemini" | "compativel_openai";
export type DecisaoFerramenta = "permitida" | "negada" | "requer_aprovacao" | "simulada";
export type Risco = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface ParametrosChat { loja_id: string; conversa_id?: string | null; texto: string; anexos?: string[]; provedor?: Provedor; modelo?: string; contexto_operacional?: boolean; fallback?: boolean }
export interface ManipuladoresChat {
  conversa?(d: { id: string; titulo: string }): void;
  estado?(estado: unknown): void;
  texto?(delta: string): void;
  ferramentaInicio?(d: { id: string; nome: string; risco: Risco }): void;
  ferramentaFim?(d: { id: string; nome: string; decisao: DecisaoFerramenta; ok: boolean; resumo: string }): void;
  proposta?(d: { id: string; versao: number; hash: string; titulo: string; risco: Risco; itens?: number }): void;
  uso?(d: { provedor: string; modelo: string; tokens: number; custo_estimado: number | null }): void;
  aviso?(d: { mensagem: string; provedor?: string }): void;
  erro?(mensagem: string): void;
  fim?(): void;
}

/** Mensagem honesta por status HTTP. 404 = a função ainda não foi implantada neste ambiente. */
export function mensagemDeStatus(status: number, erroServidor?: string): string {
  if (erroServidor && status !== 401) return erroServidor;   // o servidor já devolve a mensagem em português
  if (status === 404) return "O Nano.ia ainda não está disponível neste ambiente (a função não foi implantada). Nada foi enviado nem gravado.";
  if (status === 401) return "Sua sessão expirou. Entre de novo.";
  if (status === 403) return erroServidor || "Você não tem permissão para esta ação nesta loja.";
  if (status === 409) return erroServidor || "A proposta mudou. Revise e decida sobre a versão atual.";
  if (status === 429) return erroServidor || "Limite de uso atingido. Tente mais tarde ou ajuste o limite em Integrações de IA.";
  if (status === 503) return erroServidor || "Nenhum provedor de IA ativo. Cadastre uma chave em Integrações de IA.";
  return erroServidor || "Não foi possível concluir. Tente de novo.";
}
export const MENSAGEM_REDE = "Sem conexão com o servidor do Nano.ia. Verifique a internet; nada foi enviado.";

const urlFuncao = (nome: string) => `${SUPABASE_URL}/functions/v1/${nome}`;
const cabecalhos = (token: string) => ({ "Content-Type": "application/json", apikey: SUPABASE_CHAVE_PUBLICAVEL, Authorization: `Bearer ${token}` });

async function corpoErro(r: Response): Promise<string | undefined> {
  try { const j = await r.json() as { erro?: unknown }; return typeof j.erro === "string" ? j.erro : undefined; } catch { return undefined; }
}

const EVENTOS = new Set(["conversa", "estado", "texto", "ferramenta_inicio", "ferramenta_fim", "proposta", "uso", "aviso", "erro", "fim"]);
export function despachar(e: EventoSSE, m: ManipuladoresChat): void {
  if (!EVENTOS.has(e.evento)) return;   // evento desconhecido (versão futura do servidor): ignora sem quebrar
  const d = jsonDe<Record<string, unknown>>(e);
  if (d === null && e.evento !== "fim") { m.erro?.("O servidor enviou um evento ilegível; a resposta pode estar incompleta."); return; }
  const x = (d ?? {}) as never;
  switch (e.evento) {
    case "conversa": m.conversa?.(x); break;
    case "estado": m.estado?.((d as { estado?: unknown }).estado); break;
    case "texto": { const t = (d as { delta?: unknown }).delta; if (typeof t === "string") m.texto?.(t); break; }
    case "ferramenta_inicio": m.ferramentaInicio?.(x); break;
    case "ferramenta_fim": m.ferramentaFim?.(x); break;
    case "proposta": m.proposta?.(x); break;
    case "uso": m.uso?.(x); break;
    case "aviso": { const t = (d as { mensagem?: unknown }).mensagem; if (typeof t === "string") m.aviso?.(x); break; }
    case "erro": { const t = (d as { mensagem?: unknown }).mensagem; m.erro?.(typeof t === "string" ? t : "O servidor reportou um erro."); break; }
    case "fim": m.fim?.(); break;
    default: break; // evento desconhecido: ignora (compatível com versões futuras do servidor)
  }
}

/** Envia a mensagem e consome o streaming. Cancelar = abortar o `sinal`. Lança Error com mensagem pronta para a tela. */
export async function enviarMensagem(p: ParametrosChat, token: string, m: ManipuladoresChat, sinal?: AbortSignal, f: typeof fetch = fetch): Promise<void> {
  let r: Response;
  try {
    r = await f(urlFuncao("conector-chat"), { method: "POST", headers: { ...cabecalhos(token), Accept: "text/event-stream" }, body: JSON.stringify(p), signal: sinal });
  } catch (e) {
    if ((e as { name?: string }).name === "AbortError") return;
    throw new Error(MENSAGEM_REDE);
  }
  if (!r.ok) throw new Error(mensagemDeStatus(r.status, await corpoErro(r)));
  try {
    await lerSSE(r, (e) => despachar(e, m), sinal);
  } catch (e) {
    if ((e as { name?: string }).name === "AbortError" || sinal?.aborted) return;
    throw new Error("A conexão com o Nano.ia caiu no meio da resposta. O que já chegou foi mantido.");
  }
}

export interface RespostaFuncao<T = Record<string, unknown>> { ok: boolean; status: number; dados?: T; erro?: string }

/** Chamada JSON às funções conector-conversas / conector-aprovacoes / conector-chaves. */
export async function chamarFuncao<T = Record<string, unknown>>(nome: string, corpo: Record<string, unknown>, token: string, f: typeof fetch = fetch): Promise<RespostaFuncao<T>> {
  let r: Response;
  try { r = await f(urlFuncao(nome), { method: "POST", headers: cabecalhos(token), body: JSON.stringify(corpo) }); }
  catch { return { ok: false, status: 0, erro: MENSAGEM_REDE }; }
  if (!r.ok) return { ok: false, status: r.status, erro: mensagemDeStatus(r.status, await corpoErro(r)) };
  const dados = await r.json().catch(() => null) as T | null;
  return dados ? { ok: true, status: r.status, dados } : { ok: false, status: r.status, erro: "Resposta inesperada do servidor." };
}
