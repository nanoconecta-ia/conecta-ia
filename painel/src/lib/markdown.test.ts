import { test } from "node:test";
import assert from "node:assert/strict";
import { inline, markdown, urlSegura } from "./markdown.ts";

test("markdown: negrito, itálico, código e link seguro", () => {
  const r = inline("**forte** e *leve* com `x` e [site](https://exemplo.com/a?b=1)");
  assert.deepEqual(r.map((x) => x.t), ["negrito", "texto", "italico", "texto", "codigo", "texto", "link"]);
  const l = r.at(-1)!; assert.equal(l.t === "link" && l.href, "https://exemplo.com/a?b=1");
});

test("markdown: javascript:, data: e vbscript: nunca viram link", () => {
  for (const u of ["javascript:alert(1)", "JaVaScRiPt:alert(1)", "data:text/html,<script>1</script>", "vbscript:x", " javascript:alert(1)", "//evil.com/x", "file:///etc/passwd"]) {
    assert.equal(urlSegura(u), null, u);
  }
  const r = inline("[clique](javascript:alert(1))");
  assert.ok(r.every((x) => x.t === "texto"));                 // nenhum nó de link
  assert.ok(r.some((x) => x.t === "texto" && x.v === "clique"));
});

test("markdown: HTML embutido é só texto (o React escapa), imagens não existem", () => {
  const b = markdown("<script>alert(1)</script>\n\n![img](https://x.com/a.png)");
  assert.equal(b.length, 2);
  assert.deepEqual(b[0], { t: "p", c: [{ t: "texto", v: "<script>alert(1)</script>" }] });
  assert.ok(JSON.stringify(b[1]).includes("!"));            // o ponto de exclamação segue como texto
  assert.ok(!JSON.stringify(b).includes('"t":"img"'));
});

test("markdown: tabela, listas, cabeçalho, bloco de código e citação", () => {
  const b = markdown("# Título\n\n| SKU | Preço |\n|---|---|\n| 80692 | 10 |\n\n- a\n- b\n\n1. um\n2. dois\n\n```\nlinha <b>\n```\n\n> nota");
  assert.deepEqual(b.map((x) => x.t), ["h", "tabela", "ul", "ol", "codigo", "citacao"]);
  const tab = b[1]; assert.ok(tab.t === "tabela" && tab.cab.length === 2 && tab.linhas.length === 1);
  const cod = b[4]; assert.ok(cod.t === "codigo" && cod.v === "linha <b>");
});

test("markdown: marcadores sem fechamento e texto entre aspas não quebram", () => {
  assert.deepEqual(inline("2 * 3 = 6 e a_b_c"), [{ t: "texto", v: "2 * 3 = 6 e a_b_c" }]);
  assert.deepEqual(inline("**aberto"), [{ t: "texto", v: "**aberto" }]);
});

test("markdown: entrada enorme/aninhada não trava (profundidade limitada)", () => {
  const s = "**" + "[a](https://x.com) ".repeat(500) + "**";
  assert.ok(inline(s).length > 0);
});
