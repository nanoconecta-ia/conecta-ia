import { test } from "node:test";
import assert from "node:assert/strict";
import { CANAIS, cruzamentoConfere, direitosConfirmados, escolherPrincipal, podePublicar, podeSerPrincipal, produtosSemImagem, rotuloPublico, validarCandidata, validarParaCanal, type ContextoProduto, type Imagem } from "./regras.ts";
import { chaveArmazenamento, gerarVariantes, ProcessadorMock, VARIANTES, type PortaImagem } from "./variantes.ts";

const L = "aaaaaaaa-0000-0000-0000-00000000000a", P = "c0000000-0000-0000-0000-000000000001", I = "e0000000-0000-0000-0000-000000000001";
const ctx: ContextoProduto = { sku: "80692", gtin: "7891252806921", codigosOem: ["OEM-123"], codigosFabricante: ["SB-9"], aplicacoesAprovadas: 1 };
const img = (o: Partial<Imagem> = {}): Imagem => ({
  id: I, produto_id: P, url: "https://cdn.loja.exemplo/a.jpg", tipo: "real", origem: "foto da loja", licenca_tipo: "propria", url_original: null,
  cruzamento_tipo: null, cruzamento_valor: null, confianca: 0.9, aprovada: true, principal: false, removida_em: null,
  direitos_confirmados_em: null, largura_px: 1000, altura_px: 1000, fundo_branco: true, alt_texto: null, ...o,
});

test("direitos: própria/licenciada valem; fornecedor/fabricante/web exigem confirmação registrada; sem tipo = desconhecido", () => {
  assert.ok(direitosConfirmados({ licenca_tipo: "propria", direitos_confirmados_em: null }));
  assert.ok(direitosConfirmados({ licenca_tipo: "licenciada", direitos_confirmados_em: null }));
  for (const t of ["fornecedor", "fabricante", "publica_web"] as const) {
    assert.ok(!direitosConfirmados({ licenca_tipo: t, direitos_confirmados_em: null }), t);
    assert.ok(direitosConfirmados({ licenca_tipo: t, direitos_confirmados_em: "2026-10-19T00:00:00Z" }), t);
  }
  assert.ok(!direitosConfirmados({ licenca_tipo: null, direitos_confirmados_em: "2026-10-19T00:00:00Z" }));
});

test("cruzamento: só prova identidade se bate com sku/ean/oem/fabricante; similar e substituto nunca provam", () => {
  assert.ok(cruzamentoConfere({ cruzamento_tipo: "sku", cruzamento_valor: " 80692 " }, ctx));
  assert.ok(cruzamentoConfere({ cruzamento_tipo: "ean", cruzamento_valor: "7891252806921" }, ctx));
  assert.ok(cruzamentoConfere({ cruzamento_tipo: "oem", cruzamento_valor: "oem-123" }, ctx));
  assert.ok(cruzamentoConfere({ cruzamento_tipo: "fabricante", cruzamento_valor: "SB-9" }, ctx));
  assert.ok(!cruzamentoConfere({ cruzamento_tipo: "sku", cruzamento_valor: "OUTRO" }, ctx));
  assert.ok(!cruzamentoConfere({ cruzamento_tipo: "ean", cruzamento_valor: "7891252806921" }, { ...ctx, gtin: null }));
  assert.ok(!cruzamentoConfere({ cruzamento_tipo: "similar", cruzamento_valor: "80692" }, ctx));
  assert.ok(!cruzamentoConfere({ cruzamento_tipo: "sku", cruzamento_valor: "" }, ctx));
});

