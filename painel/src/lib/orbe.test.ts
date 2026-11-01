import { test } from "node:test";
import assert from "node:assert/strict";
import { aplicarOrbe, gravarOrbe, lerOrbe, orbeValido, MODELOS_ORBE } from "./orbe.ts";

const armazem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) }; };

test("orbeValido só aceita os modelos conhecidos; o resto volta ao cristal (padrão)", () => {
  assert.deepEqual(MODELOS_ORBE.map((m) => m.valor), ["cristal", "olho", "sol", "atomo", "aurora"]);
  assert.equal(orbeValido("sol"), "sol"); assert.equal(orbeValido("olho"), "olho"); assert.equal(orbeValido("x"), "cristal"); assert.equal(orbeValido(null), "cristal");
});
test("gravar e ler: o cristal (padrão) não guarda nada", () => {
  const a = armazem();
  gravarOrbe(a, "atomo"); assert.equal(lerOrbe(a), "atomo");
  gravarOrbe(a, "cristal"); assert.equal(a.getItem("conecta:orbe"), null); assert.equal(lerOrbe(a), "cristal");
  assert.equal(lerOrbe(null), "cristal");
});
test("aplicarOrbe escreve data-orbe com o modelo", () => {
  const raiz = { dataset: {} as Record<string, string> } as unknown as HTMLElement;
  aplicarOrbe("aurora", raiz); assert.equal(raiz.dataset.orbe, "aurora");
  aplicarOrbe("cristal", raiz); assert.equal(raiz.dataset.orbe, "cristal");
});
