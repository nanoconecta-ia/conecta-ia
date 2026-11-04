import test from "node:test";
import assert from "node:assert/strict";
import { calcularCota, diagnosticarFalhaNano, nomeProvedor, type RegistroMedidor } from "./medidorNano.ts";

const groq: RegistroMedidor = {
  provedor: "compativel_openai", ativa: true, principal: false,
  modelo: "openai/gpt-oss-20b", base_url: "https://api.groq.com/openai/v1",
  tokens_mes: 8059, limite_mensal_tokens: 50000, mes_ref: "2026-11-01",
};

test("mostrador distingue consumo e teto mensal configurado", () => {
  const cota = calcularCota(groq, "2026-11");
  assert.equal(cota.estado, "disponivel");
  assert.equal(cota.usados, 8059);
  assert.equal(cota.restante, 41941);
  assert.equal(cota.percentual, 16);
  assert.equal(nomeProvedor(groq), "Groq");
});

test("mostrador bloqueia quando teto local estoura; não confunde com cota externa", () => {
  assert.deepEqual(calcularCota({ ...groq, limite_mensal_tokens: 5000 }, "2026-11"), {
    estado: "bloqueado", usados: 8059, limite: 5000, restante: 0,
    percentual: 100, descricao: "Teto mensal interno atingido",
  });
  assert.equal(diagnosticarFalhaNano(new Error("Limite mensal do provedor atingido.")), "Teto mensal interno atingido");
  assert.match(diagnosticarFalhaNano({ categoria_erro: "limite" }), /origem não confirmada/);
});

test("sem teto interno não quer dizer tokens infinitos ou disponibilidade externa", () => {
  const cota = calcularCota({ ...groq, limite_mensal_tokens: null }, "2026-11");
  assert.equal(cota.estado, "sem_teto");
  assert.equal(cota.percentual, null);
  assert.match(cota.descricao, /interno/);
});

test("se o mês mudar, não apresenta saldo antigo como disponível", () => {
  const cota = calcularCota(groq, "2026-12");
  assert.equal(cota.estado, "desatualizado");
  assert.equal(cota.restante, null);
});

test("chaves desativadas e consumo inválido não aparecem como operacional", () => {
  assert.equal(calcularCota({ ...groq, ativa: false }, "2026-11").estado, "desativado");
  assert.equal(calcularCota({ ...groq, tokens_mes: Number.NaN }, "2026-11").estado, "desconhecido");
});
