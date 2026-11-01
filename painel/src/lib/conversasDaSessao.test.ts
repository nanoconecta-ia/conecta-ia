import { test } from "node:test";
import assert from "node:assert/strict";
import { lerSessao, registrarNaSessao, removerDaSessao } from "./conversasDaSessao.ts";

const armazem = () => { const m = new Map<string, string>(); return { m, getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }; };

test("sessão: registra sem repetir e separa por loja", () => {
  const a = armazem();
  assert.deepEqual(registrarNaSessao(a, "L1", "c1"), ["c1"]);
  assert.deepEqual(registrarNaSessao(a, "L1", "c1"), ["c1"]);
  assert.deepEqual(registrarNaSessao(a, "L1", "c2"), ["c1", "c2"]);
  assert.deepEqual(lerSessao(a, "L2"), []);
  assert.deepEqual(registrarNaSessao(a, "L2", "x"), ["x"]);
  assert.deepEqual(lerSessao(a, "L1"), ["c1", "c2"]);
});
test("sessão: remove só as apagadas e ignora id vazio", () => {
  const a = armazem(); registrarNaSessao(a, "L1", "c1"); registrarNaSessao(a, "L1", "c2"); registrarNaSessao(a, "L1", "c3");
  assert.deepEqual(removerDaSessao(a, "L1", ["c1", "c3"]), ["c2"]);
  assert.deepEqual(registrarNaSessao(a, "L1", ""), ["c2"]);
});
test("sessão: dado corrompido, tipo errado, sem armazenamento ou armazenamento que falha não quebram", () => {
  const ruim = { getItem: () => "{quebrado", setItem: () => { throw new Error("cheio"); } };
  assert.deepEqual(lerSessao(ruim, "L1"), []);
  assert.doesNotThrow(() => registrarNaSessao(ruim, "L1", "c1"));
  assert.deepEqual(lerSessao({ getItem: () => JSON.stringify({ a: 1 }) }, "L1"), []);
  assert.deepEqual(lerSessao({ getItem: () => JSON.stringify(["a", 3, "", "a", "b"]) }, "L1"), ["a", "b"]);
  assert.deepEqual(lerSessao(null, "L1"), []); assert.doesNotThrow(() => registrarNaSessao(null, "L1", "c"));
});
