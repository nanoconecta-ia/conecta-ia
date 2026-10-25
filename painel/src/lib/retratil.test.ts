import { test } from "node:test";
import assert from "node:assert/strict";
import { comecoDaLonga, ehLonga, LIMITE_LONGA, mensagemRecolhida, resumoEvidencia, resumoLinha } from "./retratil.ts";

test("resumo de uma linha: sem marcação, corta em palavra e usa reticências", () => {
  assert.equal(resumoLinha("**Achei** três\n\nregistros"), "Achei três registros");
  const r = resumoLinha("palavra ".repeat(40), 50); assert.ok(r.endsWith("…") && r.length <= 51 && !r.includes("  "));
});

test("só as 2 últimas ficam abertas; o que a pessoa abriu continua aberto; modos forçados valem", () => {
  const nenhuma = new Set<number>();
  assert.deepEqual([0, 1, 2, 3, 4].map((i) => mensagemRecolhida(i, 5, nenhuma, "auto")), [true, true, true, false, false]);
  assert.equal(mensagemRecolhida(0, 5, new Set([0]), "auto"), false);
  assert.equal(mensagemRecolhida(4, 5, nenhuma, "recolher"), true);
  assert.equal(mensagemRecolhida(0, 5, nenhuma, "expandir"), false);
  assert.equal(mensagemRecolhida(0, 1, nenhuma, "auto"), false, "conversa curta nunca recolhe");
});

test("resposta longa mostra só o começo, em fim de frase", () => {
  const longa = "Frase completa aqui. ".repeat(60);
  assert.ok(ehLonga(longa)); const c = comecoDaLonga(longa);
  assert.ok(c.length <= LIMITE_LONGA + 1 && c.endsWith("…") && /\.…$/.test(c));
  assert.equal(comecoDaLonga("curta"), "curta"); assert.equal(ehLonga("curta"), false);
});

test("resumo da evidência diz onde e quantos", () => {
  assert.equal(resumoEvidencia({ origem: "api_bling", total_candidatos: 3 }), "Consulta ao Bling (API) · 3 candidatos");
  assert.equal(resumoEvidencia({ origem: "espelho", candidatos: [1], simulado: true }), "Simulado · Consulta ao espelho · 1 candidato");
});
