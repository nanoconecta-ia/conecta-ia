import { test } from "node:test";
import assert from "node:assert/strict";
import { pesquisarProdutos, resumoDoLote } from "./catalogoExperiencia.ts";

const produtos = [
  { sku: "854008", nome: "Bomba d'água Indisa", marca: "INDISA", gtin: null, publicado: false, situacao: "E", imagens: 0 },
  { sku: "CI000016", nome: "Bomba água HR", marca: "TRIM GO", gtin: "7891234567895", publicado: true, situacao: "A", imagens: 2 },
  { sku: "KIT-001", nome: "Cabeçote 4N15", marca: "TRIM GO", gtin: null, publicado: false, situacao: "A", imagens: 0 },
];

test("catálogo: pesquisa por SKU exato ou parcial e marca com acento", () => {
  assert.deepEqual(pesquisarProdutos(produtos, "854008").map(p=>p.sku), ["854008"]);
  assert.deepEqual(pesquisarProdutos(produtos, "Indísa bomba").map(p=>p.sku), ["854008"]);
  assert.deepEqual(pesquisarProdutos(produtos, "trim go 4n15").map(p=>p.sku), ["KIT-001"]);
  assert.deepEqual(pesquisarProdutos(produtos, "7891234567895").map(p=>p.sku), ["CI000016"]);
});
test("catálogo: não confunde SKU semelhante com equivalência", () => {
  assert.deepEqual(pesquisarProdutos(produtos, "854008 CI000016"), []);
  assert.deepEqual(pesquisarProdutos(produtos, "").map(p=>p.sku), ["854008", "CI000016", "KIT-001"]);
});
test("catálogo: indicadores identificam apenas registros carregados", () => {
  assert.deepEqual(resumoDoLote(produtos), {carregados:3,publicados:1,inativos:1,semImagem:2});
});
