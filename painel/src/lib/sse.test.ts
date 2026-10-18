import { test } from "node:test";
import assert from "node:assert/strict";
import { criarParserSSE, jsonDe, lerSSE } from "./sse.ts";

test("SSE: evento simples, nome padrão message, comentário ignorado", () => {
  const p = criarParserSSE();
  assert.deepEqual(p.alimentar(": keep-alive\n\ndata: oi\n\n"), [{ evento: "message", dados: "oi" }]);
});

test("SSE: evento partido em vários pedaços e CRLF", () => {
  const p = criarParserSSE();
  assert.deepEqual(p.alimentar("event: te"), []);
  assert.deepEqual(p.alimentar("xto\r\ndata: {\"delta\":\"a"), []);
  assert.deepEqual(p.alimentar("b\"}\r\n\r\n"), [{ evento: "texto", dados: "{\"delta\":\"ab\"}" }]);
});

test("SSE: \\r\\n partido entre pedaços não vira linha em branco falsa", () => {
  const p = criarParserSSE();
  assert.deepEqual(p.alimentar("data: a\r"), []);
  assert.deepEqual(p.alimentar("\ndata: b\r\n\r\n"), [{ evento: "message", dados: "a\nb" }]);
});

test("SSE: vários eventos num pedaço e data de várias linhas", () => {
  const p = criarParserSSE();
  const r = p.alimentar("event: a\ndata: 1\ndata: 2\n\nevent: b\ndata: 3\n\n");
  assert.deepEqual(r, [{ evento: "a", dados: "1\n2" }, { evento: "b", dados: "3" }]);
});

test("SSE: finalizar descarrega evento sem linha em branco final", () => {
  const p = criarParserSSE();
  assert.deepEqual(p.alimentar("event: fim\ndata: {}"), []);
  assert.deepEqual(p.finalizar(), [{ evento: "fim", dados: "{}" }]);
});

test("SSE: jsonDe devolve null para JSON inválido", () => {
  assert.equal(jsonDe({ evento: "x", dados: "{quebrado" }), null);
  assert.deepEqual(jsonDe({ evento: "x", dados: "{\"a\":1}" }), { a: 1 });
});

test("SSE: lerSSE consome um stream real em pedaços", async () => {
  const enc = new TextEncoder();
  const corpo = new ReadableStream<Uint8Array>({ start(c) { c.enqueue(enc.encode("event: estado\ndata: {\"estado\":\"interpretando\"}\n")); c.enqueue(enc.encode("\nevent: fim\ndata: {}\n\n")); c.close(); } });
  const vistos: string[] = [];
  await lerSSE(new Response(corpo), (e) => vistos.push(e.evento));
  assert.deepEqual(vistos, ["estado", "fim"]);
});

test("SSE: abortar o sinal para a leitura", async () => {
  const enc = new TextEncoder();
  let cancelado = false;
  const corpo = new ReadableStream<Uint8Array>({ pull(c) { c.enqueue(enc.encode("event: texto\ndata: {}\n\n")); return new Promise((r) => setTimeout(r, 5)); }, cancel() { cancelado = true; } });
  const ac = new AbortController();
  let n = 0;
  await lerSSE(new Response(corpo), () => { if (++n === 2) ac.abort(); }, ac.signal);
  assert.ok(cancelado);
});
