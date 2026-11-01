import { test } from "node:test";
import assert from "node:assert/strict";
import { copiarTexto } from "./copiar.ts";

test("copiarTexto usa a área de transferência moderna quando existe", async () => {
  let gravado = "";
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { clipboard: { writeText: async (t: string) => { gravado = t; } } } });
  assert.equal(await copiarTexto("ola"), true);
  assert.equal(gravado, "ola");
});

test("copiarTexto devolve false (sem lançar erro) quando o navegador recusa e não há documento", async () => {
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { clipboard: { writeText: async () => { throw new Error("negado"); } } } });
  assert.equal(await copiarTexto("ola"), false);
});
