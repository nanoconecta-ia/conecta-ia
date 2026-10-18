import { test } from "node:test";
import assert from "node:assert/strict";
import { MENSAGENS_ERRO, textoParaFala } from "./voz.ts";

test("textoParaFala tira links, marcação e emoji; limita o tamanho", () => {
  assert.equal(textoParaFala("**Olá!** Veja https://x.com/abc?y=1 agora 🚗"), "Olá! Veja link agora");
  assert.equal(textoParaFala("- item um\n- item dois"), "item um item dois");
  assert.equal(textoParaFala("a".repeat(3000)).length, 1200);
  assert.equal(textoParaFala("   "), "");
});

test("mensagens de erro do microfone estão em português e 'aborted' é silencioso", () => {
  assert.match(MENSAGENS_ERRO["not-allowed"], /microfone/i); assert.equal(MENSAGENS_ERRO.aborted, "");
});
