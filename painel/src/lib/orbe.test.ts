import { test } from "node:test";
import assert from "node:assert/strict";
import { aplicarOrbe, gravarOrbe, lerOrbe, orbeValido, MODELOS_ORBE } from "./orbe.ts";

const armazem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) }; };

test("orbeValido só aceita os modelos conhecidos; o resto volta ao olho", () => {
  assert.deepEqual(MODELOS_ORBE.map((m) => m.valor), ["olho", "sol", "atomo", "aurora"]);
  assert.equal(orbeValido("sol"), "sol"); assert.equal(orbeValido("x"), "olho"); assert.equal(orbeValido(null), "olho");
});
test("gravar e ler: o olho (padrão) não guarda nada", () => {
  const a = armazem();
  gravarOrbe(a, "atomo"); assert.equal(lerOrbe(a), "atomo");
  gravarOrbe(a, "olho"); assert.equal(a.getItem("conecta:orbe"), null); assert.equal(lerOrbe(a), "olho");
  assert.equal(lerOrbe(null), "olho");
});
test("aplicarOrbe escreve data-orbe, e o olho remove o atributo", () => {
  const raiz = { dataset: {} as Record<string, string> } as unknown as HTMLElement;
  aplicarOrbe("aurora", raiz); assert.equal(raiz.dataset.orbe, "aurora");
  aplicarOrbe("olho", raiz); assert.equal(raiz.dataset.orbe, undefined);
});
