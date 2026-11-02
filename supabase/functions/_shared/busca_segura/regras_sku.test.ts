import { test } from "node:test";
import assert from "node:assert/strict";
import { proximoSku, sequenciaMaxima, skuValido } from "./regras_sku.ts";

test("o formato é CI + 6 dígitos, como CI000016 e CI001086", () => {
  for (const ok of ["CI000016", "CI001086", "ci000001"]) assert.ok(skuValido(ok.toUpperCase()), ok);
  for (const ruim of ["CI16", "CI0000016", "XX000016", "CI00001A", "82892", ""]) assert.ok(!skuValido(ruim), ruim);
});
test("o próximo vem depois do MAIOR conhecido, ignorando outros formatos (códigos numéricos de fábrica não contam)", () => {
  assert.equal(sequenciaMaxima(["CI000016", "CI001086", "82892", "0986B01001", "ci000002"]), 1086);
  assert.equal(proximoSku(["CI000016", "CI001086", "82892", "1543"]), "CI001087");
  assert.equal(proximoSku([]), "CI000001");
});
test("nunca reutiliza código ocupado (inclusive os que o Bling acusou como existentes)", () => {
  assert.equal(proximoSku(["CI000016"], ["CI000017", "CI000018"]), "CI000019", "ocupados no Bling avançam a sequência");
  assert.equal(proximoSku(["CI000010"], ["CI000011"]), "CI000012");
});
test("a sequência esgotada falha com mensagem clara, sem repetir", () => {
  assert.throws(() => proximoSku(["CI999999"]), /esgotada/);
});
