import { test } from "node:test";
import assert from "node:assert/strict";
import { configSearxngPorLoja, provedorSearxng, validarConfigSearxng } from "./searxng.ts";
import { escolherProvedorBusca } from "./provedor_busca.ts";
import { BuscaErro } from "./busca.ts";

const loja = "0a000000-0000-4000-8000-000000000001";
const outra = "0a000000-0000-4000-8000-000000000002";
const config = { baseUrl: "https://busca.mobis.example", token: "super-segredo-apenas-fixture" };
const resposta = (status: number, r: unknown, tipo = "application/json") =>
  (async () => new Response(JSON.stringify(r), { status, headers: { "content-type": tipo } })) as typeof fetch;

test("sem allowlist ou sem token nao ativa provedor para outra loja", () => {
  const env: Record<string, string> = { SEARXNG_BASE_URL: config.baseUrl, SEARXNG_BEARER_TOKEN: config.token, SEARXNG_LOJAS_PERMITIDAS: loja };
  assert.equal(configSearxngPorLoja((n) => env[n], outra), null);
  assert.deepEqual(configSearxngPorLoja((n) => env[n], loja), config);
  delete env.SEARXNG_BEARER_TOKEN;
  assert.equal(configSearxngPorLoja((n) => env[n], loja), null);
  assert.equal(configSearxngPorLoja(() => undefined, loja), null);
});
test("bloqueia destino privado, HTTP e credenciais na URL", () => {
  for (const url of ["http://busca.example", "https://localhost", "https://127.0.0.1", "https://intra.local", "https://user:pass@busca.example", "https://busca.example/path", "https://busca.example/?token=1"]) {
    assert.throws(() => validarConfigSearxng({ baseUrl: url, token: config.token }), BuscaErro);
  }
});
test("SearXNG recebe POST JSON privado; nao repassa chave no endereco nem em logs", async () => {
  let called = 0;
  const fake = (async (u: string | URL | Request, o?: RequestInit) => {
    called++;
    assert.equal(String(u), "https://busca.mobis.example/search");
    assert.equal(o?.method, "POST");
    assert.equal(o?.redirect, "error");
    assert.equal(new Headers(o?.headers).get("Authorization"), "Bearer " + config.token);
    assert.equal(new URLSearchParams(o?.body as URLSearchParams).get("categories"), "images");
    assert.equal(new URLSearchParams(o?.body as URLSearchParams).get("format"), "json");
    return new Response(JSON.stringify({ results: [
      { title: "bomba real", img_src: "https://fabricante.example/foto.png", url: "https://fabricante.example/produto", thumbnail_src: "https://fabricante.example/mini.jpg" },
      { title: "duplicada", img_src: "https://fabricante.example/foto.png", url: "https://fabricante.example/produto" },
      { title: "insegura", img_src: "http://fabricante.example/img.png", url: "https://fabricante.example/produto" },
      { title: "interno", img_src: "https://localhost/1.png", url: "https://fabricante.example/produto" },
      { title: "sem origem", img_src: "https://fabricante.example/2.jpg" },
      { title: "sem licenca confirmada", img_src: "https://fabricante.example/3.jpg", url: "https://fabricante.example/3", thumbnail_src: "data:image/jpeg;base64,abc" },
    ] }), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  const out = await provedorSearxng(config, fake).imagens("bomba agua HR 2009", 2);
  assert.equal(called, 1);
  assert.equal(out.length, 2);
  assert.equal(out[0].pagina, "https://fabricante.example/produto");
  assert.equal(out[1].miniatura, null);
});
test("retorna pesquisa tecnica com pagina de fonte, sem validar aplicacao", async () => {
  let categoria = "";
  const f = (async (_u: string | URL | Request, o?: RequestInit) => {
    categoria = new URLSearchParams(o?.body as URLSearchParams).get("categories") ?? "";
    return new Response(JSON.stringify({ results: [{ title: "OEM", url: "https://fabricante.example/catalogo", content: "Referencias a conferir" }] }), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  const out = await provedorSearxng(config, f).tecnico("filtro 1234");
  assert.equal(categoria, "general");
  assert.deepEqual(out, [{ titulo: "OEM", pagina: "https://fabricante.example/catalogo", resumo: "Referencias a conferir", fonte: "fabricante.example" }]);
});
test("sem resultados e HTTP de API: erro explicito, sem dados inventados", async () => {
  assert.deepEqual(await provedorSearxng(config, resposta(200, { results: [] })).imagens("pistao motor"), []);
  for (const [status, motivo] of [[401, "credencial_invalida"], [403, "api_indisponivel"], [429, "limite"], [502, "erro_provedor"]] as const) {
    const e = await provedorSearxng(config, resposta(status, {})).imagens("pistao").catch(x => x) as BuscaErro;
    assert.equal(e.motivo, motivo);
  }
});
test("HTML, JSON invalido e retorno muito grande: resposta recusada", async () => {
  for (const f of [
    resposta(200, { results: [] }, "text/html"),
    (async () => new Response("nao JSON", { headers: { "content-type": "application/json" } })) as typeof fetch,
    (async () => new Response("x".repeat(310_000), { headers: { "content-type": "application/json" } })) as typeof fetch,
  ]) {
    const e = await provedorSearxng(config, f).imagens("filtro diesel").catch(x => x) as BuscaErro;
    assert.equal(e.motivo, "erro_provedor");
  }
});
test("rede caida, timeout e consulta com dado sigiloso", async () => {
  const erro = (async () => { throw new Error("network"); }) as typeof fetch;
  const lento = (async () => { throw new DOMException("The operation timed out", "TimeoutError"); }) as typeof fetch;
  assert.equal(((await provedorSearxng(config, erro).imagens("filtro diesel").catch(x => x)) as BuscaErro).motivo, "erro_provedor");
  assert.equal(((await provedorSearxng(config, lento).imagens("filtro diesel").catch(x => x)) as BuscaErro).motivo, "timeout");
  const seguranca = await provedorSearxng(config, resposta(200, { results: [] })).imagens("custo fornecedor xyz").catch(x => x) as BuscaErro;
  assert.equal(seguranca.motivo, "recusada");
});
test("nao cria segundo contrato; preserva Google legado e falta de provedor", () => {
  assert.equal(escolherProvedorBusca({}), null);
  assert.equal(escolherProvedorBusca({ buscaImagem: { chave: 'x', cx: 'y' } })?.id, 'google-legado');
  assert.equal(escolherProvedorBusca({ searxng: config, buscaImagem: { chave: 'x', cx: 'y' } })?.id, 'searxng-privado');
});
