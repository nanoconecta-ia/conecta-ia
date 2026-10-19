import { test } from "node:test";
import assert from "node:assert/strict";
import { esc, jsonSeguro, scriptJsonLd, truncar } from "./escape.ts";
import { disponibilidade, gtinValido, limparMarca, nomePropGtin, precoFmt, produtoIndexavel, type LojaSeo, type ProdutoSeo } from "./dados.ts";
import { baseUrl, skuDoCaminho, urlProduto } from "./url.ts";
import { metadadosProduto, tagsHead } from "./metadados.ts";
import { blocosProduto, jsonLdOrganizacao, jsonLdProduto } from "./jsonld.ts";
import { gerarIndiceSitemap, gerarRobots, gerarSitemap, MAX_URLS_SITEMAP, urlsDoSitemap } from "./sitemap.ts";
import { gerarFeedMerchant, validarProdutoMerchant } from "./feed_merchant.ts";
import { paginasPublicadas, prontidaoMerchantLoja } from "./politicas.ts";
import { paginaPoliticaHtml, paginaProdutoHtml } from "./pagina.ts";
import { responderSeo } from "./rotas.ts";

const politicas = {
  razao_social: "Mobis Auto Peças Ltda", cnpj: "12345678000195", endereco: "Rua A, 1 - São Paulo/SP", telefone: "(11) 91234-5678", email_contato: "contato@mobis.exemplo",
  garantia_legal_dias: 90, arrependimento_dias: 7, garantia_texto: "Garantia legal de 90 dias.", troca_devolucao_texto: "Troca em até 7 dias.\nProduto sem uso.",
  entrega_texto: "Entregamos em todo o Brasil.", privacidade_texto: "Respeitamos a LGPD.", termos_texto: null,
};
const loja = (o: Partial<LojaSeo> = {}): LojaSeo => ({ nome: "Mobis Auto Peças", slug: "mobis", ativa: true, dominio: "www.mobisautoparts.com.br", whatsapp: null, politicas, ...o });
const prod = (o: Partial<ProdutoSeo> = {}): ProdutoSeo => ({
  sku: "80692", nome: "Jogo de Juntas do Motor HR 2.5", descricao: "<p>Para Hyundai HR 2.5 16V</p>", descricao_longa: null, marca: "SABó", gtin: "7891252806921",
  mpn: null, preco: 900, estoque: 3, publicado: true, situacao: "A", atualizado_em: "2026-10-18T10:00:00Z", categoria: "Motor",
  imagens: [{ url: "https://cdn.mobis.exemplo/80692.jpg", principal: true, ordem: 0, tipo: "real", alt_texto: null, largura_px: 1000, altura_px: 1000, fundo_branco: true }], ...o,
});

test("escapes: HTML, XML e JSON-LD não deixam nada escapar da tag", () => {
  assert.equal(esc(`<script>"a" & 'b'</script>`), "&lt;script&gt;&quot;a&quot; &amp; &#39;b&#39;&lt;/script&gt;");
  assert.equal(esc("a\u0000b\u000Bc"), "abc");
  const j = scriptJsonLd({ name: `</script><script>alert(1)</script>`, x: " &" });
  assert.ok(!j.slice(40).includes("</script><script>") && !/<script>alert/.test(j));
  assert.equal((j.match(/<\/script>/g) ?? []).length, 1);
  assert.deepEqual(JSON.parse(jsonSeguro({ a: "<>& " })), { a: "<>& " });
  assert.equal(truncar("uma frase bem comprida de teste", 14), "uma frase bem");
});

test("normalizações: marca sem rótulo, GTIN com dígito verificador, preço e disponibilidade só do real", () => {
  assert.equal(limparMarca("MARCA: TRIM GO"), "TRIM GO"); assert.equal(limparMarca("  "), null); assert.equal(limparMarca("SABó"), "SABó");
  assert.ok(gtinValido("7891252806921")); assert.ok(!gtinValido("7891252806922")); assert.ok(!gtinValido("123")); assert.ok(!gtinValido("abc1252806921"));
  assert.equal(nomePropGtin("7891252806921"), "gtin13");
  assert.equal(precoFmt(900), "900.00"); assert.equal(precoFmt(0), null); assert.equal(precoFmt(null), null);
  assert.equal(disponibilidade(3), "in_stock"); assert.equal(disponibilidade(0), "out_of_stock"); assert.equal(disponibilidade(null), null);
});

