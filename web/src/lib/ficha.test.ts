import { test } from "node:test";
import assert from "node:assert/strict";
import { deveIndexar, deveIndexarAplicacao, faixaAnos, montarJsonLdAplicacao, montarJsonLdProduto, origemFicha, precoPublicoAutorizado, tituloAplicacao, veiculoRotulo } from "./ficha.ts";
import type { PaginaAplicacao, Produto } from "./tipos.ts";

const base: Produto = {
  id: "11111111-1111-1111-1111-111111111111",
  loja_id: "22222222-2222-2222-2222-222222222222",
  bling_id: "16719530075",
  sku: "CI003696",
  nome: "MOTOR HR/K2500 2.5 16V 13/ D4CB EURO V NOVO PARCIAL C/ CABECOTE - MARCA: TRIM GO",
  preco: 18900,
  estoque: 1,
  situacao: "A",
  categoria: "Motor",
  marca: "TRIM GO",
  gtin: null,
  descricao: null,
  publicado: true,
  sincronizado_em: "2026-11-23T00:00:00Z",
};

test("piloto: ficha pública é informativa e não autoriza preço", () => {
  const loja = { modo_venda: "whatsapp" };
  assert.equal(origemFicha(loja), "catalogo_informativo");
  assert.equal(precoPublicoAutorizado(loja), false);
  // Mesmo com loja em checkout, o piloto ainda não expõe preço (sem flag de oferta por produto).
  assert.equal(precoPublicoAutorizado({ modo_venda: "checkout" }), false);
});

test("JSON-LD informativo não leva Offer nem campos vazios", () => {
  const ld = montarJsonLdProduto({ produto: base, url: "https://x/p", precoAutorizado: false });
  assert.equal(ld.offers, undefined, "catálogo informativo não anuncia preço/estoque");
  assert.equal(ld.gtin, undefined, "GTIN vazio não é inventado");
  assert.equal(ld.image, undefined, "sem imagem, sem campo image");
  assert.equal((ld.brand as { name: string }).name, "TRIM GO");
});

test("JSON-LD com oferta autorizada leva Offer com o preço exibido", () => {
  const ld = montarJsonLdProduto({ produto: base, url: "https://x/p", imagemUrl: "https://x/i.jpg", precoAutorizado: true });
  const offer = ld.offers as { price: number; priceCurrency: string; availability: string };
  assert.equal(offer.price, 18900);
  assert.equal(offer.priceCurrency, "BRL");
  assert.equal(offer.availability, "https://schema.org/InStock");
  assert.equal(ld.image, "https://x/i.jpg");
});

test("noindex enquanto informativo sem aplicação aprovada; indexa quando há aplicação", () => {
  assert.equal(deveIndexar({ precoAutorizado: false, aplicacoesAprovadas: 0 }), false);
  assert.equal(deveIndexar({ precoAutorizado: false, aplicacoesAprovadas: 2 }), true);
  assert.equal(deveIndexar({ precoAutorizado: true, aplicacoesAprovadas: 0 }), true);
});

test("faixaAnos formata sem inventar o que falta", () => {
  assert.equal(faixaAnos({ ano_inicial: 2013, ano_final: 2019 }), "2013–2019");
  assert.equal(faixaAnos({ ano_inicial: 2013, ano_final: 2013 }), "2013");
  assert.equal(faixaAnos({ ano_inicial: 2013, ano_final: null }), "2013+");
  assert.equal(faixaAnos({ ano_inicial: null, ano_final: 2019 }), "até 2019");
  assert.equal(faixaAnos({ ano_inicial: null, ano_final: null }), null);
});

/* ---- Páginas de aplicação (1 SKU → N páginas) ---- */

const paBase: PaginaAplicacao = {
  aplicacao: {
    modelo: "Hyundai HR", motorizacao: "2.5 16V D4CB Euro V", ano_inicial: 2013, ano_final: null,
    fonte: "EPC PartSouq", coletado_em: "2026-11-23T00:00:00Z", confianca: 0.7,
    pagina_slug: "motor-parcial-d4cb-hyundai-hr", pagina_titulo: null, pagina_descricao: null, pagina_indexavel: false,
  },
  produto: { ...base, categoria: "Motor" },
  codigos: [
    { tipo: "oem", valor: "22100-4A701", fonte: "EPC PartSouq", coletado_em: "2026-11-23T00:00:00Z", confianca: 0.8 },
    { tipo: "similar", valor: "XYZ", fonte: null, coletado_em: null, confianca: null },
  ],
  imagem: null,
};

test("veiculoRotulo junta só o que existe", () => {
  assert.equal(veiculoRotulo(paBase.aplicacao), "Hyundai HR 2.5 16V D4CB Euro V 2013+");
  assert.equal(veiculoRotulo({ modelo: "Kia Bongo", motorizacao: null, ano_inicial: null, ano_final: null }), "Kia Bongo");
});

test("tituloAplicacao usa o título definido ou deriva do produto + veículo", () => {
  assert.match(tituloAplicacao(paBase), /^MOTOR HR\/K2500.* — Hyundai HR 2\.5 16V D4CB Euro V 2013\+$/);
  const comTitulo = { ...paBase, aplicacao: { ...paBase.aplicacao, pagina_titulo: "Motor D4CB para Hyundai HR" } };
  assert.equal(tituloAplicacao(comTitulo), "Motor D4CB para Hyundai HR");
});

test("página de aplicação só indexa quando marcada indexável", () => {
  assert.equal(deveIndexarAplicacao(paBase), false);
  assert.equal(deveIndexarAplicacao({ ...paBase, aplicacao: { ...paBase.aplicacao, pagina_indexavel: true } }), true);
});

test("JSON-LD da aplicação leva OEM como mpn, sem preço", () => {
  const ld = montarJsonLdAplicacao({ pa: paBase, url: "https://x/a" });
  assert.deepEqual(ld.mpn, ["22100-4A701"], "só o tipo oem entra como mpn");
  assert.equal(ld.offers, undefined, "página de aplicação é informativa, sem preço");
  assert.equal(ld.sku, "CI003696");
});
