import test from "node:test";
import assert from "node:assert/strict";
import { modeloDoAtalho, podeExibirProdutoTeste } from "./mobisVitrine.ts";

test("amostra exige Mobis em teste e vendas explicitamente desabilitadas", () => {
  assert.equal(podeExibirProdutoTeste({slug:"mobis", ambiente:"teste", venda_habilitada:false}), true);
  for (const loja of [undefined, null, {slug:"outra", ambiente:"teste", venda_habilitada:false}, {slug:"mobis", ambiente:"producao", venda_habilitada:false}, {slug:"mobis", ambiente:"teste", venda_habilitada:true}, {slug:"mobis", ambiente:"teste"}, {slug:"mobis", venda_habilitada:false}]) {
    assert.equal(podeExibirProdutoTeste(loja), false);
  }
});

test("atalho usa modelo aprovado, sem confundir HR com HRA ou escolher uma versão arbitrária", () => {
  assert.equal(modeloDoAtalho("HR", ["Hyundai HR", "HRA"]), "Hyundai HR");
  assert.equal(modeloDoAtalho("Bongo", ["Kia Bongo K2500"]), "Kia Bongo K2500");
  assert.equal(modeloDoAtalho("HR", ["HR", "Hyundai HR"]), "HR");
  assert.equal(modeloDoAtalho("HR", ["HR 8V", "HR 16V"]), "");
  assert.equal(modeloDoAtalho("HR", ["HRA"]), "");
  assert.equal(modeloDoAtalho("", ["HR"]), "");
});
