// Leitor de Server-Sent Events (text/event-stream) puro: sem DOM, testável no Node. Aceita CRLF/LF, comentários (": ..."),
// campos data de várias linhas e eventos partidos em vários pedaços (chunks).
export interface EventoSSE { evento: string; dados: string }

export function criarParserSSE() {
  let resto = "";
  let evento = "";
  let dados: string[] = [];
  const emitir = (saida: EventoSSE[]) => {
    if (dados.length) saida.push({ evento: evento || "message", dados: dados.join("\n") });
    evento = ""; dados = [];
  };
  return {
    /** Recebe um pedaço de texto e devolve os eventos que ficaram completos. */
    alimentar(pedaco: string): EventoSSE[] {
      const saida: EventoSSE[] = [];
      resto += pedaco;
      let i: number;
      while ((i = resto.search(/\r\n|\n|\r/)) >= 0) {
        // "\r" no fim do pedaço pode ser o começo de "\r\n": espera o próximo pedaço
        if (resto[i] === "\r" && i === resto.length - 1) break;
        const linha = resto.slice(0, i);
        resto = resto.slice(i + (resto.startsWith("\r\n", i) ? 2 : 1));
        if (linha === "") { emitir(saida); continue; }
        if (linha.startsWith(":")) continue;
        const c = linha.indexOf(":");
        const campo = c < 0 ? linha : linha.slice(0, c);
        let valor = c < 0 ? "" : linha.slice(c + 1);
        if (valor.startsWith(" ")) valor = valor.slice(1);
        if (campo === "event") evento = valor;
        else if (campo === "data") dados.push(valor);
      }
      return saida;
    },
    /** Fim do fluxo: descarrega um evento que não terminou com linha em branco. */
    finalizar(): EventoSSE[] {
      const saida: EventoSSE[] = [];
      if (resto) { this.alimentar("\n"); }
      emitir(saida);
      return saida;
    },
  };
}

/** Lê o corpo de uma Response SSE até acabar ou até o sinal abortar. Eventos com JSON inválido viram evento "erro_protocolo". */
export async function lerSSE(resposta: Response, aoEvento: (e: EventoSSE) => void, sinal?: AbortSignal): Promise<void> {
  if (!resposta.body) throw new Error("A resposta não trouxe um fluxo de eventos.");
  const leitor = resposta.body.getReader();
  const dec = new TextDecoder();
  const p = criarParserSSE();
  const aoAbortar = () => { void leitor.cancel().catch(() => {}); };
  sinal?.addEventListener("abort", aoAbortar, { once: true });
  try {
    for (;;) {
      const { done, value } = await leitor.read();
      if (done) break;
      for (const e of p.alimentar(dec.decode(value, { stream: true }))) aoEvento(e);
    }
    for (const e of p.finalizar()) aoEvento(e);
  } finally {
    sinal?.removeEventListener("abort", aoAbortar);
  }
}

/** JSON seguro de um evento: devolve null se inválido (o chamador mostra erro honesto, nunca inventa conteúdo). */
export function jsonDe<T = unknown>(e: EventoSSE): T | null {
  try { return JSON.parse(e.dados) as T; } catch { return null; }
}
