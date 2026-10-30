import { test } from "node:test";
import assert from "node:assert/strict";
import { buscarProdutosPendentes, diagnosticoCatalogo, pendenciasProduto, type ProdutoEspelho } from "./qualidadeProduto.ts";

const pronto: ProdutoEspelho = {
  id: "1", sku: "K2500-001", nome: "Bomba d'água Hyundai", marca: "Marca verificada",
  gtin: null, descricao_curta: "Bomba", peso_kg: 1, largura_cm: 20, altura_cm: 12,
  profundidade_cm: 18, taxonomia_no_id: "n1", publicado: false, situacao: "A"
};
test("GTIN ausente não é inventado nem bloqueia automaticamente a triagem", () => {
  assert.deepEqual(pendenciasProduto(pronto), []);
});
test("logística exige dimensões positivas, marca e taxonomia documentada", () => {
  const p: ProdutoEspelho = { ...pronto, id: "2", marca: null, peso_kg: 0, altura_cm: null, taxonomia_no_id: null };
  assert.deepEqual(pendenciasProduto(p), ["Marca", "Taxonomia", "Logística"]);
  assert.deepEqual(diagnosticoCatalogo([pronto, p], [{ id: "n1", status: "proposto" }]), {
    analisados: 2, semMarca: 1, logisticaIncompleta: 1, semTaxonomia: 1, publicados: 0,
    comPendencias: 1, nosPropostos: 1, nosTotais: 1
  });
});
test("busca normalizada por nome, SKU e marca e filtro de pendências", () => {
  const p = { ...pronto, id: "2", nome: "Cabeçote D4CB", marca: "" };
  assert.deepEqual(buscarProdutosPendentes([pronto, p], "CABECOTE", true).map((x) => x.id), ["2"]);
  assert.deepEqual(buscarProdutosPendentes([pronto, p], "k2500", true), []);
});
