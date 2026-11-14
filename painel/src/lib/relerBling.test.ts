import { test } from "node:test";
import assert from "node:assert/strict";
import { corpoReleitura, mensagemReleitura } from "./relerBling.ts";

test("corpoReleitura: um SKU, sem espaços; sem SKU não pede nada", () => {
  assert.deepEqual(corpoReleitura("L1", " CI002916 "), { loja_id: "L1", forcar_skus: ["CI002916"] });
  assert.equal(corpoReleitura("L1", null), null);
  assert.equal(corpoReleitura("L1", "  "), null);
  assert.equal(corpoReleitura("", "CI002916"), null);
  assert.equal(corpoReleitura("L1", "x".repeat(61)), null);
});

test("mensagemReleitura: só confirma quando algo foi gravado", () => {
  assert.equal(mensagemReleitura({ resultado: [{ gravados: 3, erro: true }] }).ok, true, "varredura parcial ainda grava o forçado primeiro");
  assert.equal(mensagemReleitura({ resultado: [{ gravados: 0 }] }).ok, false);
  assert.equal(mensagemReleitura(null).ok, false);
  assert.equal(mensagemReleitura({}).ok, false);
});
