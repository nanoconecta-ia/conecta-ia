import { test } from "node:test";
import assert from "node:assert/strict";
import { lerContextoDaLoja } from "./ler.ts";

const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
/** Banco falso: registra os filtros para provar que SEMPRE filtra por loja. */
function falso(contexto: unknown[], produtos: unknown[]) {
  const filtros: Record<string, unknown[]> = {};
  const q = (tabela: string, linhas: unknown[]) => { const b: any = { select: () => b, eq: (c: string, v: unknown) => { (filtros[`${tabela}.${c}`] ??= []).push(v); return b; }, gt: () => b, in: (c: string, v: unknown) => { (filtros[`${tabela}.${c}`] ??= []).push(v); return b; }, order: () => b, limit: () => b, then: (r: (x: unknown) => unknown) => r({ data: linhas, error: null }) }; return b; };
  return { admin: { from: (t: string) => q(t, t === "contexto_sessoes" ? contexto : produtos) }, filtros };
}
const prod = [{ id: U(1), sku: "OC1224", nome: "Filtro de óleo", marca: "X", custo: 9.9, fornecedor: "F" }, { id: U(2), sku: "80692", nome: "Junta", marca: "Y" }];

test("devolve produto ativo e seleção múltipla só com id, SKU, nome e marca", async () => {
  const { admin, filtros } = falso([{ origem: "conecta-ui", produto_ativo_id: U(1), produtos_selecionados: [U(1), U(2)], versao: 3, atualizado_em: "2026-11-03T12:00:00Z" }], prod);
  const r = await lerContextoDaLoja(admin, U(1000));
  assert.ok(r.disponivel); assert.equal(r.produto_ativo?.sku, "OC1224"); assert.deepEqual(r.selecionados.map((p) => p.sku), ["OC1224", "80692"]);
  assert.equal(JSON.stringify(r).includes("custo"), false); assert.equal(JSON.stringify(r).includes("fornecedor"), false);
  assert.deepEqual(filtros["contexto_sessoes.loja_id"], [U(1000)]); assert.deepEqual(filtros["produtos.loja_id"], [U(1000)]);
});
test("sem contexto válido: indisponível, sem inventar SKU", async () => {
  const r = await lerContextoDaLoja(falso([], []).admin, U(1000));
  assert.deepEqual([r.disponivel, (r as { erro?: string }).erro], [false, "contexto_indisponivel"]);
});
test("produto que sumiu da loja não aparece (não vaza id órfão)", async () => {
  const { admin } = falso([{ origem: "conecta-ui", produto_ativo_id: U(9), produtos_selecionados: [U(9)], versao: 1, atualizado_em: "2026-11-03T12:00:00Z" }], []);
  const r = await lerContextoDaLoja(admin, U(1000)); assert.ok(r.disponivel); assert.equal(r.produto_ativo, null); assert.deepEqual(r.selecionados, []);
});
