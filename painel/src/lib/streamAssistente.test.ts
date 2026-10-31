import { test } from "node:test";
import assert from "node:assert/strict";
import { MSG_CAIU, MSG_REDE, perguntarComStreaming, propostasDoTurno } from "./streamAssistente.ts";

const sse = (pedacos: string[], status = 200) => async () => new Response(new ReadableStream({
  start(c) { for (const p of pedacos) c.enqueue(new TextEncoder().encode(p)); c.close(); },
}), { status, headers: { "content-type": "text/event-stream; charset=utf-8" } });

test("streaming: deltas chegam em ordem (mesmo partidos entre pedaços) e o resultado final é o corpo do turno", async () => {
  const deltas: string[] = [];
  const r = await perguntarComStreaming({ loja_id: "l", texto: "oi" }, "tk", (d) => deltas.push(d), sse([
    'event: texto\ndata: {"delta":"Faltam "}\n\n', 'event: texto\nda', 'ta: {"delta":"GTIN e descrição."}\n\n',
    'event: resultado\ndata: {"status":200,"corpo":{"resposta":"Faltam GTIN e descrição.","conversa_id":"c1"}}\n\n',
  ]) as typeof fetch);
  assert.deepEqual(deltas, ["Faltam ", "GTIN e descrição."]);
  assert.equal(r.status, 200);
  assert.equal(r.corpo.resposta, "Faltam GTIN e descrição.");
});

test("envia acao chat_perguntar com stream: true, Accept SSE e o token do usuário", async () => {
  let pedido: { url: string; init: RequestInit } | null = null;
  const f = (async (url: string, init: RequestInit) => { pedido = { url, init }; return sse(['event: resultado\ndata: {"status":200,"corpo":{}}\n\n'])(); }) as unknown as typeof fetch;
  await perguntarComStreaming({ loja_id: "l", texto: "oi", acao: "outra" }, "tk-1", () => {}, f);
  const corpo = JSON.parse(String(pedido!.init.body));
  assert.equal(corpo.acao, "chat_perguntar");
  assert.equal(corpo.stream, true);
  assert.match(pedido!.url, /\/functions\/v1\/assistente$/);
  assert.equal((pedido!.init.headers as Record<string, string>).Authorization, "Bearer tk-1");
});

test("servidor antigo (sem streaming) responde JSON: vira resultado normal, sem deltas", async () => {
  const deltas: string[] = [];
  const f = (async () => new Response(JSON.stringify({ resposta: "ok", conversa_id: "c" }), { status: 200, headers: { "content-type": "application/json" } })) as typeof fetch;
  const r = await perguntarComStreaming({}, "tk", (d) => deltas.push(d), f);
  assert.equal(r.corpo.resposta, "ok");
  assert.deepEqual(deltas, []);
});

test("erro HTTP antes do fluxo (ex.: 409 turno em execução) chega como resultado com status e mensagem do servidor", async () => {
  const f = (async () => new Response(JSON.stringify({ erro: "Turno em execução." }), { status: 409, headers: { "content-type": "application/json" } })) as typeof fetch;
  const r = await perguntarComStreaming({}, "tk", () => {}, f);
  assert.equal(r.status, 409);
  assert.equal(r.corpo.erro, "Turno em execução.");
});

test("fluxo que termina sem `resultado` é conexão caída (texto parcial nunca vira resposta); sem rede, mensagem de rede", async () => {
  await assert.rejects(perguntarComStreaming({}, "tk", () => {}, sse(['event: texto\ndata: {"delta":"meia resp"}\n\n']) as typeof fetch), { message: MSG_CAIU });
  await assert.rejects(perguntarComStreaming({}, "tk", () => {}, (async () => { throw new TypeError("rede"); }) as typeof fetch), { message: MSG_REDE });
});

test("propostasDoTurno: só ids UUID, sem duplicar, no máximo 10, título curto", () => {
  const a = "11111111-2222-4333-8444-555555555555";
  assert.deepEqual(propostasDoTurno([{ id: a, titulo: "Trocar categoria" }, { id: a }, { id: "x" }, null, { titulo: "sem id" }]), [{ id: a, titulo: "Trocar categoria" }]);
  assert.deepEqual(propostasDoTurno(undefined), []);
});
