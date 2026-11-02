import { test } from "node:test";
import assert from "node:assert/strict";
import { falhaDoProvedor, skuEmFoco } from "./recuperacaoSemIa.ts";

test("reconhece falha do provedor e não confunde com outros erros", () => {
  assert.ok(falhaDoProvedor("O provedor de IA está sobrecarregado ou o limite da chave foi atingido. Tente em instantes."));
  assert.ok(falhaDoProvedor("Limite mensal do provedor atingido."));
  assert.ok(falhaDoProvedor("Provedor indisponível no servidor."));
  assert.ok(!falhaDoProvedor("Sua sessão expirou. Entre de novo."));
  assert.ok(!falhaDoProvedor("Sem permissão para esta loja."));
});
test("acha o SKU no texto novo, senão no mais recente das mensagens anteriores", () => {
  assert.equal(skuEmFoco("o que é o CI001086?", []), "CI001086");
  assert.equal(skuEmFoco("que produto é este", ["Olá", "/ficha 82892", "Ficha do SKU CI000016: bomba"]), "CI000016");
  assert.equal(skuEmFoco("Oi", ["Olá! Posso resumir a loja"]), null);
});
test("ano de veículo não é SKU; SKU numérico sim", () => {
  assert.equal(skuEmFoco("serve no HR 2013?", []), null);
  assert.equal(skuEmFoco("serve no HR 2013? SKU 82892", []), "82892");
});
test("usa a última menção quando há várias", () => {
  assert.equal(skuEmFoco("compare CI000016 com CI001086", []), "CI001086");
});
