import test from "node:test";
import assert from "node:assert/strict";
import { destinoPainel, entradaAdministrativa, lojaMobisPorHost, urlLojaPublica, urlProdutoPublico } from "./lojaHost.ts";

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
  assert.equal(destinoPainel(PAGES, "/conecta-ia/", ""), null); // abrir a loja sem hash nunca pode invocar o painel
});

test("vitrine, aplicação e produto público ficam na entrada da loja", () => {
  for (const h of ["#/loja/mobis", "#/a/disco-de-freio", "#/p/mobis/CI000016", "#/demo/vitrine"]) assert.equal(destinoPainel(PAGES, "/conecta-ia/", h), null, h);
});

test("não redireciona conecta.html, domínio de cliente, localhost nem caminho desconhecido", () => {
  assert.equal(destinoPainel(PAGES, "/conecta-ia/conecta.html", "#/integracoes"), null);
  assert.equal(destinoPainel("www.mobisautopecas.com.br", "/", "#/integracoes"), "/conecta.html#/integracoes");
  assert.equal(destinoPainel("localhost", "/", "#/integracoes"), null);
  assert.equal(destinoPainel(PAGES, "/outro/", "#/integracoes"), null);
});


test("raiz pública nunca é substituída pelo painel em ambos os domínios", () => {
  for (const host of ["www.mobisautopecas.com.br", "mobisautopecas.com.br"]) {
    for (const h of ["", "#", "#/","#/loja/mobis", "#/a/aplicacao-aprovada", "#/p/mobis/CI003696"]) {
      assert.equal(destinoPainel(host, "/", h), null, host + h);
    }
  }
  assert.equal(destinoPainel("mobisautopecas.com.br", "/index.html", "#/fila"), "/conecta.html#/fila");
});

test("abrir loja pelo Conecta.IA usa entrada pública separada, nunca hash interno do painel", () => {
  assert.equal(urlLojaPublica("mobis", "https://www.mobisautopecas.com.br/conecta.html#/fila"), "https://www.mobisautopecas.com.br/");
  assert.equal(urlLojaPublica("outra-loja", "https://nanoconecta-ia.github.io/conecta-ia/conecta.html#/fila"), "https://nanoconecta-ia.github.io/conecta-ia/#/loja/outra-loja");
});

test("ficha publicada tem endereço da vitrine e nunca o caminho conecta.html", () => {
  assert.equal(urlProdutoPublico("mobis", "CI003696", "https://www.mobisautopecas.com.br/conecta.html#/catalogo-aplicacao"),
    "https://www.mobisautopecas.com.br/#/p/mobis/CI003696");
});