test("validarCandidata: foto real passa; ilustrativa sem cruzamento é bloqueada; cruzamento errado é bloqueado", () => {
  assert.ok(validarCandidata(img(), ctx).ok);
  const sem = validarCandidata(img({ tipo: "ilustrativa" }), ctx);
  assert.ok(!sem.ok); assert.match(sem.bloqueios.join(), /cruzamento/);
  assert.ok(validarCandidata(img({ tipo: "ilustrativa", cruzamento_tipo: "sku", cruzamento_valor: "80692" }), ctx).ok);
  const errado = validarCandidata(img({ tipo: "ilustrativa", cruzamento_tipo: "sku", cruzamento_valor: "99999" }), ctx);
  assert.ok(!errado.ok); assert.match(errado.bloqueios.join(), /não confere/);
});

test("validarCandidata: similar vira aviso como secundária e bloqueio como principal; sem aplicação aprovada avisa", () => {
  const s = img({ tipo: "ilustrativa", cruzamento_tipo: "similar", cruzamento_valor: "80692" });
  assert.ok(validarCandidata(s, ctx).ok && validarCandidata(s, ctx).avisos.length > 0);
  assert.ok(!validarCandidata(s, ctx, { comoPrincipal: true }).ok);
  const semApl = validarCandidata(img({ tipo: "ilustrativa", cruzamento_tipo: "sku", cruzamento_valor: "80692" }), { ...ctx, aplicacoesAprovadas: 0 });
  assert.ok(semApl.ok && semApl.avisos.some((a) => /aplicação/.test(a)));
});

test("validarCandidata: URL de terceiros servida, http, sem origem e IA como principal são bloqueados", () => {
  const terc = "https://fornecedor.exemplo/foto.jpg";
  assert.ok(!validarCandidata(img({ url: terc, url_original: terc }), ctx).ok);
  assert.ok(!validarCandidata(img({ url: "http://x.exemplo/a.jpg" }), ctx).ok);
  assert.ok(!validarCandidata(img({ origem: null, url_original: null }), ctx).ok);
  assert.ok(!validarCandidata(img({ tipo: "gerada_ia", cruzamento_tipo: "sku", cruzamento_valor: "80692" }), ctx, { comoPrincipal: true }).ok);
  assert.ok(validarCandidata(img({ largura_px: null, altura_px: null }), ctx).manuais.length === 1);
});

test("podePublicar: sem direitos, não aprovada, retirada ou servindo URL de terceiros => não publica", () => {
  assert.ok(podePublicar(img()).ok);
  assert.ok(!podePublicar(img({ licenca_tipo: "publica_web", url_original: "https://web.exemplo/p" })).ok);
  assert.ok(podePublicar(img({ licenca_tipo: "publica_web", url_original: "https://web.exemplo/p", direitos_confirmados_em: "2026-10-19T00:00:00Z" })).ok);
  assert.ok(!podePublicar(img({ aprovada: false })).ok);
  assert.ok(!podePublicar(img({ removida_em: "2026-10-19T00:00:00Z" })).ok);
  assert.ok(!podePublicar(img({ licenca_tipo: null })).ok);
  assert.ok(!podePublicar(img({ url: "https://x.exemplo/a", url_original: "https://x.exemplo/a" })).ok);
});

test("rótulos e principal: não real é rotulada; IA nunca é principal; real publicável é preferida", () => {
  assert.equal(rotuloPublico({ tipo: "real" }), null);
  assert.match(rotuloPublico({ tipo: "ilustrativa" })!, /ilustrativa/i);
  assert.match(rotuloPublico({ tipo: "gerada_ia" })!, /IA/);
  const ia = img({ id: "e0000000-0000-0000-0000-000000000002", tipo: "gerada_ia", largura_px: 4000, altura_px: 4000 });
  const ilus = img({ id: "e0000000-0000-0000-0000-000000000003", tipo: "ilustrativa", licenca_tipo: "licenciada", largura_px: 3000, altura_px: 3000 });
  const real = img({ id: "e0000000-0000-0000-0000-000000000004", largura_px: 800, altura_px: 800 });
  assert.ok(!podeSerPrincipal(ia) || ia.tipo !== "gerada_ia");
  assert.equal(escolherPrincipal([ia, ilus, real])?.id, real.id);
  assert.equal(escolherPrincipal([ia, ilus])?.id, ilus.id);
  assert.equal(escolherPrincipal([ia]), null);
  assert.equal(escolherPrincipal([]), null);
});

