import assert from "node:assert/strict";
import { test } from "node:test";
import { iconeNoMapa } from "./iconeNoMapa.ts";
import { PECAS } from "./icones.ts";

test("mapa usa ícone real existente no sprite para nós de taxonomia", () => {
  for (const [nome, icone] of [
    ["Bomba d'água", "arrefecimento"],
    ["Pistões com Anéis", "motor"],
    ["Correias e Tensores", "motor"],
    ["Alternadores", "eletrica"],
    ["Kit Embreagem", "transmissao"],
    ["Filtros de Óleo", "filtros"],
    ["Injetores Diesel", "alimentacao"],
  ]) assert.equal(iconeNoMapa("tx:uuid", nome), icone);
  assert.equal(iconeNoMapa("taxonomia", "Taxonomia"), "todas");
});
test("não sinaliza peça em métricas, fornecedor, preço ou nós não taxonômicos", () => {
  for (const id of ["catalogo", "atencao", "falta:ncm", "situacao", "publicados"]) {
    assert.equal(iconeNoMapa(id, "Bomba d'água"), null);
  }
});
test("categoria desconhecida usa o símbolo genérico seguro", () => {
  assert.equal(iconeNoMapa("tx:outro", "Peça não identificada"), "todas");
  assert.ok(PECAS.includes(iconeNoMapa("tx:outra", "Turbina")!));
});
