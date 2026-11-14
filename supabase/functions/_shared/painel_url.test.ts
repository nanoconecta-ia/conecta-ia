import { test } from "node:test";
import assert from "node:assert/strict";
import { urlPainel } from "./painel_url.ts";

test("urlPainel: raiz do site vira o arquivo do painel", () => {
  assert.equal(urlPainel("https://www.mobisautopecas.com.br"), "https://www.mobisautopecas.com.br/conecta.html");
  assert.equal(urlPainel("https://www.mobisautopecas.com.br/"), "https://www.mobisautopecas.com.br/conecta.html");
  assert.equal(urlPainel("https://exemplo.github.io/conecta-ia/"), "https://exemplo.github.io/conecta-ia/conecta.html");
});

test("urlPainel: .html informado é mantido", () => {
  assert.equal(urlPainel("https://www.mobisautopecas.com.br/conecta.html"), "https://www.mobisautopecas.com.br/conecta.html");
});

test("urlPainel: recusa query, fragmento e credenciais", () => {
  assert.throws(() => urlPainel("https://x.com.br/?a=1"));
  assert.throws(() => urlPainel("https://x.com.br/#/y"));
  assert.throws(() => urlPainel("https://u:p@x.com.br"));
});
