import { test } from "node:test";
import assert from "node:assert/strict";
import { FilaLocal } from "./fila.ts";
import type { Portas, SessaoLocal } from "./executor.ts";

const base = (agente: string, loja = "l1", disp = "d1"): SessaoLocal => ({ sessao_id: `s-${agente}`, loja_id: loja, dispositivo_id: disp, agente, escopos: ["consulta"], hosts_permitidos: [] });
const portas = (): Portas & { log: string[] } => { const log: string[] = [];
  return { log, agora: () => 1, revogada: async () => false, pausada: async () => false, consentimento: async () => null,
    auditar: async (e) => { log.push(`${e.agente}:${e.capacidade}:${e.resultado}`); }, runner: { executar: async () => ({ saida: '{"os":"fake"}' }) } } as never; };

test("ponta a ponta simulada: dois provedores pedem a mesma consulta e recebem evidência equivalente", async () => {
  const p = portas(); const f = new FilaLocal(p); const ev: string[] = [];
  for (const agente of ["claude", "gemini"]) {
    f.enfileirar(base(agente), { tarefa_id: `t-${agente}`, capacidade: "windows.sistema.inventario", params: {} });
    const r = await f.puxarEExecutar("l1", "d1");
    assert.equal(r?.estado, "CONCLUIDA"); if (r?.veredito?.estado === "CONCLUIDA") ev.push(r.veredito.evidencia.sha256);
  }
  assert.equal(ev[0], ev[1]);                                  // mesma ferramenta, mesmo resultado, qualquer provedor
  assert.deepEqual(p.log, ["claude:windows.sistema.inventario:CONCLUIDA", "gemini:windows.sistema.inventario:CONCLUIDA"]);
});
test("executor não puxa tarefa de outra loja nem de outro dispositivo", async () => {
  const f = new FilaLocal(portas());
  f.enfileirar(base("claude", "l2", "d9"), { tarefa_id: "t1", capacidade: "windows.sistema.inventario", params: {} });
  assert.equal(await f.puxarEExecutar("l1", "d1"), null);
  assert.equal(f.estado("t1")?.estado, "NA_FILA");
});
test("idempotency_key não duplica a tarefa", async () => {
  const f = new FilaLocal(portas()); const s = base("claude");
  const a = f.enfileirar(s, { tarefa_id: "t1", capacidade: "windows.sistema.inventario", params: {}, idempotency_key: "k" });
  const b = f.enfileirar(s, { tarefa_id: "t2", capacidade: "windows.sistema.inventario", params: {}, idempotency_key: "k" });
  assert.deepEqual([a, b], [{ ok: true, tarefa_id: "t1" }, { ok: true, tarefa_id: "t1" }]);
  assert.equal(f.estado("t2"), undefined);
});
test("capacidade desconhecida não entra; tentativa fora da lista é negada e auditada na execução", async () => {
  const p = portas(); const f = new FilaLocal(p);
  assert.deepEqual(f.enfileirar(base("gpt"), { tarefa_id: "x", capacidade: "powershell.livre", params: {} }), { ok: false, motivo: "capacidade_desconhecida" });
  f.enfileirar(base("gpt"), { tarefa_id: "y", capacidade: "windows.processo.existe", params: { nome: "a; calc" } });
  assert.equal((await f.puxarEExecutar("l1", "d1"))?.estado, "NEGADA");
  assert.deepEqual(p.log, ["gpt:windows.processo.existe:NEGADA"]);
});