test("URLs: domínio ativo vem do servidor; sem domínio => null; SKU do caminho é validado", () => {
  assert.equal(baseUrl("WWW.Mobis.com.br"), "https://www.mobis.com.br"); assert.equal(baseUrl(null), null); assert.equal(baseUrl("http://x.com"), null);
  assert.equal(urlProduto("a.com.br", "CI 001/2"), "https://a.com.br/produto/CI%20001%2F2"); assert.equal(urlProduto(null, "1"), null);
  assert.equal(skuDoCaminho("CI%20001"), "CI 001"); assert.equal(skuDoCaminho("a%2Fb"), null); assert.equal(skuDoCaminho("%E0%A4%A"), null); assert.equal(skuDoCaminho("x".repeat(81)), null);
});

test("metadados: título/descrição reais, canonical absoluto; despublicado ou sem domínio => noindex sem canonical", () => {
  const m = metadadosProduto(loja(), prod());
  assert.ok(m.indexavel); assert.equal(m.canonical, "https://www.mobisautoparts.com.br/produto/80692"); assert.equal(m.description, "Para Hyundai HR 2.5 16V");
  assert.match(m.title, /Jogo de Juntas.*SABó.*Mobis/); assert.ok(m.title.length <= 70); assert.equal(m.og.image, "https://cdn.mobis.exemplo/80692.jpg");
  const h = tagsHead(m);
  assert.match(h, /<link rel="canonical" href="https:\/\/www\.mobisautoparts\.com\.br\/produto\/80692">/); assert.match(h, /index,follow/);
  for (const [l, p] of [[loja(), prod({ publicado: false })], [loja({ dominio: null }), prod()], [loja({ ativa: false }), prod()], [loja(), prod({ situacao: "ausente" })]] as const) {
    const x = metadadosProduto(l, p); assert.equal(x.robots, "noindex,nofollow"); assert.equal(x.canonical, null);
    assert.ok(!/canonical|og:/.test(tagsHead(x)));
  }
  const semDesc = metadadosProduto(loja(), prod({ descricao: null }));
  assert.equal(semDesc.description, null); assert.ok(!/name="description"/.test(tagsHead(semDesc)));
  assert.ok(!/og:image/.test(tagsHead(metadadosProduto(loja(), prod({ imagens: [] })))));
});

test("JSON-LD: Product/Offer só com preço E estoque reais; sem rating/review; GTIN inválido omitido", () => {
  const j = jsonLdProduto(loja(), prod())!;
  assert.equal(j["@type"], "Product"); assert.equal(j.gtin13, "7891252806921");
  const o = j.offers as Record<string, unknown>;
  assert.equal(o.price, "900.00"); assert.equal(o.priceCurrency, "BRL"); assert.equal(o.availability, "https://schema.org/InStock");
  assert.ok(!("aggregateRating" in j) && !("review" in j));
  assert.equal(((jsonLdProduto(loja(), prod({ estoque: 0 }))!.offers) as Record<string, unknown>).availability, "https://schema.org/OutOfStock");
  assert.ok(!("offers" in jsonLdProduto(loja(), prod({ estoque: null }))!)); assert.ok(!("offers" in jsonLdProduto(loja(), prod({ preco: null }))!));
  assert.ok(!("gtin13" in jsonLdProduto(loja(), prod({ gtin: "7891252806922" }))!));
  assert.ok(!("image" in jsonLdProduto(loja(), prod({ imagens: [] }))!)); assert.ok(!("description" in jsonLdProduto(loja(), prod({ descricao: null }))!));
  assert.equal(jsonLdProduto(loja({ dominio: null }), prod()), null); assert.equal(jsonLdProduto(loja(), prod({ publicado: false })), null);
  assert.deepEqual(blocosProduto(loja(), prod()).map((b) => b["@type"]), ["Product", "BreadcrumbList", "Organization"]);
  assert.deepEqual(blocosProduto(loja({ dominio: null }), prod()), []);
  const org = jsonLdOrganizacao(loja())!; assert.equal(org.telephone, "(11) 91234-5678");
  assert.ok(!("telephone" in jsonLdOrganizacao(loja({ politicas: null }))!));
});

