import { test } from "node:test";
import assert from "node:assert/strict";
import { EXECUTORES_PADRAO, executarAprovada, type PortasExecucao, type Reivindicacao } from "./executor.ts";

const reiv = (ferramenta = "conecta.propose_banner"): Reivindicacao => ({ ok: true, ferramenta, alvos: [{ tabela: "banners" }], depois: { titulo: "Promo" }, loja_id: "L1" });
function portas(r: Reivindicacao | { ok: false; motivo: string }) {
  const concluidas: { id: string; ok: boolean; resultado: unknown }[] = []; let consumos = 0;
  const p: PortasExecucao = { consumir: async () => { consumos++; return r; }, concluir: async (id, ok, resultado) => { concluidas.push({ id, ok, resultado }); } };
  return { p, concluidas, consumos: () => consumos };
}

test("executor: por padrão não há executor — aprovada, mas nada é executado e fica 'falhou' com motivo claro", async () => {
  assert.deepEqual(Object.keys(EXECUTORES_PADRAO), []);
  const { p, concluidas } = portas(reiv());
  assert.deepEqual(await executarAprovada("a1", "h", p), { executada: false, motivo: "sem_executor" });
  assert.equal(concluidas[0].ok, false);
});
test("executor: com executor registrado, recebe só loja/alvos/conteúdo aprovados e o resultado é gravado", async () => {
  const { p, concluidas } = portas(reiv());
  let recebido: Record<string, unknown> = {};
  const r = await executarAprovada("a1", "h", p, { "conecta.propose_banner": async (a) => { recebido = a as never; return { publicado: true }; } });
  assert.deepEqual(r, { executada: true, resultado: { publicado: true } });
  assert.deepEqual(Object.keys(recebido).sort(), ["alvos", "depois", "loja_id"]);
  assert.deepEqual(concluidas[0], { id: "a1", ok: true, resultado: { publicado: true } });
});
test("executor: reivindicação negada (já executando, versão diferente, vencida, recusada) NÃO executa nada", async () => {
  for (const motivo of ["estado_executando", "versao_diferente", "expirada", "estado_recusada", "estado_substituida", "inexistente"]) {
    const { p, concluidas } = portas({ ok: false, motivo });
    let chamou = false;
    const r = await executarAprovada("a1", "h", p, { "conecta.propose_banner": async () => { chamou = true; } });
    assert.deepEqual(r, { executada: false, motivo }); assert.equal(chamou, false); assert.equal(concluidas.length, 0);
  }
});
test("executor: falha vira 'falhou' sem vazar o erro e sem repetir sozinho", async () => {
  const { p, concluidas, consumos } = portas(reiv());
  let tentativas = 0;
  const r = await executarAprovada("a1", "h", p, { "conecta.propose_banner": async () => { tentativas++; throw new Error("senha do banco: x"); } });
  assert.deepEqual(r, { executada: false, motivo: "falhou" });
  assert.equal(tentativas, 1); assert.equal(consumos(), 1);
  assert.equal(JSON.stringify(concluidas[0]).includes("senha"), false);
});
test("executor: ferramenta com nome herdado do protótipo (constructor, __proto__) não vira executor", async () => {
  for (const f of ["constructor", "__proto__", "toString"]) {
    const { p } = portas(reiv(f));
    assert.deepEqual(await executarAprovada("a1", "h", p), { executada: false, motivo: "sem_executor" });
  }
});
test("executor: nenhum executor do Bling está registrado por padrão", () => {
  assert.equal(Object.keys(EXECUTORES_PADRAO).filter((k) => /bling/i.test(k)).length, 0);
});
