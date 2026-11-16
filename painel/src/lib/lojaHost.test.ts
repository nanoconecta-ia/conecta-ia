import test from "node:test";
import assert from "node:assert/strict";
import { destinoPainel, entradaAdministrativa, lojaMobisPorHost } from "./lojaHost.ts";

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

const PAGES = "nanoconecta-ia.github.io";
test("rota do painel aberta pela entrada da loja vai para conecta.html, mantendo a rota e a busca", () => {
  assert.equal(destinoPainel(PAGES, "/conecta-ia/", "#/integracoes"), "/conecta-ia/conecta.html#/integracoes");
  assert.equal(destinoPainel(PAGES, "/conecta-ia/index.html", "#/estudio", "?v=1"), "/conecta-ia/conecta.html?v=1#/estudio");
  assert.equal(destinoPainel(PAGES, "/conecta-ia/", ""), "/conecta-ia/conecta.html");
});

test("vitrine, aplicação e produto público ficam na entrada da loja", () => {
  for (const h of ["#/loja/mobis", "#/a/disco-de-freio", "#/p/mobis/CI000016", "#/demo/vitrine"]) assert.equal(destinoPainel(PAGES, "/conecta-ia/", h), null, h);
});

test("não redireciona conecta.html, domínio de cliente, localhost nem caminho desconhecido", () => {
  assert.equal(destinoPainel(PAGES, "/conecta-ia/conecta.html", "#/integracoes"), null);
  assert.equal(destinoPainel("www.mobisautopecas.com.br", "/", "#/integracoes"), null);
  assert.equal(destinoPainel("localhost", "/", "#/integracoes"), null);
  assert.equal(destinoPainel(PAGES, "/outro/", "#/integracoes"), null);
});
