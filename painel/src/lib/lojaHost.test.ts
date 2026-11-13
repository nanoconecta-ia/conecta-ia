import test from "node:test";
import assert from "node:assert/strict";
import { entradaAdministrativa, lojaMobisPorHost } from "./lojaHost.ts";

test("dominio principal e www mostram o layout novo Mobis", () => {
  assert.equal(lojaMobisPorHost("mobisautopecas.com.br"), true);
  assert.equal(lojaMobisPorHost("www.mobisautopecas.com.br"), true);
  assert.equal(lojaMobisPorHost("MOBISAUTOPECAS.COM.BR."), true);
});

test("entrada administrativa explícita não toma a raiz pública nem caminhos semelhantes", () => {
  for (const p of ["/conecta.html", "/conecta-ia/conecta.html"]) assert.equal(entradaAdministrativa(p), true);
  for (const p of ["/", "/index.html", "/conecta-ia/", "/falso/conecta.html", "/conecta.html/falso"]) assert.equal(entradaAdministrativa(p), false);
});

test("nao interfere na vitrine de outros lojistas e no painel", () => {
  for (const host of [null, "localhost", "nanoconecta-ia.github.io", "outro.com.br", "falso.mobisautopecas.com.br"]) {
    assert.equal(lojaMobisPorHost(host), false, String(host));
  }
});