test("sitemap: só indexáveis, ordenado, lastmod real, despublicado fora; robots bloqueia tudo sem domínio", () => {
  const ps = [prod({ sku: "B2" }), prod({ sku: "A1" }), prod({ sku: "C3", publicado: false }), prod({ sku: "D4", situacao: "ausente" }), prod({ sku: "A1" }), prod({ sku: null }), prod({ sku: "E5", atualizado_em: "lixo" })];
  const urls = urlsDoSitemap("loja.com.br", ps).map((u) => u.loc);
  assert.deepEqual(urls, ["https://loja.com.br/", "https://loja.com.br/produto/A1", "https://loja.com.br/produto/B2", "https://loja.com.br/produto/E5"]);
  const xml = gerarSitemap("loja.com.br", ps)!;
  assert.match(xml, /<lastmod>2026-10-18<\/lastmod>/); assert.ok(!xml.includes("C3") && !xml.includes("D4")); assert.equal((xml.match(/<lastmod>/g) ?? []).length, 2);
  assert.equal(gerarSitemap(null, ps), null); assert.equal(gerarSitemap("loja.com.br", ps, 2), null); assert.equal(gerarIndiceSitemap("loja.com.br", ps), null);
  assert.ok(gerarSitemap("loja.com.br", [], 1, ["privacidade"])!.includes("/politicas/privacidade"));
  const muitos = Array.from({ length: MAX_URLS_SITEMAP + 5 }, (_, i) => prod({ sku: `S${String(i).padStart(6, "0")}` }));
  assert.ok(gerarIndiceSitemap("loja.com.br", muitos)!.includes("sitemap-2.xml")); assert.ok(gerarSitemap("loja.com.br", muitos, 2) !== null); assert.equal(gerarSitemap("loja.com.br", muitos, 3), null);
  assert.equal(gerarRobots(null), "User-agent: *\nDisallow: /\n");
  assert.match(gerarRobots("loja.com.br"), /Sitemap: https:\/\/loja\.com\.br\/sitemap\.xml/);
});

