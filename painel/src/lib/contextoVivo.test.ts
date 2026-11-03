import { test } from "node:test";
import assert from "node:assert/strict";
import { publicarSelecao, type RpcContexto } from "./contextoVivo.ts";

test("1 produto = abrir; N = selecionar; 0 = limpar; versão avança", async () => {
  const chamadas: Record<string, unknown>[] = [];
  const rpc: RpcContexto = async (a) => { chamadas.push(a); return { data: { ok: true, versao: chamadas.length }, error: null }; };
  const est = { versao: 0 };
  await publicarSelecao(rpc, "L", ["p1"], est, () => "e1"); await publicarSelecao(rpc, "L", ["p1", "p2"], est, () => "e2"); await publicarSelecao(rpc, "L", [], est, () => "e3");
  assert.deepEqual(chamadas.map((c) => [c.p_acao, c.p_ativo, c.p_versao_base]), [["produto.aberto", "p1", 0], ["produto.selecionado", null, 1], ["selecao.limpa", null, 2]]);
  assert.equal(est.versao, 3);
});
test("conflito e expiração: refaz com a versão do servidor", async () => {
  let n = 0;
  const rpc: RpcContexto = async (a) => (++n === 1 ? { data: { ok: false, erro: "contexto_expirado", versao: 0 }, error: null } : { data: { ok: true, versao: (a.p_versao_base as number) + 1 }, error: null });
  const est = { versao: 7 }; const r = await publicarSelecao(rpc, "L", ["p1"], est, () => "e"); assert.deepEqual(r, { ok: true }); assert.equal(est.versao, 1);
});
test("erro de regra não repete; falha de rede é reportada", async () => {
  let n = 0;
  const r1 = await publicarSelecao(async () => { n++; return { data: { ok: false, erro: "produto_fora_da_loja" }, error: null }; }, "L", ["x"], { versao: 0 });
  assert.deepEqual(r1, { ok: false, erro: "produto_fora_da_loja" }); assert.equal(n, 1);
  assert.deepEqual(await publicarSelecao(async () => ({ data: null, error: { message: "x" } }), "L", ["x"], { versao: 0 }), { ok: false, erro: "falha_de_rede" });
});
