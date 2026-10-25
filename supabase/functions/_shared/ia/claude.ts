// Laço de conversa com ferramentas (tool use), independente de provedor (ver adaptadores.ts). Portas injetáveis: testável sem rede.
// Nunca registra a chave nem o corpo de erro do provedor. Conteúdo de ferramentas é DADO, nunca instrução.
import { ADAPTADORES, type Chamada, type Parada, type Passo } from "./adaptadores.ts";
import { IaErro, type Bloco, type Ferramenta, type Mensagem } from "./tipos.ts";
export { IaErro } from "./tipos.ts";
export type { Bloco, Ferramenta, Mensagem } from "./tipos.ts";

export interface Opcoes {
  chave: string; modelo: string; sistema: string; mensagens: Mensagem[]; ferramentas: Ferramenta[];
  executar(nome: string, entrada: unknown): Promise<unknown>;
  fetch?: typeof fetch; maxPassos?: number; maxTokens?: number; limiteResultado?: number;
  onPasso?: (p: { tokens: number; respostaId?: string; modelo?: string }) => void;
  provedor?: "claude" | "gemini" | "compativel_openai"; baseUrl?: string;
  /** Texto de resposta do modelo, assim que existir (delta de streaming ou o bloco do passo, quando o adaptador não faz streaming). */
  aoTexto?(delta: string): void;
  /** Cancelamento (o cliente fechou a conexão). */
  sinal?: AbortSignal;
  /** Adaptador com streaming; se ausente, usa o adaptador comum do provedor. */
  adaptadorStream?: (c: Chamada, msgs: Mensagem[], aoTexto: (delta: string) => void, sinal?: AbortSignal) => Promise<Passo>;
}
/** `ferramentasUsadas` = SOLICITADAS pelo modelo (compatibilidade). `ferramentasConcluidas` = só as que terminaram sem erro. `falhas` = tentativas que falharam (sem dado do usuário).
 *  `completa` é falso se o provedor cortou por tamanho/bloqueou ou se os passos acabaram: uma resposta incompleta nunca pode ser tratada como tarefa concluída. */
export interface Resposta { texto: string; tokens: number; passos: number; ferramentasUsadas: string[]; ferramentasConcluidas: string[]; falhas: { nome: string; motivo: string }[]; completa: boolean; parada?: Parada; respostaId?: string; modelo?: string }

export const VERSAO_API = "2023-06-01";

export async function conversar(o: Opcoes): Promise<Resposta> {
  const msgs: Mensagem[] = [...o.mensagens];
  const maxPassos = o.maxPassos ?? 6;
  const limite = o.limiteResultado ?? 6000;
  const adaptador = ADAPTADORES[o.provedor ?? "claude"];
  let tokens = 0;
  const usadas: string[] = []; const concluidas: string[] = []; const falhas: { nome: string; motivo: string }[] = [];

  for (let passo = 1; passo <= maxPassos; passo++) {
    if (o.sinal?.aborted) throw new IaErro(499, "cancelado");
    const chamada: Chamada = { chave: o.chave, modelo: o.modelo, sistema: o.sistema, ferramentas: o.ferramentas, maxTokens: o.maxTokens ?? 1024, baseUrl: o.baseUrl, fetch: o.fetch };
    const r = o.adaptadorStream && o.aoTexto ? await o.adaptadorStream(chamada, msgs, o.aoTexto, o.sinal) : await adaptador(chamada, msgs);
    if (!(o.adaptadorStream && o.aoTexto)) for (const b of r.blocos) if (b.type === "text" && b.text) o.aoTexto?.(b.text);
    tokens += r.tokens;
    o.onPasso?.({ tokens: r.tokens, respostaId: r.respostaId, modelo: r.modelo });
    const usos = r.blocos.filter((b): b is Extract<Bloco, { type: "tool_use" }> => b.type === "tool_use");
    if (usos.length === 0) {
      const texto = r.blocos.filter((b): b is Extract<Bloco, { type: "text" }> => b.type === "text").map((b) => b.text).join("\n").trim();
      return { texto, tokens, passos: passo, ferramentasUsadas: usadas, ferramentasConcluidas: concluidas, falhas, completa: !r.parada, parada: r.parada, respostaId: r.respostaId, modelo: r.modelo };
    }

    msgs.push({ role: "assistant", content: r.blocos });
    const resultados: Bloco[] = [];
    for (const u of usos) {
      usadas.push(u.name);
      try {
        const saida = JSON.stringify(await o.executar(u.name, u.input)); concluidas.push(u.name);
        resultados.push({ type: "tool_result", tool_use_id: u.id, content: saida.length > limite ? saida.slice(0, limite) + '…[cortado]' : saida });
      } catch (e) {
        const motivo = e instanceof Error ? e.message.slice(0, 300) : "falha na ferramenta"; falhas.push({ nome: u.name, motivo: motivo.slice(0, 120) });
        resultados.push({ type: "tool_result", tool_use_id: u.id, is_error: true, content: `FERRAMENTA NÃO CONCLUÍDA: ${motivo} Nada foi verificado; não afirme ausência, execução ou resultado.` });
      }
    }
    msgs.push({ role: "user", content: resultados });
  }
  return { texto: "Não consegui concluir em poucos passos. Pode reformular o pedido de forma mais específica?", tokens, passos: maxPassos, ferramentasUsadas: usadas, ferramentasConcluidas: concluidas, falhas, completa: false };
}
