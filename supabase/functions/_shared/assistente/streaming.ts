// B2b (#166): embrulha um turno do chat persistente (`atenderChat`) em Server-Sent Events, sem mudar o turno em si.
// Eventos: `texto` { delta } enquanto o provedor escreve; `resultado` { status, corpo } uma única vez no fim, com EXATAMENTE
// o mesmo corpo que a resposta JSON comum devolveria (resposta final, conversa_id, propostas, evidências, avisos de incompleto).
// O texto parcial é só prévia: quem vale é o `resultado`, que já foi registrado no banco (chat_responder) antes de ser enviado.
// Se o cliente fechar a conexão, o turno NÃO é cancelado: termina e fica registrado, e a mesma pergunta (mesma
// idempotency_key) recupera a resposta já paga, como no caminho comum. Só paramos de escrever no fluxo.
export type Turno = (aoTexto: (delta: string) => void) => Promise<{ corpo: unknown; status: number }>;

const quadro = (evento: string, dados: unknown) => `event: ${evento}\ndata: ${JSON.stringify(dados)}\n\n`;

export function turnoComStreaming(turno: Turno, cors: Record<string, string>): Response {
  const enc = new TextEncoder();
  let aberto = true;
  const corpo = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enviar = (evento: string, dados: unknown) => { if (!aberto) return; try { controller.enqueue(enc.encode(quadro(evento, dados))); } catch { aberto = false; } };
      try {
        const r = await turno((delta) => { if (delta) enviar("texto", { delta }); });
        enviar("resultado", { status: r.status, corpo: r.corpo });
      } catch {
        enviar("resultado", { status: 503, corpo: { erro: "Chat indisponível; nenhuma resposta foi confirmada." } });
      }
      try { controller.close(); } catch { /* já fechado */ }
    },
    cancel() { aberto = false; },
  });
  return new Response(corpo, { headers: { ...cors, "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" } });
}
