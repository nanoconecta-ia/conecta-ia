import { test } from "node:test";
import assert from "node:assert/strict";
import { mapearCategoria, sincronizarCategorias, type CategoriaBling, type LinhaCategoria, type PortasCategorias } from "./bling_categorias.ts";

function portas(itens: CategoriaBling[], existentes: string[] = [], falha = false) {
  const gravadas: LinhaCategoria[] = []; let removidas: string[] = []; const erros: string[] = [];
  const p: PortasCategorias = {
    listarPagina: async (pg, lim) => (falha ? { erro: "Bling 503" } : { itens: itens.slice((pg - 1) * lim, pg * lim) }),
    existentes: async () => existentes, gravar: async (l) => { gravadas.push(...l); }, remover: async (ids) => { removidas = ids; },
    registrarErro: async (m) => { erros.push(m); }, espera: async () => {}, agora: () => 0,
  };
  return { p, gravadas, erros, get removidas() { return removidas; } };
}

test("mapeia pai 0/ausente como raiz e ignora item sem id ou nome", () => {
  assert.equal(mapearCategoria("L", { id: 5, descricao: " Motor ", categoriaPai: { id: 0 } }, "t")!.pai_bling_id, null);
  assert.equal(mapearCategoria("L", { id: 6, descricao: "Bielas", categoriaPai: { id: 5 } }, "t")!.pai_bling_id, "5");
  assert.equal(mapearCategoria("L", { id: 7, descricao: "X" }, "t")!.pai_bling_id, null);
  assert.equal(mapearCategoria("L", { id: 8, descricao: "Y", categoriaPai: { id: 8 } }, "t")!.pai_bling_id, null);
  assert.equal(mapearCategoria("L", { id: 9, descricao: "  " }, "t"), null);
  assert.equal(mapearCategoria("L", { id: "", descricao: "Z" }, "t"), null);
  assert.equal(mapearCategoria("L", { id: 5, descricao: "Motor" }, "t")!.bling_id, "5");
});
test("grava a árvore inteira e remove só o que sumiu do Bling (listagem completa)", async () => {
  const itens = Array.from({ length: 130 }, (_, i) => ({ id: i + 1, descricao: `C${i + 1}`, categoriaPai: { id: i > 9 ? 1 : 0 } }));
  const h = portas(itens, ["1", "2", "900", "901"]);
  const r = await sincronizarCategorias("L", h.p);
  assert.equal(r.completo, true); assert.equal(r.paginas, 2); assert.equal(r.vistas, 130); assert.equal(r.gravadas, 130);
  assert.deepEqual(h.removidas, ["900", "901"]); assert.equal(r.removidas, 2);
});
test("lista vazia não apaga o espelho", async () => {
  const h = portas([], ["1", "2"]); const r = await sincronizarCategorias("L", h.p);
  assert.equal(r.gravadas, 0); assert.equal(r.removidas, 0); assert.deepEqual(h.removidas, []);
});
test("falha do Bling não grava nem remove, e registra o erro", async () => {
  const h = portas([{ id: 1, descricao: "A" }], ["1", "2"], true); const r = await sincronizarCategorias("L", h.p);
  assert.equal(r.completo, false); assert.equal(h.gravadas.length, 0); assert.deepEqual(h.removidas, []); assert.equal(h.erros.length, 1);
});
