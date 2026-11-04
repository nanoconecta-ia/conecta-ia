import { test } from "node:test";
import assert from "node:assert/strict";
import { montarDiagnostico } from "./estado.ts";

const prov = [
  { provedor: "gemini", ativa: false, modelo: null, principal: false, failover: false, limite_mensal_tokens: null, tokens_mes: 0, ultimo_uso_em: null },
  { provedor: "openrouter_free", ativa: true, modelo: "openrouter/free", principal: false, failover: false, limite_mensal_tokens: 50000, tokens_mes: 50241, ultimo_uso_em: "2026-11-04T10:00:00Z" },
];
const turnos = [
  { criada_em: "2026-11-04T10:00:00Z", metadados: { request_id: "req_aaaaaaaaaaaaaaaaaaaa", provedor: "openrouter_free", http_status: 429, latencia_ms: 800, desfecho: "falhou", chave: "SEGREDO" } },
  { criada_em: "2026-11-04T09:00:00Z", metadados: { provedor: "openrouter_free", http_status: 200, latencia_ms: 4000, desfecho: "ok" } },
  { criada_em: "2026-11-03T09:00:00Z", metadados: null },
];

test("diagnóstico: provedor ativo, modo, limite atingido, categorias e latência", () => {
  const d = montarDiagnostico(prov, turnos, new Date("2026-11-04T11:00:00Z"));
  assert.deepEqual(d.provedores_ativos, ["openrouter_free"]);
  assert.equal(d.provedores[1].modo_gratuito, "manual");
  assert.equal(d.provedores[1].limite_atingido, true);
  assert.equal(d.contagem_por_categoria.limite, 1);
  assert.deepEqual(d.latencia_ms, { p50: 800, max: 4000, amostras: 2 });
  assert.equal(d.ultimos_turnos[0].request_id, "req_aaaaaaaaaaaaaaaaaaaa");
  assert.equal(d.ultimos_turnos[2].http_status, null);
});
test("diagnóstico nunca repassa campos fora da lista (segredo, texto)", () => {
  const s = JSON.stringify(montarDiagnostico(prov, turnos));
  assert.equal(s.includes("SEGREDO"), false);
});
