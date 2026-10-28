// Fonte única: capacidades.ts → capacidades.windows.json → SQL da migração. Falha se qualquer um ficar para trás.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CAPACIDADES_LOCAIS } from "../../../supabase/functions/_shared/exec_local/capacidades.ts";
import { sqlModelos } from "../gerar_modelos_sql.mjs";

const json = JSON.parse(readFileSync(new URL("./capacidades.windows.json", import.meta.url), "utf8")).capacidades;
test("capacidades.windows.json reflete capacidades.ts (windows, consulta, ativa)", () => {
  const esperado = CAPACIDADES_LOCAIS.filter((c) => c.executor === "windows" && c.camada === "consulta" && c.estado === "ativa")
    .map((c) => ({ id: c.id, modelo: c.modelo, timeoutMs: c.timeoutMs, parametros: Object.fromEntries(Object.entries(c.parametros).map(([k, re]) => [k, re.source])) }));
  assert.deepEqual(json, esperado);
});
test("a migração contém exatamente o SQL gerado dos modelos autorizados", () => {
  const mig = readFileSync(new URL("../../../supabase/migrations/20261029000001_exec_local_fila.sql", import.meta.url), "utf8");
  assert.ok(mig.includes(sqlModelos(json)), "exec_local_modelos na migração está diferente de capacidades.ts: rode scripts/exec-local/gerar_modelos_sql.mjs");
});
test("capacidades de escrita ou desligadas nunca entram na lista do agente nem do banco", () => {
  for (const c of json) assert.ok(!/reiniciar|criar|alterar|remover|apagar/.test(c.id));
  assert.ok(!json.some((c) => c.id === "windows.servico.reiniciar"));
});
