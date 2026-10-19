import { test } from "node:test";
import assert from "node:assert/strict";
import { ESTADOS_AGENTE, ROTULO_ESTADO, reduzirEstado, ehEstadoAgente } from "./estadoAgente.ts";

test("estado: são os 12 estados do contrato, cada um com rótulo", () => {
  assert.equal(ESTADOS_AGENTE.length, 12);
  for (const e of ESTADOS_AGENTE) assert.ok(ROTULO_ESTADO[e]);
});

test("estado: o servidor manda; valor desconhecido é ignorado (nada inventado)", () => {
  assert.equal(reduzirEstado("ocioso", { tipo: "servidor", estado: "consultando_ferramentas" }), "consultando_ferramentas");
  assert.equal(reduzirEstado("executando", { tipo: "servidor", estado: "voando" }), "executando");
  assert.equal(reduzirEstado("executando", { tipo: "servidor", estado: 42 }), "executando");
  assert.equal(ehEstadoAgente("bloqueado"), true);
});

test("estado: fim volta a ocioso, mas preserva estado terminal informado pelo servidor", () => {
  assert.equal(reduzirEstado("interpretando", { tipo: "fim" }), "ocioso");
  for (const t of ["concluido", "erro", "bloqueado", "aguardando_aprovacao"] as const) assert.equal(reduzirEstado(t, { tipo: "fim" }), t);
});

test("estado: microfone real liga e desliga escutando sem atropelar outro estado", () => {
  assert.equal(reduzirEstado("ocioso", { tipo: "microfone", ouvindo: true }), "escutando");
  assert.equal(reduzirEstado("escutando", { tipo: "microfone", ouvindo: false }), "ocioso");
  assert.equal(reduzirEstado("executando", { tipo: "microfone", ouvindo: false }), "executando");
});

test("estado: falha de rede vira erro; cancelar vira ocioso", () => {
  assert.equal(reduzirEstado("interpretando", { tipo: "falha_rede" }), "erro");
  assert.equal(reduzirEstado("executando", { tipo: "cancelado" }), "ocioso");
});
