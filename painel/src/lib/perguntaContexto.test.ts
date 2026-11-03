import { test } from "node:test";
import assert from "node:assert/strict";
import { perguntaDeContexto } from "./perguntaContexto.ts";

test("reconhece as perguntas estruturadas sobre seleção e produto ativo", () => {
  for (const t of ["Quais produtos estão selecionados", "quais produtos estão selecionados?", "Qual é o produto ativo?", "qual o produto aberto agora", "Quais são os produtos selecionados no catálogo?", "o que eu selecionei", "mostre os produtos selecionados", "qual é a seleção atual",
    // caso real do dono (captura 00:25): digitado entre aspas, com ponto no fim
    'quais produtos estão selecionados".', '"quais produtos estão selecionados"', "“Quais produtos estão selecionados?”", "  quais produtos estão selecionados  ...  ", "(qual é o produto ativo)"])
    assert.equal(perguntaDeContexto(t), true, t);
});
test("não captura perguntas de outros assuntos nem comandos", () => {
  for (const t of ["qual o preço do produto selecionado e a margem", "me explique o produto ativo do motor", "/revisar CI000016", "quais produtos estão sem categoria", "o que é um turbocompressor", "selecione o produto OC1224", "\"/revisar CI000016\"", "", "x".repeat(200)])
    assert.equal(perguntaDeContexto(t), false, t);
});
