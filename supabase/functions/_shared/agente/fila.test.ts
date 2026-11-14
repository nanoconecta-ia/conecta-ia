import { test } from "node:test";
import assert from "node:assert/strict";
import { diagnosticoCadastro, planejarFila } from "./fila.ts";

const receitas = new Map([["bomba-oleo", { codigo: "peca_bomba_oleo", campos_exigidos: ["nome", "sku"] }]]);
const produtos = [
  { id: "1", nome: "BOMBA OLEO HR/K2500 D4BH" },
  { id: "2", nome: "BOMBA OLEO 4D56 D4BH CI000966" },
  { id: "3", nome: "BOMBA DAGUA HR/K2500" },
  { id: "4", nome: "TURBINA HR 16V" },
  { id: "5", nome: null },
];

test("enfileira só o que tem tipo E receita; o resto vai para listas separadas", () => {
  const p = planejarFila(produtos, receitas, new Set());
  assert.deepEqual(p.enfileirar.map((x) => x.produto_id), ["1", "2"]);
  assert.deepEqual(p.semReceita.map((x) => [x.produto_id, x.tipo]), [["3", "bombas-agua"]]);
  assert.deepEqual(p.semTipo.map((x) => x.produto_id), ["4", "5"]);
  assert.equal(p.jaNaFila, 0);
});

test("idempotente: não duplica tarefa já na fila", () => {
  const p = planejarFila(produtos, receitas, new Set(["1|bomba-oleo"]));
  assert.deepEqual(p.enfileirar.map((x) => x.produto_id), ["2"]);
  assert.equal(p.jaNaFila, 1);
  const again = planejarFila(produtos, receitas, new Set(["1|bomba-oleo", "2|bomba-oleo"]));
  assert.equal(again.enfileirar.length, 0);
  assert.equal(again.jaNaFila, 2);
});

test("diagnóstico do cadastro só aponta, e reconhece nome provisório", () => {
  assert.deepEqual(diagnosticoCadastro({ id: "x", nome: "Vela aquecedora HR/K2500 8V - confirmar código", preco: 0 }),
    ["sem_gtin", "sem_descricao", "sem_categoria", "sem_marca", "preco_zerado", "nome_provisorio"]);
  assert.deepEqual(diagnosticoCadastro({ id: "y", nome: "BOMBA OLEO", gtin: "7891234567895", descricao: "d", categoria: "c", marca: "m", preco: 10 }), []);
});
