import { test } from "node:test";
import assert from "node:assert/strict";
import { assinar, despublicar, obter, publicar } from "./contextoPagina.ts";

test("publicar notifica quem assina, higieniza o mapa e despublicar só vale para a mesma rota", () => {
  let avisos = 0; const parar = assinar(() => { avisos++; });
  publicar("/catalogo", "Catálogo", { id: "r", rotulo: "Raiz", filhos: [{ id: "a", rotulo: "Sem GTIN", valor: 2 }, { id: "b", rotulo: "Preço de compra", valor: 9 }] });
  assert.equal(avisos, 1);
  assert.deepEqual(obter()!.mapa.filhos!.map((f) => f.id), ["a"], "o nó de custo foi removido antes de publicar");
  despublicar("/outra"); assert.ok(obter(), "rota diferente não apaga");
  despublicar("/catalogo"); assert.equal(obter(), null); assert.equal(avisos, 2);
  publicar("/x", "X", { id: "r", rotulo: "Custo total" }); assert.equal(obter(), null, "raiz proibida não publica nada");
  parar(); publicar("/y", "Y", { id: "r", rotulo: "Ok" }); assert.equal(avisos, 3, "depois de cancelar a assinatura, ninguém é avisado");
});
