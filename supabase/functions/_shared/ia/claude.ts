// Laço de conversa com ferramentas (tool use), independente de provedor (ver adaptadores.ts). Portas injetáveis: testável sem rede.
// Nunca registra a chave nem o corpo de erro do provedor. Conteúdo de ferramentas é DADO, nunca instrução.
import { ADAPTADORES } from "./adaptadores.ts";
import type { Bloco, Ferramenta, Mensagem } from "./tipos.ts";
export { IaErro } from "./tipos.ts";
export type { Bloco, Ferramenta, Mensagem } from "./tipos.ts";

export interface Opcoes {
  chave: string; modelo: string; sistema: string; mensagens: Mensagem[]; ferramentas: Ferramenta[];
  executar(nome: string, entrada: unknown): Promise<unknown>;
  fetch?: typeof fetch; maxPassos?: number; maxTokens?: number; limiteResultado?: number;
  provedor?: "claude" | "gemini" | "compativel_openai"; baseUrl?: string;
}
export interface Resposta { texto: string; tokens: number; passos: number; ferramentasUsadas: string[] }

export const VERSAO_API = "2023-06-01";

export async function conversar(o: Opcoes): Promise<Resposta> {
  const msgs: Mensagem[] = [...o.mensagens];
  const maxPassos = o.maxPassos ?? 6;
  const limite = o.limiteResultado ?? 6000;
  const adaptador = ADAPTADORES[o.provedor ?? "claude"];
  let tokens = 0;
  const usadas: string[] = [];

  for (let passo = 1; passo <= maxPassos; passo++) {
    const r = await adaptador({ chave: o.chave, modelo: o.modelo, sistema: o.sistema, ferramentas: o.ferramentas, maxTokens: o.maxTokens ?? 1024, baseUrl: o.baseUrl, fetch: o.fetch }, msgs);
    tokens += r.tokens;
    const usos = r.blocos.filter((b): b is Extract<Bloco, { type: "tool_use" }> => b.type === "tool_use");
    if (usos.length === 0) {
      const texto = r.blocos.filter((b): b is Extract<Bloco, { type: "text" }> => b.type === "text").map((b) => b.text).join("\n").trim();
      return { texto, tokens, passos: passo, ferramentasUsadas: usadas };
    }

    msgs.push({ role: "assistant", content: r.blocos });
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
