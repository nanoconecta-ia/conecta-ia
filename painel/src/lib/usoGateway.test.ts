import { test } from "node:test";
import assert from "node:assert/strict";
import { agregarUso } from "./usoGateway.ts";

test("agrega chamadas por dispositivo, separa recusas e guarda a última ferramenta", () => {
  const m = agregarUso([
    { acao: "gateway.ok", quando: "2026-11-14T10:00:00Z", depois: { dispositivo_id: "d1", ferramenta: "conecta.list_products" } },
    { acao: "gateway.ok", quando: "2026-11-14T11:00:00Z", depois: { dispositivo_id: "d1", ferramenta: "conecta.propose_code" } },
    { acao: "gateway.negado", quando: "2026-11-14T09:00:00Z", depois: { dispositivo_id: "d1", ferramenta: "conecta.x" } },
    { acao: "gateway.invalido", quando: "2026-11-14T08:00:00Z", depois: { dispositivo_id: "d2", ferramenta: "conecta.y" } },
    { acao: "assistente.consulta", quando: "2026-11-14T12:00:00Z", depois: { dispositivo_id: "d1" } },
    { acao: "gateway.ok", quando: "2026-11-14T12:00:00Z", depois: null },
  ]);
  assert.deepEqual(m.get("d1"), { ok: 2, negado: 1, invalido: 0, erro: 0, ultima: "2026-11-14T11:00:00Z", ferramenta: "conecta.propose_code" });
  assert.equal(m.get("d2")?.invalido, 1);
  assert.equal(m.size, 2);
});
test("sem eventos, nenhum dispositivo aparece", () => { assert.equal(agregarUso([]).size, 0); });
