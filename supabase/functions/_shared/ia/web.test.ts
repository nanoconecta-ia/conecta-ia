import { test } from "node:test";
import assert from "node:assert/strict";
import { buscarWeb, htmlParaTexto, lerPagina, urlLeituraSegura } from "./web.ts";
import { IaErro } from "./tipos.ts";

const html = (corpo: string, tipo = "text/html; charset=utf-8", status = 200) => new Response(corpo, { status, headers: { "content-type": tipo } });

test("urlLeituraSegura: só https público; querystring pode, usuário/porta/IP/interno não", () => {
  assert.equal(urlLeituraSegura("https://catalogo.exemplo.com.br/peca?id=1"), true);
  for (const ruim of ["http://a.com/x", "https://localhost/x", "https://127.0.0.1/x", "https://10.0.0.5/x", "https://a.com:8443/x", "https://u:p@a.com/x", "https://intranet", "https://srv.local/x", "javascript:alert(1)", "não é url"]) {
    assert.equal(urlLeituraSegura(ruim), false, ruim);
  }
});

test("htmlParaTexto: tira script, estilo e comentário e mantém o texto", () => {
  const r = htmlParaTexto("<html><head><title> Embreagem viscosa </title><style>.a{}</style></head><body><!-- x --><script>roubar()</script><p>Peça &amp; código</p><div>OEM 123</div></body></html>");
  assert.equal(r.titulo, "Embreagem viscosa");
  assert.ok(r.texto.includes("Peça & código") && r.texto.includes("OEM 123"));
  assert.ok(!r.texto.includes("roubar") && !r.texto.includes(".a{}"));
});

test("lerPagina: devolve texto com URL final e data; limita o tamanho do texto", async () => {
  const f = (async () => html("<p>" + "a".repeat(20_000) + "</p>")) as unknown as typeof fetch;
  const p = await lerPagina("https://site.com.br/p", f);
  assert.equal(p.url, "https://site.com.br/p"); assert.equal(p.texto.length, 12_000); assert.equal(p.truncado, true); assert.ok(Date.parse(p.lido_em) > 0);
});

test("lerPagina: redirecionamento para endereço interno é recusado", async () => {
  const f = (async () => new Response(null, { status: 302, headers: { location: "https://127.0.0.1/admin" } })) as unknown as typeof fetch;
  await assert.rejects(lerPagina("https://site.com.br/p", f), (e: unknown) => e instanceof IaErro && e.status === 400);
});

test("lerPagina: redirecionamentos em excesso, PDF, login e tamanho excessivo viram erro claro", async () => {
  const laco = (async () => new Response(null, { status: 302, headers: { location: "https://site.com.br/p" } })) as unknown as typeof fetch;
  await assert.rejects(lerPagina("https://site.com.br/p", laco), (e: unknown) => e instanceof IaErro && e.status === 502);
  await assert.rejects(lerPagina("https://site.com.br/a.pdf", (async () => html("%PDF", "application/pdf")) as unknown as typeof fetch), (e: unknown) => e instanceof IaErro && e.status === 415);
  await assert.rejects(lerPagina("https://site.com.br/x", (async () => html("", "text/html", 403)) as unknown as typeof fetch), (e: unknown) => e instanceof IaErro && e.status === 403 && /login/.test(e.message));
  await assert.rejects(lerPagina("https://site.com.br/x", (async () => html("x".repeat(1_200_000))) as unknown as typeof fetch), (e: unknown) => e instanceof IaErro && e.status === 413);
  await assert.rejects(lerPagina("http://site.com.br/x", (async () => html("")) as unknown as typeof fetch), (e: unknown) => e instanceof IaErro && e.status === 400);
});

test("buscarWeb: monta a consulta sem searchType, filtra links inseguros e não vaza a chave nos erros", async () => {
  let vista = "";
  const f = (async (u: string) => { vista = u; return new Response(JSON.stringify({ items: [
    { title: "Mahle SHR", link: "https://mahle.com/x", snippet: "Embreagem   viscosa" }, { title: "interno", link: "https://10.0.0.1/x" }, { title: "http", link: "http://a.com/x" },
  ] }), { status: 200 }); }) as unknown as typeof fetch;
  const r = await buscarWeb("k", "cx", "embreagem viscosa SHR", f);
  assert.equal(r.length, 1); assert.equal(r[0].trecho, "Embreagem viscosa");
  const u = new URL(vista); assert.equal(u.searchParams.get("searchType"), null); assert.equal(u.searchParams.get("cx"), "cx");
  for (const [st, esperado] of [[401, 401], [429, 429], [500, 502]] as const) {
    await assert.rejects(buscarWeb("segredo-123", "cx", "q", (async () => new Response("segredo-123", { status: st })) as unknown as typeof fetch), (e: unknown) => e instanceof IaErro && e.status === esperado && !e.message.includes("segredo-123"));
  }
});
