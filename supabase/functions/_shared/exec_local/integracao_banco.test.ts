// Integração REAL com o esquema aplicado (Postgres local com as migrações): o MESMO código de produção (portas_supabase, runner_db,
// rotas_dispositivo, executor) contra as funções SQL de verdade. Pega incompatibilidade de nome/assinatura entre TS e banco.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { criarPsql } from "../conector/psql_cliente.testutil.ts";
import { sha256Hex } from "../conector/cripto.ts";
import { executar, type Portas, type SessaoLocal } from "./executor.ts";
import { criarRunnerDb } from "./runner_db.ts";
import { dispositivoAtivo, filaDbSupabase } from "./portas_supabase.ts";
import { tratarDispositivo } from "./rotas_dispositivo.ts";
import { argvPowerShell } from "./capacidades.ts";

const BANCO = process.env.CONECTOR_TEST_DB;
const skip = BANCO ? false : "defina CONECTOR_TEST_DB";
const db = BANCO ? criarPsql(BANCO) : (null as never);
const LOJA = "e1e1e1e1-0000-4000-8000-000000000001", OUTRA = "e2e2e2e2-0000-4000-8000-000000000002", USER = "e3e3e3e3-0000-4000-8000-000000000003";
const DISP = "e4e4e4e4-0000-4000-8000-000000000004", NAV = "e5e5e5e5-0000-4000-8000-000000000005";
const TOKEN = "A".repeat(45) + "." + "B".repeat(45);
const INV = "Get-CimInstance Win32_OperatingSystem | Select-Object Caption,Version,OSArchitecture,TotalVisibleMemorySize | ConvertTo-Json -Compress";

async function preparar() {
  const [t, s] = TOKEN.split("."); const hT = await sha256Hex(t), hS = await sha256Hex(s);
  db.sql(`insert into public.lojas (id, nome, slug) values ('${LOJA}','Loja Int','loja-int-el'),('${OUTRA}','Outra','outra-int-el') on conflict do nothing;
    insert into public.usuarios_loja (loja_id, user_id, papel) values ('${LOJA}','${USER}','lojista') on conflict do nothing;
    insert into public.pair_dispositivos (id, loja_id, usuario_id, nome, tipo, capacidades, ultimo_uso_em) values
      ('${DISP}','${LOJA}','${USER}','PC int','agente_desktop','{windows.sistema.inventario,windows.ambiente.versoes}', now()),
      ('${NAV}','${LOJA}','${USER}','Nav int','navegador','{}', now()) on conflict do nothing;
    insert into public.pair_sessoes (loja_id, usuario_id, dispositivo_id, token_hash, sal_hash, escopos, expira_em, limite_ate)
      values ('${LOJA}','${USER}','${DISP}','${hT}','${hS}','{produtos:ler}', now()+interval '1 hour', now()+interval '1 day') on conflict do nothing`);
}
after(() => { if (BANCO) db.sql(`delete from public.exec_local_tarefas where loja_id in ('${LOJA}','${OUTRA}'); delete from public.lojas where id in ('${LOJA}','${OUTRA}')`); });

/** "agente": usa as ROTAS reais (tratarDispositivo) com o rpc do banco; devolve a saída combinada. */
function ligarAgente(saida: (argv: string[]) => string) {
  const rpc = async (fn: "exec_local_puxar" | "exec_local_resultado", args: Record<string, unknown>) => { const r = await db.rpc(fn, args); if (r.error) throw new Error(r.error.message); return r.data; };
  const h = { Authorization: `Bearer ${TOKEN}` }; const vistos: unknown[] = [];
  const id = setInterval(async () => {
    const p = await tratarDispositivo({ metodo: "POST", caminho: "/dispositivo/proximo", authorization: h.Authorization, corpo: "{}" }, { rpc });
    if (p.status !== 200) return; const job = p.corpo as { job_id: string; argv: string[] }; vistos.push(job);
    await tratarDispositivo({ metodo: "POST", caminho: "/dispositivo/resultado", authorization: h.Authorization, corpo: JSON.stringify({ job_id: job.job_id, ok: true, saida: saida(job.argv) }) }, { rpc });
  }, 40);
  return { vistos, parar: () => clearInterval(id) };
}
const sessao = (): SessaoLocal => ({ sessao_id: "k1", loja_id: LOJA, dispositivo_id: DISP, agente: "gemini", escopos: ["consulta"], hosts_permitidos: [] });
const portas = (cap: string, fila = filaDbSupabase(db as never)): Portas & { log: string[] } => { const log: string[] = [];
  return { log, agora: Date.now, revogada: async () => false, pausada: async () => false, consentimento: async () => null,
    auditar: async (e) => { log.push(`${e.capacidade}:${e.resultado}`); }, runner: criarRunnerDb(fila, { loja_id: LOJA, dispositivo_id: DISP, capacidade: cap, agente: "gemini", intervaloMs: 40 }) }; };

