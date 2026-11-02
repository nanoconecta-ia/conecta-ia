// Testes de aceite 1 e 2 do PR #242. Dados de exemplo só nos testes (o código não traz montadora, modelo nem motor).
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolverEntidades, type GlossarioMotor } from "./entidades.ts";
import type { Vocabulario } from "../consulta/interpretar.ts";

const voc: Vocabulario = {
  modelos: [{ montadora: "Hyundai", modelo: "HR", categoria: "caminhao", versoes: ["2.5 8V", "2.5 16V"] }, { montadora: "Kia", modelo: "Bongo", categoria: "caminhao", versoes: ["2.5"] }],
  pecas: [{ slug: "junta-cabecote", nome: "Junta do cabeçote", sinonimos: ["junta de motor"] }],
};
const gloss: GlossarioMotor = { termos: [
  { codigo: "4D56", valvulas: 8, cilindrada: "2.5", aplicacoes: [{ montadora: "Hyundai", modelo: "HR", de: 2005, ate: 2012 }] },
  { codigo: "D4BH", valvulas: 8, cilindrada: "2.5", aplicacoes: [{ montadora: "Hyundai", modelo: "HR", de: 2005, ate: 2012 }] },
  { codigo: "D4CB", valvulas: 16, cilindrada: "2.5", aplicacoes: [{ montadora: "Hyundai", modelo: "HR", de: 2007 }] },
] };

test("aceite 1: 'HR 2008' é ano/modelo candidato, NUNCA motor confirmado; pergunta 8V/16V, código do motor ou chassi", () => {
  const r = resolverEntidades("preciso da junta do cabeçote do HR 2008", voc, gloss);
  assert.equal(r.ano.valor, 2008); assert.equal(r.ano.e_motor, false);
  assert.equal(r.motor.informado, null); assert.equal(r.motor.verificado, false); assert.equal(r.motor.ambiguo, true);
  assert.ok(r.perguntas.some((p) => /8V ou 16V/.test(p) && /código do motor/.test(p) && /chassi/.test(p)), JSON.stringify(r.perguntas));
});
test("aceite 1: sem glossário para o modelo, não presume motor e pergunta", () => {
  const r = resolverEntidades("junta do cabeçote do Bongo 2008", voc, { termos: [] });
  assert.equal(r.motor.candidatos.length, 0); assert.equal(r.motor.informado, null);
  assert.ok(r.avisos.some((a) => /não vou presumir/.test(a)));
  assert.ok(r.perguntas.some((p) => /código do motor/.test(p)));
});
test("aceite 2: códigos próximos (4D56/D4BH/D4BB) são termos candidatos, nunca equivalência", () => {
  const r = resolverEntidades("junta do HR 2008", voc, gloss);
  const cods = r.motor.candidatos.map((c) => c.codigo);
  assert.ok(cods.includes("4D56") && cods.includes("D4BH"));
  assert.ok(r.motor.candidatos.every((c) => c.equivalencia === "nao_afirmada" && c.fonte === "glossario"));
  assert.ok(r.avisos.some((a) => /NÃO equivalentes/.test(a)));
});
test("aceite 2: citar dois códigos juntos não os torna equivalentes nem escolhe um", () => {
  const r = resolverEntidades("junta 4D56 ou D4BH no HR", voc, gloss);
  assert.equal(r.motor.informado, null);
  assert.ok(r.avisos.some((a) => /não são tratados como equivalentes/.test(a)));
});
test("a pessoa digita UM código do glossário: vira 'informado', ainda não verificado", () => {
  const r = resolverEntidades("junta do cabeçote do HR 2008 motor 4D56", voc, gloss);
  assert.equal(r.motor.informado, "4D56"); assert.equal(r.motor.verificado, false); assert.equal(r.motor.ambiguo, false);
});
test("ano fora da faixa do glossário não gera candidato", () => {
  const r = resolverEntidades("junta do HR 1999", voc, gloss);
  assert.equal(r.motor.candidatos.length, 0);
});
test("candidato único continua hipótese", () => {
  const unico: GlossarioMotor = { termos: [gloss.termos[0]] };
  const r = resolverEntidades("junta do HR 2008", voc, unico);
  assert.equal(r.motor.candidatos.length, 1); assert.equal(r.motor.ambiguo, false); assert.equal(r.motor.informado, null);
  assert.ok(r.avisos.some((a) => /ainda é hipótese/.test(a)));
});
