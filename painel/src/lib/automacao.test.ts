import { test } from "node:test";
import assert from "node:assert/strict";
import { alternar, alternarTodos, erroAutomacao, mensagemAutomacao, textoLote, LIMITE_LOTE } from "./automacao.ts";

test("seleção: alternar um produto não altera a seleção original", () => {
  const base = new Set(["a"]);
  const com = alternar(base, "b");
  assert.deepEqual([...com].sort(), ["a", "b"]);
  assert.deepEqual([...base], ["a"]);
  assert.deepEqual([...alternar(com, "a")], ["b"]);
});
test("seleção: 'todos' seleciona os visíveis e, se já estavam todos, limpa", () => {
  assert.deepEqual([...alternarTodos(new Set(), ["a", "b"])].sort(), ["a", "b"]);
  assert.equal(alternarTodos(new Set(["a", "b"]), ["a", "b"]).size, 0);
  assert.equal(alternarTodos(new Set(), []).size, 0, "lista vazia não seleciona nada");
});
test("mensagens: dizem o que aconteceu e quantos produtos", () => {
  assert.match(mensagemAutomacao(true, 3), /parado em 3 produtos/);
  assert.match(mensagemAutomacao(false, 1), /retomado em 1 produto\./);
  assert.equal(textoLote(1), "1 produto");
  assert.match(erroAutomacao("42501", 2), /lojista/);
  assert.match(erroAutomacao(undefined, LIMITE_LOTE + 1), /500/);
});
