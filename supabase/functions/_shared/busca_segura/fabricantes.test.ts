import { test } from "node:test";
import assert from "node:assert/strict";
import { acharFabricante, dominiosConhecidos, FABRICANTES_INICIAIS, type Fabricante } from "./fabricantes.ts";

test("a lista inicial cobre as 10 categorias da especificação e nenhum registro nasce verificado, com domínio ou grupo inventado", () => {
  const cats = new Set(FABRICANTES_INICIAIS.map((x) => x.categoria));
  assert.equal(cats.size, 10);
  assert.ok(FABRICANTES_INICIAIS.length >= 70);
  for (const x of FABRICANTES_INICIAIS) { assert.equal(x.status, "nao_verificado", x.nome); assert.deepEqual(x.dominios, [], x.nome); assert.deepEqual(x.catalogos, [], x.nome); assert.equal(x.grupo, null, x.nome); assert.equal(x.site_oficial, null, x.nome); }
});
test("nomes não se repetem e marcas citadas na especificação estão presentes", () => {
  const nomes = FABRICANTES_INICIAIS.map((x) => x.nome.toLowerCase());
  assert.equal(new Set(nomes).size, nomes.length);
  for (const n of ["Sabó", "Jusa", "Schadek", "Indisa", "Urba", "GMB", "Hyundai Mobis", "Garrett", "Bosch"]) assert.ok(acharFabricante(n), n);
});
test("acharFabricante aceita apelidos, ignora acento e caixa, e NÃO adivinha por semelhança", () => {
  assert.equal(acharFabricante("metal leve")?.nome, "MAHLE");
  assert.equal(acharFabricante("SABO")?.nome, "Sabó");
  assert.equal(acharFabricante("kolbenschmidt")?.nome, "KS");
  assert.equal(acharFabricante("Trim Go"), null, "marca fora da lista não vira outra");
  assert.equal(acharFabricante("Sab"), null); assert.equal(acharFabricante(""), null);
});
test("só domínio de registro VERIFICADO vira fonte oficial; montadora vira 'montadora_oficial'", () => {
  const lista: Fabricante[] = [
    { ...FABRICANTES_INICIAIS[0], dominios: ["www.mahle.exemplo"], status: "verificado" },
    { ...FABRICANTES_INICIAIS[1], dominios: ["ks.exemplo"], status: "em_verificacao" },
    { ...FABRICANTES_INICIAIS.find((x) => x.nome === "Hyundai Mobis")!, dominios: ["mobis.exemplo"], status: "verificado" },
  ];
  assert.deepEqual(dominiosConhecidos(lista), { "mahle.exemplo": "fabricante_oficial", "mobis.exemplo": "montadora_oficial" });
  assert.deepEqual(dominiosConhecidos(FABRICANTES_INICIAIS), {});
});