test("feed Merchant: bloqueia por motivo (sem inventar), inclui o válido, escapa XML, não repete SKU", () => {
  const bom = prod();
  const casos: [string, Partial<ProdutoSeo>, RegExp][] = [
    ["sem preço", { preco: null }, /preço/], ["estoque desconhecido", { estoque: null }, /estoque/], ["sem descrição", { descricao: null }, /descrição/],
    ["sem marca", { marca: null }, /marca/], ["GTIN inválido", { gtin: "7891252806922" }, /GTIN inválido/], ["sem identificador", { gtin: null, mpn: null }, /GTIN válido nem MPN/],
    ["sem imagem", { imagens: [] }, /imagem principal/], ["imagem IA", { imagens: [{ ...bom.imagens[0], tipo: "gerada_ia" }] }, /sintética/],
    ["imagem minúscula", { imagens: [{ ...bom.imagens[0], largura_px: 50, altura_px: 50 }] }, /menor que/], ["despublicado", { publicado: false }, /não publicado/], ["ausente", { situacao: "ausente" }, /inativo/],
  ];
  for (const [nome, o, re] of casos) { const r = validarProdutoMerchant(loja(), prod(o)); assert.ok(!r.ok, nome); assert.match(r.motivos.join(), re, nome); }
  assert.ok(validarProdutoMerchant(loja({ dominio: null }), bom).motivos.some((m) => /domínio/.test(m)));
  assert.ok(validarProdutoMerchant(loja(), prod({ gtin: null, mpn: "SB-9" })).ok);
  const v = validarProdutoMerchant(loja(), bom);
  assert.ok(v.ok); assert.ok(v.avisos.some((a) => /condição/.test(a)) && v.avisos.some((a) => /marca d/.test(a)));
  const f = gerarFeedMerchant(loja(), [prod({ sku: "X<1>", nome: `Peça "A" & <B>` }), prod(), prod(), prod({ sku: "RUIM", preco: null })]);
  assert.deepEqual(f.incluidos, ["X<1>", "80692"]);
  assert.equal(f.bloqueados.length, 2); assert.ok(f.bloqueados.some((b) => b.motivos.includes("SKU duplicado no feed")));
  assert.match(f.xml!, /xmlns:g="http:\/\/base\.google\.com\/ns\/1\.0"/); assert.match(f.xml!, /<g:price>900\.00 BRL<\/g:price>/); assert.match(f.xml!, /<g:availability>in stock<\/g:availability>/);
  assert.match(f.xml!, /<g:id>X&lt;1&gt;<\/g:id>/); assert.ok(!f.xml!.includes("<B>")); assert.ok(!/g:condition|g:identifier_exists/.test(f.xml!));
  assert.equal(gerarFeedMerchant(loja(), [prod({ preco: null })]).xml, null);
  assert.equal(gerarFeedMerchant(loja({ dominio: null }), [bom]).xml, null);
});

test("políticas: só texto preenchido vira página; prontidão da loja lista o que falta", () => {
  assert.deepEqual(paginasPublicadas(politicas).map((p) => p.slug), ["privacidade", "troca-devolucao", "entrega", "garantia", "contato"]);
  assert.deepEqual(paginasPublicadas(null), []);
  assert.ok(prontidaoMerchantLoja(loja()).pronta);
  const p = prontidaoMerchantLoja(loja({ dominio: null, politicas: { ...politicas, privacidade_texto: null, telefone: null, email_contato: null } }));
  assert.ok(!p.pronta); assert.ok(p.faltando.some((x) => /domínio/.test(x)) && p.faltando.some((x) => /privacidade/.test(x)) && p.faltando.some((x) => /contato/.test(x)));
  assert.ok(prontidaoMerchantLoja(loja({ politicas: null })).faltando.includes("políticas aprovadas pelo lojista"));
});

test("páginas HTML: tudo escapado, preço/estoque visíveis, rótulo de imagem não real, sem script executável", () => {
  const html = paginaProdutoHtml(loja(), prod({ nome: `<img src=x onerror=alert(1)>`, descricao: `<b>x</b> "q"`, marca: "A&B" }));
  assert.ok(!html.includes("<img src=x")); assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/); assert.match(html, /Preço: R\$ 900,00/); assert.match(html, /Em estoque/);
  assert.equal((html.match(/<script(?! type="application\/ld\+json")/g) ?? []).length, 0);
  const ilus = paginaProdutoHtml(loja(), prod({ imagens: [{ url: "https://c.exemplo/a.jpg", principal: true, ordem: 0, tipo: "ilustrativa", alt_texto: `a"b`, largura_px: null, altura_px: null, fundo_branco: false }] }));
  assert.match(ilus, /Imagem ilustrativa/); assert.match(ilus, /alt="a&quot;b"/);
  assert.ok(!/Preço/.test(paginaProdutoHtml(loja(), prod({ preco: null })))); assert.ok(!/Em estoque|Indisponível/.test(paginaProdutoHtml(loja(), prod({ estoque: null }))));
  const pol = paginaPoliticaHtml(loja(), "troca-devolucao")!; assert.match(pol, /<p>Troca em até 7 dias\.<\/p>\n<p>Produto sem uso\.<\/p>/);
  assert.equal(paginaPoliticaHtml(loja(), "termos"), null); assert.equal(paginaPoliticaHtml(loja(), "nao-existe"), null);
});

