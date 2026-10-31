// B2b (#166): o turno com streaming entrega os deltas e UM resultado final idêntico ao corpo do caminho JSON.
import { test } from "node:test";
import assert from "node:assert/strict";
import { turnoComStreaming } from "./streaming.ts";

const CORS = { "Access-Control-Allow-Origin": "*" };
const ler = async (r: Response) => (await r.text()).split("\n\n").filter(Boolean).map((q) => {
  const ev = /^event: (.+)$/m.exec(q)?.[1]; const d = /^data: (.+)$/m.exec(q)?.[1];
  return { ev, d: d ? JSON.parse(d) : null };
});

test("SSE: cabeçalhos de streaming, deltas na ordem e um único `resultado` com status e corpo do turno", async () => {
  const r = turnoComStreaming(async (aoTexto) => { aoTexto("Faltam "); aoTexto(""); aoTexto("GTIN."); return { status: 200, corpo: { resposta: "Faltam GTIN.", conversa_id: "c1", propostas: [] } }; }, CORS);
  assert.match(r.headers.get("content-type")!, /text\/event-stream/);
  assert.equal(r.headers.get("access-control-allow-origin"), "*");
  const ev = await ler(r);
  assert.deepEqual(ev.map((e) => e.ev), ["texto", "texto", "resultado"], "delta vazio não é enviado");
  assert.deepEqual(ev.at(-1)!.d, { status: 200, corpo: { resposta: "Faltam GTIN.", conversa_id: "c1", propostas: [] } });
});

test("SSE: status de erro do turno (ex.: 409) segue no resultado; exceção vira 503 sem vazar detalhe", async () => {
  const a = await ler(turnoComStreaming(async () => ({ status: 409, corpo: { erro: "Turno em execução." } }), CORS));
  assert.deepEqual(a.at(-1)!.d, { status: 409, corpo: { erro: "Turno em execução." } });
  const b = await ler(turnoComStreaming(async () => { throw new Error("segredo interno sk-123"); }, CORS));
  assert.equal(b.at(-1)!.d.status, 503);
  assert.doesNotMatch(JSON.stringify(b), /segredo|sk-123/);
});

test("SSE: cliente que sai no meio não cancela o turno (ele termina e fica registrado)", async () => {
  let terminou = false;
  let liberar!: () => void; const espera = new Promise<void>((r) => { liberar = r; });
  const r = turnoComStreaming(async (aoTexto) => { aoTexto("a"); await espera; aoTexto("b"); terminou = true; return { status: 200, corpo: {} }; }, CORS);
  const leitor = r.body!.getReader();
  await leitor.read();
  await leitor.cancel();
  liberar();
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(terminou, true);
});
