import { test } from "node:test";
import assert from "node:assert/strict";
import { montarPedidoCorrecao } from "./correcaoCadastro.ts";

const fonte = "https://fabricante.exemplo.com.br/catalogo/82892";
test("pedido válido: só os campos preenchidos, peso normalizado, fonte obrigatória", () => {
  const r = montarPedidoCorrecao({ marca: " SABÓ ", gtin: "7891252828923", pesoKg: "0,35", fonte });
  assert.ok(r.ok); if (!r.ok) return;
  assert.deepEqual(r.campos, { marca: "SABÓ", gtin: "7891252828923", pesoLiquido: 0.35 });
  assert.equal(r.fonte, fonte);
});
test("marca genérica (IMPORTADO, NACIONAL…) é recusada: não identifica o fabricante", () => {
  for (const m of ["IMPORTADO", "nacional", "Genérico", "sem marca"]) { const r = montarPedidoCorrecao({ marca: m, fonte }); assert.equal(r.ok, false, m); }
});
test("sem fonte não há proposta; sem nenhum campo também não", () => {
  assert.equal(montarPedidoCorrecao({ marca: "SABÓ" }).ok, false);
  assert.equal(montarPedidoCorrecao({ marca: "SABÓ", fonte: "x" }).ok, false);
  assert.equal(montarPedidoCorrecao({ fonte }).ok, false);
});
test("GTIN com dígito verificador errado ou tamanho errado é recusado; válido passa", () => {
  assert.equal(montarPedidoCorrecao({ gtin: "7891252828924", fonte }).ok, false);
  assert.equal(montarPedidoCorrecao({ gtin: "12345", fonte }).ok, false);
  assert.equal(montarPedidoCorrecao({ gtin: "7891252828923", fonte }).ok, true);
});
test("peso inválido e descrição com HTML ou dado privado são recusados", () => {
  for (const p of ["0", "-1", "abc", "9999"]) assert.equal(montarPedidoCorrecao({ pesoKg: p, fonte }).ok, false, p);
  assert.equal(montarPedidoCorrecao({ descricaoCurta: "<svg onload=x></svg> peça de motor", fonte }).ok, false);
  assert.equal(montarPedidoCorrecao({ descricaoCurta: "Peça com custo de compra alto no fornecedor", fonte }).ok, false);
  assert.equal(montarPedidoCorrecao({ descricaoCurta: "Junta de cabeçote metálica para motor diesel", fonte }).ok, true);
});
