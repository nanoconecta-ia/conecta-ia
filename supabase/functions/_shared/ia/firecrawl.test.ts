import { test } from "node:test";
import assert from "node:assert/strict";
import { chaveFirecrawlValida, configFirecrawlDaLoja, provedorFirecrawl, testarFirecrawl, URL_FIRECRAWL } from "./firecrawl.ts";
import { escolherProvedorBusca } from "./provedor_busca.ts";
import { BuscaErro } from "./busca.ts";

const CHAVE = "fc-0123456789abcdef0123456789abcdef";
const resp = (status: number, corpo: unknown, tipo = "application/json") =>
  (async () => new Response(JSON.stringify(corpo), { status, headers: { "content-type": tipo } })) as typeof fetch;

test("formato da chave: só fc-... e sem espaços", () => {
  assert.equal(chaveFirecrawlValida(CHAVE), true);
  for (const x of ["", "sk-abc", "fc-curta", "fc-0123456789abcdef 0123456789", undefined, 12]) assert.equal(chaveFirecrawlValida(x), false);
});

test("imagens: POST https oficial com Bearer, sem redirecionar; descarta http, rede interna, duplicada e sem página de origem", async () => {
  let chamadas = 0;
  const f = (async (u: string | URL | Request, o?: RequestInit) => {
    chamadas++;
    assert.equal(String(u), URL_FIRECRAWL);
    assert.equal(o?.method, "POST");
    assert.equal(o?.redirect, "error");
    assert.equal(new Headers(o?.headers).get("Authorization"), "Bearer " + CHAVE);
    const b = JSON.parse(String(o?.body));
    assert.deepEqual(b.sources, [{ type: "images" }]);
    assert.equal(b.country, "BR");
    assert.match(b.query, /bomba/);
    return new Response(JSON.stringify({ success: true, data: { images: [
      { title: "Bomba real", imageUrl: "https://loja.example/a.png", url: "https://loja.example/produto" },
      { title: "duplicada", imageUrl: "https://loja.example/a.png", url: "https://loja.example/produto" },
      { title: "insegura", imageUrl: "http://loja.example/b.png", url: "https://loja.example/produto" },
      { title: "interna", imageUrl: "https://localhost/c.png", url: "https://loja.example/produto" },
      { title: "sem origem", imageUrl: "https://loja.example/d.png" },
      { title: "segunda", imageUrl: "https://outra.example/e.jpg", url: "https://outra.example/p" },
    ] } }), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  const out = await provedorFirecrawl({ chave: CHAVE }, f).imagens("bomba agua HR k2500", 5);
  assert.equal(chamadas, 1);
  assert.deepEqual(out.map((x) => x.url), ["https://loja.example/a.png", "https://outra.example/e.jpg"]);
  assert.equal(out[0].pagina, "https://loja.example/produto");
  assert.equal(out[0].miniatura, null);
});

test("tecnico: resumo curto, fonte pelo host, sem URL insegura; dado de resposta com caracteres de controle é limpo", async () => {
  const out = await provedorFirecrawl({ chave: CHAVE }, resp(200, { success: true, data: { web: [
    { title: "Catálogo\u0000", url: "https://fabricante.example/cat", description: "Referências\na conferir" },
    { title: "x", url: "javascript:alert(1)", description: "x" },
  ] } })).tecnico("bomba agua hr");
  assert.deepEqual(out, [{ titulo: "Catálogo", pagina: "https://fabricante.example/cat", resumo: "Referências a conferir", fonte: "fabricante.example" }]);
});

test("consulta com custo, fornecedor ou dado fiscal é recusada ANTES de chamar o Firecrawl", async () => {
  let chamou = false;
  const f = (async () => { chamou = true; return new Response("{}"); }) as typeof fetch;
  await assert.rejects(provedorFirecrawl({ chave: CHAVE }, f).tecnico("bomba agua preço de compra fornecedor"), (e) => e instanceof BuscaErro && e.motivo === "recusada");
  assert.equal(chamou, false);
});

test("limite mensal: esgotado não chama o Firecrawl; cada busca desconta e registra uso", async () => {
  let chamadas = 0, usos = 0;
  const f = (async () => { chamadas++; return new Response(JSON.stringify({ success: true, data: { web: [] } }), { status: 200, headers: { "content-type": "application/json" } }); }) as typeof fetch;
  const cfg = { chave: CHAVE, restante: 1, registrarUso: async (n: number) => { usos += n; } };
  const p = provedorFirecrawl(cfg, f);
  await p.tecnico("bomba agua hr");
  assert.equal(chamadas, 1); assert.equal(usos, 1); assert.equal(cfg.restante, 0);
  await assert.rejects(p.tecnico("bomba agua hr"), (e) => e instanceof BuscaErro && e.motivo === "limite");
  assert.equal(chamadas, 1);
});

test("falha ao registrar uso não derruba a pesquisa", async () => {
  const cfg = { chave: CHAVE, registrarUso: async () => { throw new Error("banco fora"); } };
  const out = await provedorFirecrawl(cfg, resp(200, { success: true, data: { web: [{ title: "a", url: "https://x.example/a", description: "b" }] } })).tecnico("bomba agua");
  assert.equal(out.length, 1);
});

test("erros do provedor viram motivos claros e nunca vazam a chave", async () => {
  for (const [status, motivo] of [[401, "credencial_invalida"], [402, "limite"], [429, "limite"], [500, "erro_provedor"]] as const) {
    await assert.rejects(provedorFirecrawl({ chave: CHAVE }, resp(status, { error: "x " + CHAVE })).tecnico("bomba agua"),
      (e) => e instanceof BuscaErro && e.motivo === motivo && !e.message.includes(CHAVE));
  }
  await assert.rejects(provedorFirecrawl({ chave: CHAVE }, resp(200, "<html>", "text/html")).tecnico("bomba agua"), (e) => e instanceof BuscaErro && e.motivo === "erro_provedor");
  await assert.rejects(provedorFirecrawl({ chave: CHAVE }, resp(200, { success: false })).tecnico("bomba agua"), (e) => e instanceof BuscaErro);
  await assert.rejects(provedorFirecrawl({ chave: "sk-errada" }, resp(200, {})).tecnico("bomba agua"), (e) => e instanceof BuscaErro && e.motivo === "credencial_invalida");
});

test("testarFirecrawl devolve ok/erro legível", async () => {
  assert.deepEqual(await testarFirecrawl(CHAVE, resp(200, { success: true, data: { web: [] } })), { ok: true });
  const r = await testarFirecrawl(CHAVE, resp(401, {}));
  assert.equal(r.ok, false);
});

test("prioridade do provedor: SearXNG do servidor > Firecrawl da loja > Google", () => {
  const sx = { baseUrl: "https://busca.mobis.example", token: "token-de-teste-longo" };
  assert.equal(escolherProvedorBusca({ searxng: sx, firecrawl: { chave: CHAVE }, buscaImagem: { chave: "g".repeat(12), cx: "cx-123456" } })?.id, "searxng-privado");
  assert.equal(escolherProvedorBusca({ firecrawl: { chave: CHAVE }, buscaImagem: { chave: "g".repeat(12), cx: "cx-123456" } })?.id, "firecrawl");
  assert.equal(escolherProvedorBusca({}), null);
});

test("configFirecrawlDaLoja: sem chave, com erro ou chave corrompida desliga só a pesquisa", async () => {
  const dec = async (c: string) => c.replace(/^cif:/, "");
  assert.equal(await configFirecrawlDaLoja(async () => ({ data: [], error: null }), "L", dec), null);
  assert.equal(await configFirecrawlDaLoja(async () => ({ data: null, error: { message: "x" } }), "L", dec), null);
  assert.equal(await configFirecrawlDaLoja(async () => ({ data: [{ chave_cifrada: "cif:lixo", limite_mensal: 10, buscas_mes: 0 }], error: null }), "L", dec), null);
  assert.equal(await configFirecrawlDaLoja(async () => { throw new Error("rede"); }, "L", dec), null);
  const chamadas: string[] = [];
  const cfg = await configFirecrawlDaLoja(async (fn) => { chamadas.push(fn); return { data: fn === "busca_firecrawl_ler" ? [{ chave_cifrada: "cif:" + CHAVE, limite_mensal: 300, buscas_mes: 299 }] : null, error: null }; }, "L", dec);
  assert.equal(cfg?.chave, CHAVE); assert.equal(cfg?.restante, 1);
  await cfg!.registrarUso!(1);
  assert.deepEqual(chamadas, ["busca_firecrawl_ler", "busca_firecrawl_registrar"]);
});
