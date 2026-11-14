import { test } from "node:test";
import assert from "node:assert/strict";
import { agregarUso, estadoAgente, maisRecentePorNome, nomeCurto } from "./usoGateway.ts";

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
test("estadoAgente: agindo, conectado e acabando", () => {
  const agora = Date.parse("2026-11-14T12:00:00Z");
  assert.equal(estadoAgente("2026-11-14T20:00:00Z", "2026-11-14T11:59:30Z", agora).situacao, "agindo");
  assert.equal(estadoAgente("2026-11-14T20:00:00Z", "2026-11-14T11:50:00Z", agora).situacao, "conectado");
  assert.equal(estadoAgente("2026-11-14T20:00:00Z", null, agora).situacao, "conectado");
  assert.equal(estadoAgente("2026-11-14T12:30:00Z", "2026-11-14T11:59:30Z", agora).situacao, "acabando");
  assert.equal(estadoAgente("2026-11-14T12:30:00Z", null, agora).restante_min, 30);
});
test("estadoAgente: token vencido = parado, mesmo com janela longa", () => {
  const agora = Date.parse("2026-11-14T12:00:00Z");
  assert.equal(estadoAgente("2026-11-14T20:00:00Z", null, agora, "2026-11-14T11:50:00Z").situacao, "parado");
  assert.equal(estadoAgente("2026-11-14T20:00:00Z", null, agora, "2026-11-14T12:10:00Z").situacao, "conectado");
});
test("maisRecentePorNome mantém uma sessão por agente; nomeCurto tira o parêntese", () => {
  const r = maisRecentePorNome([{ nome: "A", limite_ate: "2026-11-14T10:00:00Z" }, { nome: "A", limite_ate: "2026-11-14T12:00:00Z" }, { nome: "B", limite_ate: "2026-11-14T09:00:00Z" }]);
  assert.equal(r.length, 2);
  assert.equal(r.find((x) => x.nome === "A")?.limite_ate, "2026-11-14T12:00:00Z");
  assert.equal(nomeCurto("Claude Code (desenvolvedor do Conecta.IA)"), "Claude Code");
});

test("resumoFaixa: diz em texto que há agente conectado pelo QR", async () => {
  const { resumoFaixa } = await import("./usoGateway.ts");
  assert.equal(resumoFaixa([], "10 min"), "");
  assert.match(resumoFaixa(["Claude (verificacao Bling)"], "12 min"), /^Agente conectado pelo QR · .+ · 12 min$/);
  assert.equal(resumoFaixa(["A", "B"], null), "2 agentes conectados pelo QR");
});
