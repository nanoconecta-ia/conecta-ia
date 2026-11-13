import test from "node:test";
import assert from "node:assert/strict";
import { lojaMobisPorHost } from "./lojaHost.ts";

test("dominio principal e www mostram o layout novo Mobis", () => {
  assert.equal(lojaMobisPorHost("mobisautopecas.com.br"), true);
  assert.equal(lojaMobisPorHost("www.mobisautopecas.com.br"), true);
  assert.equal(lojaMobisPorHost("MOBISAUTOPECAS.COM.BR."), true);
});

test("nao interfere na vitrine de outros lojistas e no painel", () => {
  for (const host of [null, "localhost", "nanoconecta-ia.github.io", "outro.com.br", "falso.mobisautopecas.com.br"]) {
    assert.equal(lojaMobisPorHost(host), false, String(host));
  }
});
