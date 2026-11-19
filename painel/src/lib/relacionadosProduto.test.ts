import { test } from "node:test";
import assert from "node:assert/strict";
import { selecionarRelacionados } from "./relacionadosProduto.ts";

const itens = [
  { sku: "CI003696", nome: "Motor HR", categoria: "Motor", marca: "Trim Go", imagem: null },
  { sku: "FIL01", nome: "Filtro diesel", categoria: "Filtros", marca: "Vega", imagem: null },
  { sku: "MOT02", nome: "Motor parcial", categoria: "Motor", marca: "Trim Go", imagem: null },
  { sku: "MOT02", nome: "Motor parcial repetido", categoria: "Motor", marca: "Trim Go", imagem: null },
  { sku: "SUS01", nome: "Bandeja", categoria: "Suspensão", marca: "Marca", imagem: null },
];
test("relacionados: jamais sugere a própria peça ou duplica SKU", () => {
  const lista = selecionarRelacionados({ sku: "CI003696", categoria: "Motor" }, itens, 6);
  assert.deepEqual(lista.map((x) => x.sku), ["MOT02", "FIL01", "SUS01"]);
});
test("relacionados: categoria só ordena catálogo, não cria aplicações ou OEM", () => {
  const lista = selecionarRelacionados({ sku: "CI003696", categoria: "Motor" }, itens, 2);
  assert.equal(lista.length, 2);
  assert.equal(lista[0].sku, "MOT02");
  assert.equal("compativel" in lista[0], false);
});
test("relacionados: lista vazia ou limite zero não mostra produtos inventados", () => {
  assert.deepEqual(selecionarRelacionados({ sku: "X" }, [], 5), []);
  assert.deepEqual(selecionarRelacionados({ sku: "CI003696" }, itens, 0), []);
});
