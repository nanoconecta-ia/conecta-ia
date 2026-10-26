import { test } from "node:test";
import assert from "node:assert/strict";
import { camposFaltando, contagens, filtrar, semCategoria, situacaoTexto, type LinhaPlanilha } from "./planilha.ts";

const base: LinhaPlanilha = {
  id: "1", sku: "A1", nome: "Filtro", marca: "WEGA", gtin: "789", peso_kg: 0.5,
  descricao_curta: "<p>Filtro de óleo</p>", descricao_complementar: null,
  categoria_bling_id: "10", situacao: "A", taxonomia_no_id: "n1", imagens: 1,
};
const listadas = new Set(["10", "20"]);

test("produto completo não tem campo faltando", () => {
  assert.deepEqual(camposFaltando(base), []);
});
test("campos vazios são listados na ordem; HTML vazio conta como vazio", () => {
  const p = { ...base, marca: " ", gtin: null, peso_kg: 0, descricao_curta: "<p></p>", imagens: 0 };
  assert.deepEqual(camposFaltando(p), ["marca", "descrição", "GTIN", "peso", "imagem"]);
});
test("descrição complementar basta para a descrição não faltar", () => {
  assert.equal(camposFaltando({ ...base, descricao_curta: null, descricao_complementar: "texto" }).includes("descrição"), false);
});
test("sem categoria: categoria em branco ou que o Bling não lista (padrão)", () => {
  assert.equal(semCategoria({ ...base, categoria_bling_id: null }, listadas), true);
  assert.equal(semCategoria({ ...base, categoria_bling_id: "1072643" }, listadas), true);
  assert.equal(semCategoria(base, listadas), false);
});
test("filtros e contagens batem com os produtos", () => {
  const itens: LinhaPlanilha[] = [
    base,
    { ...base, id: "2", categoria_bling_id: "1072643", taxonomia_no_id: null, imagens: 0 },
    { ...base, id: "3", situacao: "I" },
  ];
  assert.deepEqual(filtrar(itens, "sem_categoria", listadas).map((p) => p.id), ["2"]);
  assert.deepEqual(filtrar(itens, "incompletos", listadas).map((p) => p.id), ["2"]);
  assert.deepEqual(filtrar(itens, "inativos", listadas).map((p) => p.id), ["3"]);
  assert.deepEqual(filtrar(itens, "sem_no", listadas).map((p) => p.id), ["2"]);
  assert.equal(filtrar(itens, "todos", listadas).length, 3);
  assert.deepEqual(contagens(itens, listadas), { todos: 3, sem_categoria: 1, incompletos: 1, inativos: 1, sem_no: 1 });
});
test("situação em português claro", () => {
  assert.equal(situacaoTexto("A"), "ativo");
  assert.equal(situacaoTexto("I"), "inativo");
  assert.equal(situacaoTexto("ausente"), "sumiu do Bling");
  assert.equal(situacaoTexto(null), "—");
});