test("cadeia real: despachante → runner_db → fila no banco → rotas do agente → resultado, hash e auditoria do banco", { skip }, async () => {
  await preparar(); const ag = ligarAgente(() => '{"Caption":"Windows INT"}');
  try {
    const p = portas("windows.sistema.inventario"); const v = await executar(sessao(), { tarefa_id: "t1", capacidade: "windows.sistema.inventario", params: {} }, p);
    assert.equal(v.estado, "CONCLUIDA", JSON.stringify(v)); if (v.estado !== "CONCLUIDA") return;
    assert.equal(v.evidencia.saida, '{"Caption":"Windows INT"}'); assert.equal(v.evidencia.sha256.length, 64);
    assert.equal(JSON.stringify((ag.vistos[0] as { argv: string[] }).argv), JSON.stringify(argvPowerShell(INV)));          // o agente recebeu exatamente o argv do modelo
    assert.equal(db.sql(`select estado from public.exec_local_tarefas where loja_id='${LOJA}' order by criado_em desc limit 1`), "CONCLUIDA");
    assert.equal(db.sql(`select agente from public.exec_local_tarefas where loja_id='${LOJA}' order by criado_em desc limit 1`), "gemini");
    assert.equal(db.sql(`select saida_sha256 from public.exec_local_tarefas where loja_id='${LOJA}' order by criado_em desc limit 1`), v.evidencia.sha256.length === 64 ? db.sql(`select encode(sha256(convert_to('{"Caption":"Windows INT"}','UTF8')),'hex')`) : "");
    assert.ok(Number(db.sql(`select count(*) from public.auditoria where loja_id='${LOJA}' and acao in ('exec_local.enfileirada','exec_local.concluida')`)) >= 2);
  } finally { ag.parar(); }
});
test("dispositivoAtivo contra o esquema real: acha o agente_desktop vivo; revogado ou parado há > 90 s não conta; navegador nunca", { skip }, async () => {
  await preparar();
  assert.equal((await dispositivoAtivo(db as never, LOJA))?.dispositivo_id, DISP);
  assert.equal(await dispositivoAtivo(db as never, OUTRA), null);
  assert.equal(await dispositivoAtivo(db as never, LOJA, Date.now() + 120_000), null);                      // parado há mais de 90 s
  db.sql(`update public.pair_dispositivos set revogado_em = now() where id = '${DISP}'`);
  assert.equal(await dispositivoAtivo(db as never, LOJA), null);
  db.sql(`update public.pair_dispositivos set revogado_em = null where id = '${DISP}'`);
});
test("o banco recusa o que o despachante deixaria passar: comando fora do modelo, dispositivo não-desktop e capacidade fora da lista", { skip }, async () => {
  await preparar(); const fila = filaDbSupabase(db as never);
  const base = { loja_id: LOJA, dispositivo_id: DISP, capacidade: "windows.sistema.inventario", argv: argvPowerShell(INV), timeout_ms: 5000 };
  await assert.rejects(fila.enfileirar({ ...base, argv: argvPowerShell("Get-ChildItem C:\\ -Recurse") }), /modelo autorizado/);
  await assert.rejects(fila.enfileirar({ ...base, capacidade: "windows.disco.livre" }), /fora da lista/);
  await assert.rejects(fila.enfileirar({ ...base, dispositivo_id: NAV }), /dispositivo inválido/);
  await assert.rejects(fila.enfileirar({ ...base, loja_id: OUTRA }), /dispositivo inválido/);                // outra loja não usa o dispositivo
  assert.equal(await fila.estado(OUTRA, "00000000-0000-4000-8000-000000000000"), null);
});
test("revogação do dispositivo: o agente deixa de puxar (401) e tarefa na fila é cancelada", { skip }, async () => {
  await preparar();
  const fila = filaDbSupabase(db as never);
  const id = await fila.enfileirar({ loja_id: LOJA, dispositivo_id: DISP, capacidade: "windows.sistema.inventario", argv: argvPowerShell(INV), timeout_ms: 5000 });
  db.sql(`update public.pair_dispositivos set revogado_em = now() where id = '${DISP}'`);
  try {
    const rpc = async (fn: "exec_local_puxar" | "exec_local_resultado", a: Record<string, unknown>) => (await db.rpc(fn, a)).data;
    assert.equal((await tratarDispositivo({ metodo: "POST", caminho: "/dispositivo/proximo", authorization: `Bearer ${TOKEN}`, corpo: "{}" }, { rpc })).status, 401);
    assert.equal((await fila.estado(LOJA, id))?.estado, "CANCELADA");
  } finally { db.sql(`update public.pair_dispositivos set revogado_em = null where id = '${DISP}'`); }
});
