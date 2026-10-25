import { test } from "node:test";
import assert from "node:assert/strict";
import { adicionar, alterarQtd, carregar, linkOrcamento, MAX_ITENS, mensagemOrcamento, numeroDoLink, remover, salvar, totalReferencia } from "./orcamento.ts";

const a = { sku: "CI001", nome: "Bomba de óleo", preco: 100 }, b = { sku: "CI002", nome: "Filtro", preco: 25.5 };

test("adicionar soma a quantidade do mesmo SKU, respeita limites e não passa de 20 itens", () => {
  let l = adicionar([], a); l = adicionar(l, a, 2); assert.equal(l.length, 1); assert.equal(l[0].qtd, 3);
  assert.equal(adicionar(l, a, 500)[0].qtd, 99);
  let cheia = [] as ReturnType<typeof adicionar>;
  for (let i = 0; i < 25; i++) cheia = adicionar(cheia, { sku: `S${i}`, nome: "x", preco: 1 });
  assert.equal(cheia.length, MAX_ITENS);
  assert.equal(alterarQtd(l, "CI001", 0)[0].qtd, 1); assert.equal(alterarQtd(l, "CI001", Number.NaN)[0].qtd, 1);
  assert.deepEqual(remover(l, "CI001"), []);
});

test("total de referência só existe quando todos os itens têm preço", () => {
  const l = adicionar(adicionar([], a, 2), b);
  assert.equal(totalReferencia(l), 225.5);
  assert.equal(totalReferencia(adicionar(l, { sku: "X", nome: "Sem preço", preco: null })), null);
  assert.equal(totalReferencia([]), null);
});

test("mensagem: itens, código, preço de referência, aviso de confirmação; sem total quando falta preço", () => {
  const m = mensagemOrcamento(adicionar(adicionar([], a, 2), b), "ref: vitrine");
  assert.match(m, /1\. 2x Bomba de óleo \(cód\. CI001\)/); assert.match(m, /2\. 1x Filtro/); assert.match(m, /Total de referência: R\$\s?225,50/);
  assert.match(m, /confirmação de preço e estoque/); assert.match(m, /ref: vitrine$/);
  assert.ok(!mensagemOrcamento([{ sku: "X", nome: "N", preco: null, qtd: 1 }]).includes("Total de referência"));
});

test("número vem só de link wa.me com 55; link do orçamento é codificado e some sem número ou sem itens", () => {
  assert.equal(numeroDoLink("https://wa.me/5511999998888?text=Ol%C3%A1"), "5511999998888");
  assert.equal(numeroDoLink("https://evil.example/5511999998888"), null); assert.equal(numeroDoLink(null), null); assert.equal(numeroDoLink("https://wa.me/1234"), null);
  const l = adicionar([], a);
  assert.ok(linkOrcamento("5511999998888", l)!.startsWith("https://wa.me/5511999998888?text=Ol%C3%A1"));
  assert.equal(linkOrcamento(null, l), null); assert.equal(linkOrcamento("5511999998888", []), null);
});

test("armazenamento: ida e volta, lixo e falha viram lista vazia", () => {
  const mem = new Map<string, string>(); const arm = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
  const l = adicionar([], a, 2); salvar("loja", l, arm); assert.deepEqual(carregar("loja", arm), l);
  assert.deepEqual(carregar("outra", arm), []);
  mem.set("orcamento:x", "{não é json"); assert.deepEqual(carregar("x", arm), []);
  mem.set("orcamento:y", JSON.stringify([{ sku: 1 }, { sku: "S", nome: "N", preco: -5, qtd: 1000 }])); assert.deepEqual(carregar("y", arm), [{ sku: "S", nome: "N", preco: null, qtd: 99 }]);
  assert.deepEqual(carregar("loja", null), []);
  assert.doesNotThrow(() => salvar("loja", l, { getItem: () => null, setItem: () => { throw new Error("cheio"); } }));
});