test("rotas: robots/sitemap/feed/produto/política; 404 igual para loja inexistente e inativa; despublicado = 404", () => {
  const ps = [prod(), prod({ sku: "PUB0", publicado: false })];
  assert.equal(responderSeo("/robots.txt", loja(), ps).status, 200);
  assert.match(responderSeo("/sitemap.xml", loja(), ps).corpo, /<urlset/);
  assert.equal(responderSeo("/sitemap.xml", loja({ dominio: null }), ps).status, 409);
  assert.equal(responderSeo("/sitemap-9.xml", loja(), ps).status, 404);
  assert.match(responderSeo("/feed/merchant.xml", loja(), ps).corpo, /<g:id>80692<\/g:id>/);
  assert.equal(responderSeo("/feed/merchant.xml", loja({ dominio: null }), ps).status, 409);
  assert.equal(responderSeo("/feed/merchant.xml", loja(), [prod({ preco: null })]).status, 409);
  const ok = responderSeo("/produto/80692", loja(), ps);
  assert.equal(ok.status, 200); assert.match(ok.cabecalhos["content-security-policy"], /default-src 'none'/); assert.equal(ok.cabecalhos["x-robots-tag"], undefined);
  assert.equal(responderSeo("/produto/PUB0", loja(), ps).status, 404);
  assert.equal(responderSeo("/produto/nao-existe", loja(), ps).status, 404);
  assert.equal(responderSeo("/produto/a%2Fb", loja(), ps).status, 404);
  const previa = responderSeo("/produto/80692", loja({ dominio: null }), ps);
  assert.equal(previa.status, 200); assert.equal(previa.cabecalhos["x-robots-tag"], "noindex"); assert.ok(!/rel="canonical"/.test(previa.corpo));
  assert.equal(responderSeo("/politicas/privacidade", loja(), ps).status, 200); assert.equal(responderSeo("/politicas/termos", loja(), ps).status, 404);
  const a = responderSeo("/robots.txt", null, ps), b = responderSeo("/robots.txt", loja({ ativa: false }), ps);
  assert.equal(a.status, 404); assert.deepEqual(a, b);
  assert.equal(responderSeo("/qualquer", loja(), ps).status, 404);
});

test("produtoIndexavel: exige publicado, ativo, nome e SKU", () => {
  assert.ok(produtoIndexavel(prod()));
  for (const o of [{ publicado: false }, { situacao: "I" }, { nome: " " }, { sku: "" }] as Partial<ProdutoSeo>[]) assert.ok(!produtoIndexavel(prod(o)));
});

test("página do produto: aplicações aprovadas e ficha técnica aparecem escapadas; sem dado aprovado não há bloco", () => {
  const vazio = paginaProdutoHtml(loja(), prod());
  assert.ok(!vazio.includes("Aplicações confirmadas") && !vazio.includes("Ficha técnica"), "sem aplicação nem medida aprovada, nenhum bloco (ausência = não confirmado)");
  const html = paginaProdutoHtml(loja(), prod({
    aplicacoes: [{ montadora: "Marca<A>", modelo: "Util", versao: "BR", periodo_inicio: 2014, periodo_fim: null }, { montadora: "Marca<A>", modelo: "Util2", versao: "BR", periodo_inicio: null, periodo_fim: null }],
    bula: { medidas: [{ nome: "espessura", valor: 1.2, unidade: "mm" }], contraindicacoes: [{ tipo: "montagem", texto: "<b>Não reutilizar</b> parafusos" }] },
  }));
  assert.ok(html.includes("Aplicações confirmadas") && html.includes("2014–em linha") && html.includes("período a confirmar"));
  assert.equal(html.match(/<h3>Marca&lt;A&gt;<\/h3>/g)?.length, 1, "agrupa por montadora, escapado");
  assert.ok(html.includes("espessura: 1.2 mm") && html.includes("&lt;b&gt;Não reutilizar&lt;/b&gt;") && !html.includes("<b>Não"));
});
