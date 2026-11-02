import { test } from "node:test";
import assert from "node:assert/strict";
import { limparResumo, registrarResumo, RESUMO_MAX } from "./atividade.ts";

test("limpa HTML e controle, mantém texto simples", () => {
  const r = limparResumo("<b>Verifiquei</b> o CI000016\n\t— faltam GTIN e imagem <script>x()</script>");
  assert.equal(r.ok, true); if (r.ok) { assert.doesNotMatch(r.texto, /[<>]/); assert.match(r.texto, /Verifiquei o CI000016/); }
});
test("recusa vazio, não texto e acima do limite", () => {
  assert.equal(limparResumo("  <i></i> ").ok, false); assert.equal(limparResumo(42).ok, false); assert.equal(limparResumo("a".repeat(RESUMO_MAX + 1)).ok, false);
  assert.equal(limparResumo("a".repeat(RESUMO_MAX)).ok, true);
});
test("recusa custo, fornecedor, fiscal, pessoal e credencial", () => {
  for (const t of ["o custo é 10", "fornecedor X", "NCM 8409", "CNPJ 12", "mande para a@b.com", "chave sk-or-v1-abcdefghijk", "token sbp_abcdef123"]) assert.equal(limparResumo(t).ok, false, t);
});
function fake(produto: boolean, falha = false) {
  const gravadas: Record<string, unknown>[] = [];
  const admin: any = { from: (t: string) => t === "produtos"
    ? { select: () => ({ eq: () => ({ eq: () => ({ limit: async () => ({ data: produto ? [{ id: "p1" }] : [] }) }) }) }) }
    : { insert: async (v: Record<string, unknown>) => { if (falha) return { error: "x" }; gravadas.push(v); return { error: null }; } } };
  return { admin, gravadas };
}
test("grava só o resumo, com origem gateway_mcp e a chave", async () => {
  const { admin, gravadas } = fake(true);
  const r: any = await registrarResumo(admin, "L1", "K1", { resumo: "Verifiquei o CI000016", sku: "CI000016" });
  assert.equal(r.ok, true); assert.deepEqual([gravadas[0].loja_id, gravadas[0].mcp_chave_id, gravadas[0].origem, gravadas[0].tipo, gravadas[0].produto_id], ["L1", "K1", "gateway_mcp", "resumo", "p1"]);
});
test("produto inexistente e falha de gravação devolvem erro, sem gravar", async () => {
  const a = fake(false); assert.ok((await registrarResumo(a.admin, "L1", null, { resumo: "ok", sku: "X" }) as any).erro); assert.equal(a.gravadas.length, 0);
  const b = fake(true, true); assert.ok((await registrarResumo(b.admin, "L1", null, { resumo: "ok" }) as any).erro);
});
