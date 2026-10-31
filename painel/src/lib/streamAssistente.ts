// B2b (#166): cliente do turno com streaming da edge `assistente` (acao chat_perguntar + stream: true). Puro: testável no Node.
// Compatível com o servidor antigo: se ele ignorar `stream` e responder JSON comum, o JSON vira o resultado normalmente.
import { SUPABASE_CHAVE_PUBLICAVEL, SUPABASE_URL } from "../config.ts";
import { criarParserSSE } from "./sse.ts";

export interface ResultadoTurno { status: number; corpo: Record<string, unknown> }
export const MSG_REDE = "Sem conexão com o servidor do Nano.IA. Verifique a internet; recupere a mesma pergunta antes de tentar outra.";
export const MSG_CAIU = "A conexão caiu antes do fim da resposta. Recupere a mesma pergunta: se o turno terminou no servidor, a resposta registrada volta sem nova cobrança.";

/** Envia o turno e chama `aoTexto` a cada pedaço. Devolve o resultado FINAL (o mesmo corpo do caminho JSON). Lança Error com mensagem pronta. */
export async function perguntarComStreaming(corpo: Record<string, unknown>, token: string, aoTexto: (delta: string) => void, f: typeof fetch = fetch): Promise<ResultadoTurno> {
  let r: Response;
  try {
    r = await f(`${SUPABASE_URL}/functions/v1/assistente`, {
      method: "POST", body: JSON.stringify({ ...corpo, acao: "chat_perguntar", stream: true }),
      headers: { "Content-Type": "application/json", Accept: "text/event-stream", apikey: SUPABASE_CHAVE_PUBLICAVEL, Authorization: `Bearer ${token}` },
    });
  } catch { throw new Error(MSG_REDE); }
  const tipo = r.headers.get("content-type") ?? "";
  if (!tipo.includes("text/event-stream")) {
    // servidor sem streaming (ou erro antes de abrir o fluxo): JSON comum
    const j = await r.json().catch(() => null) as Record<string, unknown> | null;
    return { status: r.status, corpo: j ?? { erro: "Resposta inesperada do servidor." } };
  }
  if (!r.body) throw new Error(MSG_CAIU);
  const parser = criarParserSSE(), leitor = r.body.getReader(), dec = new TextDecoder();
  let resultado: ResultadoTurno | null = null;
  const tratar = (eventos: { evento: string; dados: string }[]) => {
    for (const e of eventos) {
      let d: Record<string, unknown> | null = null;
      try { d = JSON.parse(e.dados); } catch { d = null; }
      if (!d) continue;
      if (e.evento === "texto" && typeof d.delta === "string") aoTexto(d.delta);
      else if (e.evento === "resultado" && typeof d.status === "number" && d.corpo && typeof d.corpo === "object") resultado = { status: d.status, corpo: d.corpo as Record<string, unknown> };
    }
  };
  try {
    for (;;) { const { done, value } = await leitor.read(); if (done) break; tratar(parser.alimentar(dec.decode(value, { stream: true }))); }
    tratar(parser.finalizar());
  } catch { throw new Error(MSG_CAIU); }
  if (!resultado) throw new Error(MSG_CAIU);
  return resultado;
}

/** Propostas devolvidas pelo turno (metadados.propostas): só ids válidos; o cartão lê o resto do banco, nunca do texto do modelo. */
export interface PropostaTurno { id: string; titulo?: string }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function propostasDoTurno(v: unknown): PropostaTurno[] {
  if (!Array.isArray(v)) return [];
  const vistos = new Set<string>();
  return v.flatMap((p) => {
    const id = p && typeof p === "object" ? (p as { id?: unknown }).id : undefined;
    if (typeof id !== "string" || !UUID.test(id) || vistos.has(id)) return [];
    vistos.add(id);
    const t = (p as { titulo?: unknown }).titulo;
    return [{ id, ...(typeof t === "string" ? { titulo: t.slice(0, 200) } : {}) }];
  }).slice(0, 10);
}
