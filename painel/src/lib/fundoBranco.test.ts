import { test } from "node:test";
import assert from "node:assert/strict";
import { enquadrarEmBranco, nomeDaCopia } from "./fundoBranco.ts";

test("horizontal conserva dimensões e só acrescenta borda branca", () => {
  assert.deepEqual(enquadrarEmBranco(600, 400), {
    lado: 1200, x: 300, y: 400, largura: 600, altura: 400, ampliado: false,
  });
});
test("vertical grande reduz sem esticar, ocupa caixa interior e centraliza", () => {
  const r = enquadrarEmBranco(1000, 2000);
  assert.deepEqual(r, { lado: 1200, x: 330, y: 60, largura: 540, altura: 1080, ampliado: false });
  assert.equal(r.largura / r.altura, 0.5);
});
test("peça pequena não é ampliada para fingir resolução original", () => {
  const r = enquadrarEmBranco(200, 100);
  assert.equal(r.largura, 200);
  assert.equal(r.altura, 100);
  assert.equal(r.lado, 1200);
});
test("sugestão de nome não sobrescreve fonte", () => {
  assert.equal(nomeDaCopia("CI000016.png"), "CI000016-fundo-branco-1200x1200.jpg");
  assert.ok(!nomeDaCopia("../../segredo?.png").includes("/"));
});
test("rejeita tamanhos inválidos", () => {
  for(const x of [[0,100],[100,-1],[NaN,1],[1,Infinity]]) assert.throws(()=>enquadrarEmBranco(x[0],x[1]));
  assert.throws(()=>enquadrarEmBranco(100,200,10));
});
