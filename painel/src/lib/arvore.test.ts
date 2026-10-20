import { test } from "node:test";
import assert from "node:assert/strict";
import { caminhoAte, contar, montarArvore, type No } from "./arvore.ts";

const n = (id: string, pai: string | null, nome: string, ordem = 0): No => ({ id, pai_id: pai, nome, slug: nome.toLowerCase(), ordem });
const nos = [n("1", null, "Motor"), n("2", "1", "Bielas"), n("3", "1", "Juntas", 1), n("4", null, "Freios", 1), n("5", "4", "Discos")];

test("hierarquia e totais somam nó + descendentes", () => {
  const a = montarArvore(nos, new Map([["2", 3], ["3", 2], ["5", 1]]), new Map([["1", 1], ["3", 1]]));
  assert.deepEqual(a.map((x) => x.nome), ["Motor", "Freios"]);
  assert.equal(a[0].produtos, 5);
  assert.equal(a[0].categoriasBling, 2);
  assert.equal(a[1].produtos, 1);
  assert.deepEqual(a[0].filhos.map((x) => x.nome), ["Bielas", "Juntas"]);
});

test("pai inexistente vira raiz; auto-referência e ciclo não quebram nem somem", () => {
  const a = montarArvore([n("1", "x", "Órfão"), n("2", "2", "Si mesmo"), n("3", "4", "A"), n("4", "3", "B")], new Map(), new Map());
  const todos = JSON.stringify(a);
  for (const nome of ["Órfão", "Si mesmo"]) assert.ok(todos.includes(nome), nome);
});

test("contar ignora nulos", () => {
  assert.deepEqual([...contar([{ k: "a" }, { k: null }, { k: "a" }, { k: "b" }], (i) => i.k)], [["a", 2], ["b", 1]]);
});

test("caminhoAte devolve a trilha raiz→nó; id desconhecido ou nulo → vazio", () => {
  const a = montarArvore(nos, new Map(), new Map());
  assert.deepEqual(caminhoAte(a, "5").map((x) => x.nome), ["Freios", "Discos"]);
  assert.deepEqual(caminhoAte(a, "zzz"), []);
  assert.deepEqual(caminhoAte(a, null), []);
});