test("produtosSemImagem: só imagem publicável conta", () => {
  const P2 = "c0000000-0000-0000-0000-000000000002", P3 = "c0000000-0000-0000-0000-000000000003";
  const imgs = [img(), img({ produto_id: P2, licenca_tipo: "publica_web" }), img({ produto_id: P3, aprovada: false })];
  assert.deepEqual(produtosSemImagem([P, P2, P3], imgs), [P2, P3]);
});

test("validarParaCanal: mínimo por canal, regra do Google marcada NÃO CONFERIDA, fundo branco e marca d'água vão para verificação manual", () => {
  assert.equal(CANAIS.merchant.conferido, false); assert.equal(CANAIS.site.conferido, true);
  const peq = validarParaCanal(img({ largura_px: 90, altura_px: 500 }), "merchant");
  assert.ok(!peq.ok); assert.match(peq.bloqueios.join(), /NÃO CONFERIDA/);
  assert.ok(validarParaCanal(img({ largura_px: 200, altura_px: 200 }), "site").bloqueios.length === 1);
  const medio = validarParaCanal(img({ largura_px: 500, altura_px: 500, fundo_branco: false }), "merchant");
  assert.ok(medio.ok); assert.ok(medio.avisos.length > 0); assert.ok(medio.manuais.some((m) => /fundo branco/.test(m)) && medio.manuais.some((m) => /marca d/.test(m)));
  assert.ok(!validarParaCanal(img({ tipo: "gerada_ia" }), "merchant").ok);
  assert.ok(!validarParaCanal(img({ licenca_tipo: "fornecedor" }), "site").ok);
  assert.ok(validarParaCanal(img({ largura_px: null, altura_px: null }), "site").manuais.length >= 1);
});

test("variantes: chave determinística só com UUIDs; recusa id suspeito", () => {
  const spec = VARIANTES[0];
  assert.equal(chaveArmazenamento(L, P, I, spec, 2), `lojas/${L}/produtos/${P}/${I}/site_lista.v2.webp`);
  assert.equal(chaveArmazenamento(L, P, I, spec, 2), chaveArmazenamento(L, P, I, spec, 2));
  assert.throws(() => chaveArmazenamento("../x", P, I, spec));
  assert.throws(() => chaveArmazenamento(L, P, I, spec, 0));
});

test("gerarVariantes: não processa sem direitos nem sem resolução; nunca amplia; marca como simulado", async () => {
  const porta = new ProcessadorMock();
  const sem = await gerarVariantes(L, img({ licenca_tipo: "publica_web" }), porta, true);
  assert.equal(sem.variantes.length, 0); assert.match(sem.recusa!, /direitos/); assert.equal(porta.chamadas.length, 0);
  const semRes = await gerarVariantes(L, img({ largura_px: null, altura_px: null }), porta, true);
  assert.match(semRes.recusa!, /resolução/); assert.equal(porta.chamadas.length, 0);
  const ok = await gerarVariantes(L, img({ largura_px: 600, altura_px: 500 }), porta, true);
  assert.equal(ok.variantes.length, VARIANTES.length);
  for (const v of ok.variantes) { assert.ok(v.largura <= 600 && v.altura <= 500); assert.equal(v.ampliada, false); assert.equal(v.simulado, true); }
  const merchant = ok.variantes.find((v) => v.spec === "merchant")!;
  assert.ok(merchant.fundoBrancoAplicado);
  const ampliadora: PortaImagem = { processar: async (_u, s) => ({ largura: s.largura, altura: s.altura, bytes: 1, fundoBrancoAplicado: false }) };
  await assert.rejects(gerarVariantes(L, img({ largura_px: 100, altura_px: 100 }), ampliadora, true), /upscaling/);
});
