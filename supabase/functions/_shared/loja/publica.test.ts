import { test } from "node:test";
import assert from "node:assert/strict";
import { anoNoIntervalo, linkWhatsapp, montarVitrine, normalizarHost, opcoesVeiculo, produtosDoVeiculo, SLUG_RE, textoSimples } from "./publica.ts";

test("normalizarHost: minúsculas, sem porta nem ponto final; recusa lixo", () => {
  assert.equal(normalizarHost("WWW.MobisAutoParts.com.br:443"), "www.mobisautoparts.com.br");
  assert.equal(normalizarHost("loja.exemplo.com.br."), "loja.exemplo.com.br");
  for (const ruim of ["", "localhost", "a b.com", "-x.com", "x..com", "http://x.com", "x.com/caminho", 5, null, "a".repeat(300) + ".com"]) assert.equal(normalizarHost(ruim), null, String(ruim));
});

test("slug: só minúsculas, números e hífen", () => {
  assert.ok(SLUG_RE.test("mobis") && SLUG_RE.test("loja-2"));
  for (const r of ["", "M", "a", "Mobis", "a_b", "../x", "a".repeat(64)]) assert.ok(!SLUG_RE.test(r), r);
});

test("textoSimples tira HTML e limita o tamanho", () => {
  assert.equal(textoSimples("<p>APLICAÇÃO: <b>Hyundai</b> HR&nbsp;2.5</p>"), "APLICAÇÃO: Hyundai HR 2.5");
  assert.equal(textoSimples("<p> </p>"), null); assert.equal(textoSimples(null), null);
  assert.equal(textoSimples("x".repeat(500))!.length, 240);
});

test("linkWhatsapp só com número brasileiro válido", () => {
  assert.match(linkWhatsapp("(11) 91234-5678", "Junta", "80692") ?? "", /^https:\/\/wa\.me\/5511912345678\?text=/);
  assert.match(linkWhatsapp("5511912345678", "Junta", "80692") ?? "", /^https:\/\/wa\.me\/5511912345678/);
  assert.equal(linkWhatsapp("123", "x", "y"), null); assert.equal(linkWhatsapp(null, "x", "y"), null);
});

test("montarVitrine: só campos públicos, sem custo; incompletos ficam de fora", () => {
  const linhas: any[] = [
    { nome: "Jogo de juntas", sku: "80692", preco: "900.000000", estoque: "0.00", marca: null, descricao_curta: "<p>Para HR</p>", sincronizado_em: "2026-10-18T01:00:00Z", precoCusto: 469, fornecedor: "X", bling_id: "123" },
    { nome: "Radiador", sku: null, preco: 291, estoque: 1, marca: null, descricao_curta: null },
    { nome: null, sku: "9", preco: 1, estoque: 1, marca: null, descricao_curta: null },
    { nome: "Motor", sku: "CI003696", preco: 18900, estoque: 1, marca: "Trim Go", descricao_curta: null },
  ];
  const v = montarVitrine(linhas, "11912345678");
  assert.deepEqual(v.map((p) => p.sku), ["80692", "CI003696"]);
  assert.equal(v[0].preco, 900); assert.equal(v[0].em_estoque, false); assert.equal(v[0].descricao, "Para HR"); assert.equal(v[1].em_estoque, true);
  const json = JSON.stringify(v);
  for (const proibido of ["precoCusto", "fornecedor", "bling_id", "469", "custo"]) assert.ok(!json.includes(proibido), proibido);
});

test("anoNoIntervalo: aberto nos extremos; sem limite nenhum não confirma", () => {
  assert.ok(anoNoIntervalo(2015, 2013, null) && anoNoIntervalo(2013, 2013, 2016) && anoNoIntervalo(2016, 2013, 2016) && anoNoIntervalo(2010, null, 2012));
  assert.ok(!anoNoIntervalo(2012, 2013, null) && !anoNoIntervalo(2017, 2013, 2016) && !anoNoIntervalo(2020, null, null));
});

test("produtosDoVeiculo: combina modelo, motor e ano; sem filtro devolve todos", () => {
  const a = [
    { produto_id: "p1", modelo: "HR", motorizacao: "2.5 16V", ano_inicial: 2013, ano_final: null },
    { produto_id: "p2", modelo: "HR", motorizacao: "2.5 8V", ano_inicial: 2005, ano_final: 2012 },
    { produto_id: "p3", modelo: "Bongo", motorizacao: "2.5 16V", ano_inicial: 2013, ano_final: null },
  ];
  assert.deepEqual([...produtosDoVeiculo(a, {})].sort(), ["p1", "p2", "p3"]);
  assert.deepEqual([...produtosDoVeiculo(a, { modelo: "HR" })].sort(), ["p1", "p2"]);
  assert.deepEqual([...produtosDoVeiculo(a, { modelo: "HR", motor: "2.5 16V", ano: 2015 })], ["p1"]);
  assert.deepEqual([...produtosDoVeiculo(a, { modelo: "HR", ano: 2010 })], ["p2"]);
  assert.equal(produtosDoVeiculo(a, { modelo: "Hilux" }).size, 0);
  assert.equal(opcoesVeiculo([...a, a[0]]).length, 3);
});
