import { test } from "node:test";
import assert from "node:assert/strict";
import { atributoDoTema, gravarPreferencia, lerPreferencia, preferenciaValida } from "./tema.ts";

const memoria = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m }; };

test("valor desconhecido vira automático", () => {
  for (const v of [undefined, null, "", "azul", 3]) assert.equal(preferenciaValida(v), "auto");
  for (const v of ["claro", "escuro", "noturno"]) assert.equal(preferenciaValida(v), v);
});

test("automático não escreve atributo; os outros escrevem o próprio nome", () => {
  assert.equal(atributoDoTema("auto"), null);
  assert.equal(atributoDoTema("noturno"), "noturno");
});

test("grava e lê a escolha; voltar ao automático apaga o registro", () => {
  const a = memoria();
  gravarPreferencia(a, "escuro");
  assert.equal(lerPreferencia(a), "escuro");
  gravarPreferencia(a, "auto");
  assert.equal(a.m.size, 0);
  assert.equal(lerPreferencia(a), "auto");
});

test("storage ausente ou que lança não quebra", () => {
  assert.equal(lerPreferencia(null), "auto");
  const quebrado = { getItem: () => { throw new Error("bloqueado"); }, setItem: () => { throw new Error("bloqueado"); }, removeItem: () => { throw new Error("bloqueado"); } };
  assert.equal(lerPreferencia(quebrado), "auto");
  assert.doesNotThrow(() => gravarPreferencia(quebrado, "claro"));
  assert.doesNotThrow(() => gravarPreferencia(null, "claro"));
});
