import { test } from "node:test";
import assert from "node:assert/strict";
import { PRE_AJUSTES, REGRAS_DO_AGENTE, PASSOS_CONECTOR, enderecoValido } from "./meuAgente.ts";

test("há um pré-ajuste de qualidade e um econômico, com modelo definido", () => {
  assert.deepEqual(PRE_AJUSTES.map((p) => p.id), ["qualidade", "economico"]);
  assert.ok(PRE_AJUSTES.every((p) => p.modelo.length > 3));
});
test("regras: leitura, nunca apagar e aprovação do lojista", () => {
  const t = REGRAS_DO_AGENTE.join(" ");
  assert.match(t, /nunca apaga nota fiscal/i); assert.match(t, /aprovar/i); assert.match(t, /parar o cadastro automático/i);
});
test("passos do conector não pedem chave de API do provedor", () => {
  assert.doesNotMatch(PASSOS_CONECTOR.join(" "), /chave de api/i);
});
test("endereço do gateway", () => {
  assert.ok(enderecoValido("https://abc.supabase.co/functions/v1/conecta-gateway"));
  assert.ok(!enderecoValido("http://abc.supabase.co/functions/v1/conecta-gateway"));
});
