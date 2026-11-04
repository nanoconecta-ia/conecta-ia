import { test } from "node:test";
import assert from "node:assert/strict";
import { categoriaDoStatus, linhaLog, novoRequestId, requestIdValido } from "./correlacao.ts";

test("request_id: formato estável e único", () => {
  const a = novoRequestId(); const b = novoRequestId();
  assert.ok(requestIdValido(a)); assert.notEqual(a, b);
  assert.equal(requestIdValido("x"), false);
});
test("categoria de erro: 429 limite, 502 indisponível, 504 tempo, 401 configuração, sucesso nulo", () => {
  assert.equal(categoriaDoStatus(200), null);
  assert.equal(categoriaDoStatus(429), "limite");
  assert.equal(categoriaDoStatus(502), "indisponivel");
  assert.equal(categoriaDoStatus(504), "tempo_esgotado");
  assert.equal(categoriaDoStatus(401), "configuracao");
  assert.equal(categoriaDoStatus(503), "nao_configurado");
  assert.equal(categoriaDoStatus(400), "entrada");
  assert.equal(categoriaDoStatus(500), "outro");
});
test("linha de log: uma linha JSON, sem campos de conteúdo", () => {
  const l = linhaLog({ origem: "chat", request_id: "req_aaaaaaaaaaaaaaaaaaaa", status: 429, latencia_ms: 12, categoria: "limite" });
  assert.equal(l.includes("\n"), false);
  const o = JSON.parse(l); assert.equal(o.evento, "nano_requisicao"); assert.equal(o.categoria, "limite");
  for (const proibido of ["texto", "resposta", "chave", "token", "authorization"]) assert.equal(proibido in o, false);
});
