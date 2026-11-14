import test from "node:test";
import assert from "node:assert/strict";
import { urlImagemProposta } from "./propostas.ts";

test("urlImagemProposta aceita só https e ignora o resto", () => {
  assert.equal(urlImagemProposta({ imagem_url: "https://exemplo.com/a.jpg" }), "https://exemplo.com/a.jpg");
  assert.equal(urlImagemProposta({ url: "https://exemplo.com/b.png" }), "https://exemplo.com/b.png");
  assert.equal(urlImagemProposta({ url: "http://exemplo.com/b.png" }), null);
  assert.equal(urlImagemProposta({ url: "javascript:alert(1)" }), null);
  assert.equal(urlImagemProposta({ url: "https://x.com/a b" }), null);
  assert.equal(urlImagemProposta(null), null);
  assert.equal(urlImagemProposta({ marca: "X" }), null);
});
