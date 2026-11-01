import { test } from "node:test";
import assert from "node:assert/strict";
import { gravarConsentimento, lerConsentimento } from "./consentimentoEnvio.ts";

const falso = () => { const m = new Map<string, string>(); return { m, a: { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) } }; };

test("o consentimento é por loja e por provedor, e só vale depois de gravado", () => {
  const { a } = falso();
  assert.equal(lerConsentimento(a, "L1", "gemini"), false);
  gravarConsentimento(a, "L1", "gemini", true);
  assert.equal(lerConsentimento(a, "L1", "gemini"), true);
  assert.equal(lerConsentimento(a, "L2", "gemini"), false, "outra loja não herda");
  assert.equal(lerConsentimento(a, "L1", "claude"), false, "outro provedor não herda");
});
test("desfazer apaga; storage ausente ou que lança nunca autoriza", () => {
  const { a } = falso();
  gravarConsentimento(a, "L1", "gemini", true); gravarConsentimento(a, "L1", "gemini", false);
  assert.equal(lerConsentimento(a, "L1", "gemini"), false);
  assert.equal(lerConsentimento(null, "L1", "gemini"), false);
  const quebra = { getItem: () => { throw new Error("x"); }, setItem: () => { throw new Error("x"); }, removeItem: () => { throw new Error("x"); } };
  assert.equal(lerConsentimento(quebra, "L1", "gemini"), false);
  assert.doesNotThrow(() => gravarConsentimento(quebra, "L1", "gemini", true));
});
