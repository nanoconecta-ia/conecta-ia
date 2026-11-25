import { test } from "node:test";
import assert from "node:assert/strict";
import { linhaInformativaSemComercial, modoInformativoProduto } from "./catalogo_informativo.ts";
import { montarVitrine } from "./publica.ts";

test("catálogo enriquecido MOBIS esconde preço e saldo, mantendo o espelho imutável", () => {
  const bling = { sku: "CI003696", nome: "Motor parcial Trim Go", marca: "TRIM GO",
    preco: "18900.000000", estoque: "1.00", descricao_curta: "Motor 2.5 D4CB", precoCusto: 12500,
    fornecedor: "interno" };
  const semComercial = linhaInformativaSemComercial(bling, true);
  assert.equal(semComercial.preco, null);
  assert.equal(semComercial.estoque, null);
  assert.equal(bling.preco, "18900.000000");
  assert.equal(bling.estoque, "1.00");
  const vitrine = montarVitrine([semComercial], null);
  assert.equal(vitrine.length, 1);
  assert.equal(vitrine[0].preco, null);
  assert.equal(vitrine[0].em_estoque, null);
  assert.equal(vitrine[0].imagem, null);
  const retorno = JSON.stringify(vitrine);
  for (const segredo of ["18900", "12500", "precoCusto", "fornecedor", "interno"]) assert.ok(!retorno.includes(segredo), segredo);
});

test("oferta comercial permanece com preço somente fora do modo informativo", () => {
  const linha = { nome: "Filtro", sku: "F01", preco: 49, estoque: 10, marca: "X", descricao_curta: "Filtro" };
  const oferta = montarVitrine([linhaInformativaSemComercial(linha, false)], null);
  assert.equal(oferta[0].preco, 49);
  assert.equal(oferta[0].em_estoque, true);
});

test("visibilidade informativa depende de flag explícita do produto ou prévia legada", () => {
  assert.equal(modoInformativoProduto(false, { exibicao_informativa: true }), true);
  assert.equal(modoInformativoProduto(true, { exibicao_informativa: false }), true);
  assert.equal(modoInformativoProduto(false, { exibicao_informativa: false }), false);
  assert.equal(modoInformativoProduto(false, { exibicao_informativa: "true" }), false);
  assert.equal(modoInformativoProduto(false, {}), false);
});
