import { test } from "node:test";
import assert from "node:assert/strict";
import { criarRunnerWindows } from "./runner_windows.mjs";
import { executar } from "../../supabase/functions/_shared/exec_local/executor.ts";
import { argvPowerShell } from "../../supabase/functions/_shared/exec_local/capacidades.ts";

const falso = new URL("./pwsh_falso.mjs", import.meta.url).pathname;
const runner = criarRunnerWindows({ binario: process.execPath, argsAntes: [falso] });
const ctl = () => new AbortController();

test("executa o argv do despachante sem shell e devolve a saída", async () => {
  const r = await runner.executar("windows", argvPowerShell("Get-CimInstance Win32_OperatingSystem | Select-Object Caption | ConvertTo-Json -Compress"), 5000, ctl().signal);
  assert.equal(JSON.parse(r.saida).Caption, "Windows FICTICIO");
});
test("metacaracteres no comando não viram shell (vão como argumento único)", async () => {
  await assert.rejects(runner.executar("windows", argvPowerShell("Get-Process -Name x; echo PWNED > /tmp/pwned_exec_local"), 5000, ctl().signal).then((r) => { assert.equal(r.saida, '{"Count":1}'); throw new Error("ok"); }), /ok/);
  const { existsSync } = await import("node:fs"); assert.equal(existsSync("/tmp/pwned_exec_local"), false);
});
test("saída é limitada a 64 KB", async () => {
  const r = await runner.executar("windows", argvPowerShell("grande"), 5000, ctl().signal);
  assert.ok(Buffer.byteLength(r.saida) <= 65536 && r.saida.endsWith("…[truncado]") && r.truncada);
});
test("código de saída ≠ 0 vira erro; argv que não é powershell.exe é recusado; executor errado é recusado", async () => {
  await assert.rejects(runner.executar("windows", argvPowerShell("falha"), 5000, ctl().signal), /saida_3/);
  await assert.rejects(runner.executar("windows", ["cmd.exe", "/c", "dir"], 5000, ctl().signal), /argv_inesperado/);
  await assert.rejects(runner.executar("browser", argvPowerShell("x"), 5000, ctl().signal), /runner_so_windows/);
});
test("abort mata o processo filho (revogação/timeout)", async () => {
  const c = ctl(); const t0 = Date.now(); const p = runner.executar("windows", argvPowerShell("dorme"), 30000, c.signal);
  setTimeout(() => c.abort(), 300); await assert.rejects(p, /abortado/); assert.ok(Date.now() - t0 < 5000);
});
test("pelo despachante: capacidade permitida conclui; injeção nunca chega ao runner", async () => {
  const log = []; let chamadas = 0;
  const p = { agora: Date.now, revogada: async () => false, pausada: async () => false, consentimento: async () => null, auditar: async (e) => { log.push(e.resultado); },
    runner: { executar: (...a) => { chamadas++; return runner.executar(...a); } } };
  const S = { sessao_id: "s", loja_id: "l", dispositivo_id: "d", agente: "qualquer", escopos: ["consulta"], hosts_permitidos: [] };
  const v = await executar(S, { tarefa_id: "t1", capacidade: "windows.sistema.inventario", params: {} }, p);
  assert.equal(v.estado, "CONCLUIDA"); assert.equal(JSON.parse(v.evidencia.saida).Caption, "Windows FICTICIO"); assert.equal(chamadas, 1);
  const n = await executar(S, { tarefa_id: "t2", capacidade: "windows.processo.existe", params: { nome: "a; calc" } }, p);
  assert.equal(n.estado, "NEGADA"); assert.equal(chamadas, 1);
});

import { cortarUtf8 } from "./runner_windows.mjs";
test("teto de saída em BYTES: multibyte (4 bytes/char) fica ≤ 65536, sem caractere partido, e sinaliza", async () => {
  const r = await runner.executar("windows", argvPowerShell("grande_mb"), 10000, ctl().signal);
  assert.ok(Buffer.byteLength(r.saida) <= 65536, `bytes=${Buffer.byteLength(r.saida)}`); assert.ok(r.truncada); assert.ok(!r.saida.includes("\uFFFD"));
  assert.ok(r.saida.endsWith("…[truncado]")); assert.match(r.saida, /^(😀)+…\[truncado\]$/u);
});
test("cortarUtf8 nunca parte caractere de 2, 3 ou 4 bytes, em qualquer posição de corte", () => {
  for (const ch of ["é", "€", "😀"]) {
    const buf = Buffer.from(ch.repeat(20));
    for (let max = 0; max <= buf.length; max++) {
      const c = cortarUtf8(buf, max); assert.ok(c.length <= max); assert.ok(!c.toString("utf8").includes("\uFFFD"), `${ch} max=${max}`);
      assert.ok(max - c.length < Buffer.byteLength(ch));                 // perde menos de um caractere
    }
  }
});
