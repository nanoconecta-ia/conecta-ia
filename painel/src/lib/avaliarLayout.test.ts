import { test } from "node:test";
import assert from "node:assert/strict";
import { avaliar, type Instantaneo } from "./avaliarLayout.ts";

const limpo: Instantaneo = { largura: 390, rolagemHorizontal: false, alvosPequenos: 0, exemplosAlvos: [], imagensSemAlt: 0, botoesSemNome: 0, camposSemRotulo: 0, h1: 1, saltoDeTitulo: false, textoPequeno: 0, foraDaTela: 0, titulo: "Catálogo" };

test("tela sem problemas: nota 100 e aviso de que não substitui olhar a tela", () => {
  const r = avaliar(limpo); assert.equal(r.nota, 100); assert.equal(r.achados.length, 0); assert.match(r.resumo, /não substitui olhar a tela/);
});
test("problemas de celular pesam mais e saem em linguagem clara, com exemplos", () => {
  const r = avaliar({ ...limpo, rolagemHorizontal: true, alvosPequenos: 4, exemplosAlvos: ["Salvar", "×"], imagensSemAlt: 2, h1: 0 });
  assert.equal(r.achados[0].gravidade, "alta"); assert.match(r.resumo, /rola na horizontal em 390 px/); assert.match(r.resumo, /\(ex\.: Salvar, ×\)/);
  assert.ok(r.nota < 60 && r.nota >= 0); assert.match(r.resumo, /imagem\(ns\) sem texto alternativo/);
  const desktop = avaliar({ ...limpo, largura: 1280, alvosPequenos: 4 }); assert.equal(desktop.achados[0].gravidade, "media");
});
test("nota nunca fica abaixo de zero e títulos duplicados/pulados são apontados", () => {
  const r = avaliar({ ...limpo, rolagemHorizontal: true, foraDaTela: 3, alvosPequenos: 9, botoesSemNome: 2, camposSemRotulo: 3, h1: 2, saltoDeTitulo: true, textoPequeno: 5 });
  assert.equal(r.nota, 0); assert.match(r.resumo, /2 títulos principais/); assert.match(r.resumo, /pula níveis/);
});
