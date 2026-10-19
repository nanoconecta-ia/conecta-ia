import { test } from "node:test";
import assert from "node:assert/strict";
import { PROMPT_PADRAO } from "./prompts.ts";

const texto = Array.isArray(PROMPT_PADRAO) ? PROMPT_PADRAO.join("\n") : String(PROMPT_PADRAO);

test("o prompt do agente traz as diretrizes do Bling: confirmado, limites e como ler uma negativa", () => {
  assert.match(texto, /8g\. Bling \(API v3\)/);
  assert.match(texto, /bling-referencia-do-conector\.md/);
  assert.match(texto, /leia de volta/i);
  assert.match(texto, /8h\. Limites hoje/);
  assert.match(texto, /tags/);
  assert.match(texto, /ambiente de permissões/);
  assert.match(texto, /backup/i);
});

test("o prompt continua proibindo escrita direta e invenção (as regras antigas não foram afrouxadas)", () => {
  assert.match(texto, /Nunca invente código OEM/);
  assert.match(texto, /não grava no Bling/);
});
