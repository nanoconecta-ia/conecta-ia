import { test } from "node:test";
import assert from "node:assert/strict";
import { codigoDaLeitura, campoCsvSeguro } from "./leitorEstoque.ts";

test("aceita EAN e SKU sem inventar equivalência", () => {
  assert.equal(codigoDaLeitura(" 7891234567895 "), "7891234567895");
  assert.equal(codigoDaLeitura("CI000016"), "CI000016");
});
test("não aceita QR de URL arbitrária", () => {
  assert.equal(codigoDaLeitura("https://exemplo.com/qualquer"), null);
  assert.equal(codigoDaLeitura("https://exemplo.com/?gtin=7891234567895"), "7891234567895");
  assert.equal(codigoDaLeitura(""), null);
});
test("CSV protege fórmulas e aspas", () => {
  assert.equal(campoCsvSeguro("=1+2"), "\"'=1+2\"");
  assert.equal(campoCsvSeguro('Produto "A"'), '"Produto ""A"""');
});
