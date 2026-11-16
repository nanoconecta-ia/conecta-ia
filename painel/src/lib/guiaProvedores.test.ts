import test from "node:test";
import assert from "node:assert/strict";
import { GUIAS } from "./guiaProvedores.ts";

test("todo endereço do guia é https público, sem usuário, porta nem segredo", () => {
  for (const g of Object.values(GUIAS)) {
    for (const u of [g.onde, g.doc].filter((x): x is string => !!x)) {
      const url = new URL(u);
      assert.equal(url.protocol, "https:", u);
      assert.ok(!url.username && !url.password && !url.port && !url.search, u);
    }
  }
});

test("cada guia tem passos, formato da chave e a chave do mapa igual ao id", () => {
  for (const [k, g] of Object.entries(GUIAS)) {
    assert.equal(k, g.id);
    assert.ok(g.passos.length >= 3 && g.formato.length > 5 && g.empresa.length > 2, k);
  }
});

test("os provedores da tela têm guia, e nenhuma logo foi inventada", () => {
  for (const id of ["claude", "gemini", "openai", "compativel_openai", "openrouter_free", "firecrawl"]) assert.ok(GUIAS[id], id);
  for (const g of Object.values(GUIAS)) assert.equal(g.logo, undefined);
});
