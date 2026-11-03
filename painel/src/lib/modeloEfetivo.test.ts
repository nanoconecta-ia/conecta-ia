import { test } from "node:test";
import assert from "node:assert/strict";
import { identificarModeloEfetivo } from "./modeloEfetivo.ts";

test("mostra modelo que realmente concluiu o turno", () => {
  assert.deepEqual(identificarModeloEfetivo({ provedor: "gemini", modelo: "gemini-3.6-flash", desfecho: "ok", completa: true, http_status: 200 }),
    { rotulo: "Gemini · gemini-3.6-flash", contingencia: false });
  assert.deepEqual(identificarModeloEfetivo({ provedor: "gemini", provedor_efetivo: "openrouter-free", modelo: "openrouter/free",
    desfecho: "contingencia_publica", completa: true, http_status: 200 }),
    { rotulo: "OpenRouter Free · openrouter/free", contingencia: true });
});
test("não declara on-line uma chave, erro, simulação ou resposta parcial", () => {
  for (const m of [
    { provedor: "gemini", modelo: "gemini-3.6-flash" },
    { provedor: "gemini", modelo: "gemini-3.6-flash", desfecho: "falhou" },
    { provedor: "gemini", modelo: "gemini-3.6-flash", desfecho: "ok", completa: false },
    { provedor: "gemini", modelo: "gemini-3.6-flash", desfecho: "ok", simulado: true },
    { provedor: "gemini", modelo: "gemini-3.6-flash", desfecho: "ok", http_status: 429 },
    { provedor: "gemini", modelo: "gemini-3.6-flash", desfecho: "contingencia_publica" },
    { provedor: "compativel_openai", modelo: "test\nforjado", desfecho: "ok" },
    { provedor: "desconhecido", modelo: "model", desfecho: "ok" },
  ]) assert.equal(identificarModeloEfetivo(m), null);
  assert.equal(identificarModeloEfetivo(null), null);
});

test("troca automática para o gratuito é reconhecida como contingência, com o modelo que de fato respondeu", () => {
  const m = identificarModeloEfetivo({ ia: true, provedor: "openrouter_free", desfecho: "contingencia_automatica", provedor_efetivo: "openrouter-free", modelo: "openrouter/free-modelo", completa: true });
  assert.deepEqual(m, { rotulo: "OpenRouter Free · openrouter/free-modelo", contingencia: true });
  // sem a prova do provedor efetivo, não vale
  assert.equal(identificarModeloEfetivo({ ia: true, provedor: "gemini", desfecho: "contingencia_automatica", modelo: "x" }), null);
});
test("escolha manual do gratuito aparece como OpenRouter Free, sem marcar contingência", () => {
  assert.deepEqual(identificarModeloEfetivo({ ia: true, provedor: "openrouter_free", desfecho: "ok", provedor_efetivo: "openrouter-free", modelo: "openrouter/free-modelo", completa: true }), { rotulo: "OpenRouter Free · openrouter/free-modelo", contingencia: false });
});
