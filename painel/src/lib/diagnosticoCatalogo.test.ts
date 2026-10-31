import { test } from "node:test";
import { strict as assert } from "node:assert";
import { avisoPublicacao, diagnosticarSkus } from "./diagnosticoCatalogo.ts";
test("SKUs repetidos sem apagar ou presumir equivalência", () => {
  const d = diagnosticarSkus([{ sku: " abc " }, { sku: "ABC" }, { sku: "D4BH" }, { sku: "" }, { sku: null }]);
  assert.deepEqual(d, { repetidos: 1, vazios: 2, analisados: 5 });
});
test("SKU distinto nunca sinaliza falso duplicado", () => assert.equal(diagnosticarSkus([{sku:"AB-1"},{sku:"AB-2"}]).repetidos, 0));
test("alerta de vitrine não inventa falhas quando há erro na consulta", () => {
  assert.equal(avisoPublicacao(null, 42), null);
  assert.match(avisoPublicacao(0, 42) ?? "", /Nenhum produto/);
  assert.equal(avisoPublicacao(3, 42), null);
});
