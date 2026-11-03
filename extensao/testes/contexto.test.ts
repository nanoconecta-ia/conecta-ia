import { test } from "node:test";
import assert from "node:assert/strict";
import { planejarContexto, publicarContexto, SEM_ESCOPO, skuUsavel } from "../src/contexto.ts";

test("plano: abre ao ver um SKU novo, não repete o mesmo, fecha quando a tela deixa de ser produto", () => {
  assert.deepEqual(planejarContexto(null, "OC1224"), { acao: "aberto", sku: "OC1224" });
  assert.equal(planejarContexto("OC1224", "OC1224"), null);
  assert.deepEqual(planejarContexto("OC1224", "80692"), { acao: "aberto", sku: "80692" });
  assert.deepEqual(planejarContexto("80692", null), { acao: "fechado", sku: "80692" });
  assert.equal(planejarContexto(null, null), null);
});
test("SKU inválido ou perigoso nunca é enviado", () => {
  for (const s of ["", " ", "x".repeat(61), ".oculto", "a b", "../../x", "OC1224;drop", "<script>"]) assert.equal(skuUsavel(s), null, s);
  assert.equal(skuUsavel(" OC1224 "), "OC1224"); assert.equal(skuUsavel("CI000016"), "CI000016");
  assert.equal(planejarContexto(null, "<x>"), null);
});
test("publicar: manda só sku e ação, mostra o sucesso REAL (versão do servidor) e guarda o SKU", async () => {
  const chamadas: unknown[] = [];
  const e = await publicarContexto({ sku: null, mensagem: "" }, "OC1224", async (n, a) => { chamadas.push([n, a]); return { ok: true, versao: 4 }; });
  assert.deepEqual(chamadas, [["conecta.set_active_product", { sku: "OC1224", acao: "aberto" }]]);
  assert.deepEqual(e, { sku: "OC1224", mensagem: "Compartilhado com o Nano: produto OC1224 (versão 4)." });
});
test("publicar: erro do servidor NÃO vira confirmação e não avança o estado", async () => {
  const e = await publicarContexto({ sku: null, mensagem: "" }, "NAO-EXISTE", async () => ({ erro: "Produto não encontrado nesta loja." }));
  assert.equal(e.sku, null); assert.match(e.mensagem, /não encontrado/i); assert.doesNotMatch(e.mensagem, /Compartilhado/);
});
test("publicar: sessão antiga sem o escopo orienta a reconectar", async () => {
  const e = await publicarContexto({ sku: null, mensagem: "" }, "OC1224", async () => { throw new Error("Permissão negada: esta sessão não tem o escopo contexto:registrar. O lojista precisa parear de novo concedendo esse escopo."); });
  assert.equal(e.mensagem, SEM_ESCOPO); assert.equal(e.sku, null);
});
test("publicar: sem mudança não chama a rede; fechar limpa", async () => {
  let n = 0; const chamar = async () => { n++; return { ok: true, versao: 5 }; };
  const igual = { sku: "OC1224", mensagem: "x" };
  assert.equal(await publicarContexto(igual, "OC1224", chamar), igual); assert.equal(n, 0);
  assert.deepEqual(await publicarContexto(igual, null, chamar), { sku: null, mensagem: "Nenhum produto aberto na tela; contexto limpo." }); assert.equal(n, 1);
});
