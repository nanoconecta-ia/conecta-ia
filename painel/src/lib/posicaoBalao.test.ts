import { test } from "node:test";
import assert from "node:assert/strict";
import { coordenadas, encaixar, MARGEM, pontoDeGuia } from "./posicaoBalao.ts";

const tela = { w: 1280, h: 800 }, balao = { w: 150, h: 64 };
test("solta perto da esquerda gruda na esquerda; perto da direita, na direita", () => {
  assert.equal(encaixar(100, 300, tela, balao).lado, "esq"); assert.equal(encaixar(1100, 300, tela, balao).lado, "dir");
});
test("Y fica dentro da tela, abaixo do cabeçalho e acima da barra de status", () => {
  assert.equal(encaixar(10, -50, tela, balao).y, 64 + MARGEM);
  assert.equal(encaixar(10, 5000, tela, balao).y, 800 - 64 - 36 - MARGEM);
});
test("coordenadas: lado define o X; sem Y salvo fica embaixo; tela pequena nunca sai do quadro", () => {
  assert.deepEqual(coordenadas({ lado: "esq", y: 200 }, tela, balao), { x: MARGEM, y: 200 });
  assert.deepEqual(coordenadas({ lado: "dir", y: null }, tela, balao), { x: 1280 - 150 - MARGEM, y: 800 - 64 - 36 - MARGEM });
  const c = coordenadas({ lado: "dir", y: 9999 }, { w: 390, h: 600 }, balao); assert.ok(c.x >= 0 && c.x + 150 <= 390 && c.y + 64 <= 600);
});
test("ponto de guia fica no alto, perto do título da tela", () => {
  const g = pontoDeGuia(tela, balao); assert.equal(g.lado, "dir"); assert.ok((g.y ?? 0) < 120);
});
