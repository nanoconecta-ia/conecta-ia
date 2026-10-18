// Cliente da Messages API do Claude com laço de ferramentas (tool use). Portas injetáveis: testável sem rede.
// Nunca registra a chave nem o corpo de erro do provedor. Conteúdo de ferramentas é DADO, nunca instrução.
export interface Ferramenta { name: string; description: string; input_schema: Record<string, unknown> }
export type Bloco =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: unknown }
  | { type: "tool_result"; tool_use_id: string; content: string; is_error?: boolean };
export interface Mensagem { role: "user" | "assistant"; content: string | Bloco[] }

export class IaErro extends Error {
  status: number;
  constructor(status: number, msg: string) { super(msg); this.status = status; }
}

export interface Opcoes {
  chave: string; modelo: string; sistema: string; mensagens: Mensagem[]; ferramentas: Ferramenta[];
  executar(nome: string, entrada: unknown): Promise<unknown>;
  fetch?: typeof fetch; maxPassos?: number; maxTokens?: number; limiteResultado?: number;
}
export interface Resposta { texto: string; tokens: number; passos: number; ferramentasUsadas: string[] }

const URL_API = "https://api.anthropic.com/v1/messages";
export const VERSAO_API = "2023-06-01";

export async function conversar(o: Opcoes): Promise<Resposta> {
  const f = o.fetch ?? fetch;
  const msgs: Mensagem[] = [...o.mensagens];
  const maxPassos = o.maxPassos ?? 6;
  const limite = o.limiteResultado ?? 6000;
  let tokens = 0;
  const usadas: string[] = [];

  for (let passo = 1; passo <= maxPassos; passo++) {
    let r: Response;
    try {
      r = await f(URL_API, {
        method: "POST",
        headers: { "x-api-key": o.chave, "anthropic-version": VERSAO_API, "content-type": "application/json" },
        body: JSON.stringify({ model: o.modelo, max_tokens: o.maxTokens ?? 1024, system: o.sistema, messages: msgs, tools: o.ferramentas.length ? o.ferramentas : undefined }),
        signal: AbortSignal.timeout(60_000),
      });
    } catch {
      throw new IaErro(504, "O provedor de IA não respondeu a tempo.");
    }
    if (!r.ok) {
      if (r.status === 401 || r.status === 403) throw new IaErro(401, "A chave de IA foi recusada pelo provedor. Confira a chave nas Integrações.");
      if (r.status === 429 || r.status === 529) throw new IaErro(429, "O provedor de IA está sobrecarregado ou o limite da chave foi atingido. Tente em instantes.");
      throw new IaErro(502, "O provedor de IA devolveu um erro.");
    }
    const j = await r.json().catch(() => null) as { content?: Bloco[]; stop_reason?: string; usage?: { input_tokens?: number; output_tokens?: number } } | null;
    if (!j || !Array.isArray(j.content)) throw new IaErro(502, "Resposta inesperada do provedor de IA.");
    tokens += (j.usage?.input_tokens ?? 0) + (j.usage?.output_tokens ?? 0);

    const usos = j.content.filter((b): b is Extract<Bloco, { type: "tool_use" }> => b.type === "tool_use");
    if (j.stop_reason !== "tool_use" || usos.length === 0) {
      const texto = j.content.filter((b): b is Extract<Bloco, { type: "text" }> => b.type === "text").map((b) => b.text).join("\n").trim();
      return { texto, tokens, passos: passo, ferramentasUsadas: usadas };
    }

    msgs.push({ role: "assistant", content: j.content });
    const resultados: Bloco[] = [];
    for (const u of usos) {
      usadas.push(u.name);
      try {
        const saida = JSON.stringify(await o.executar(u.name, u.input));
        resultados.push({ type: "tool_result", tool_use_id: u.id, content: saida.length > limite ? saida.slice(0, limite) + '…[cortado]' : saida });
      } catch (e) {
        resultados.push({ type: "tool_result", tool_use_id: u.id, is_error: true, content: e instanceof Error ? e.message.slice(0, 300) : "falha na ferramenta" });
      }
    }
    msgs.push({ role: "user", content: resultados });
  }
  return { texto: "Não consegui concluir em poucos passos. Pode reformular o pedido de forma mais específica?", tokens, passos: maxPassos, ferramentasUsadas: usadas };
}
