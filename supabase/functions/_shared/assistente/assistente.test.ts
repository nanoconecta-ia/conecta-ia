import { test } from "node:test";
import assert from "node:assert/strict";
import { intencaoCliente, intencaoLojista, responderCliente, type ProdutoPublico } from "./intencao.ts";

test("lojista: reconhece a intenção e cai em ajuda quando não entende", () => {
  assert.equal(intencaoLojista("O que está pendente para aprovar?"), "pendentes");
  assert.equal(intencaoLojista("quais produtos estão incompletos"), "incompletos");
  assert.equal(intencaoLojista("mostra a taxonomia"), "taxonomia");
  assert.equal(intencaoLojista("o bling está conectado?"), "bling");
  assert.equal(intencaoLojista("quantos produtos tenho"), "resumo");
  assert.equal(intencaoLojista("blablabla"), "ajuda");
});

test("cliente: reconhece a intenção", () => {
  assert.equal(intencaoCliente("quanto custa?"), "preco");
  assert.equal(intencaoCliente("serve no meu HR 2013?"), "aplicacao");
  assert.equal(intencaoCliente("qual a marca"), "marca");
  assert.equal(intencaoCliente("tem o código original?"), "codigo");
  assert.equal(intencaoCliente("quero comprar"), "comprar");
});

const base: ProdutoPublico = { nome: "Bomba de óleo", sku: "CI1", preco: 939.47, estoque: 1, marca_peca: null, aplicacoes: [], codigos: [] };
const wa = "https://wa.me/5562999999999";

test("cliente: sem dado aprovado não inventa e leva ao WhatsApp", () => {
  for (const i of ["aplicacao", "marca", "codigo"] as const) {
    const r = responderCliente(i, base, wa);
    assert.match(r, /Ainda não tenho/); assert.ok(r.includes(wa));
  }
  assert.match(responderCliente("preco", { ...base, preco: null }, wa), /Não tenho o preço/);
});

test("cliente: com dado aprovado responde só o que existe", () => {
  const p = { ...base, marca_peca: "TRIM GO", aplicacoes: ["HR/K2500 D4CB 2013+"], codigos: ["oem: 26110-4A700"] };
  assert.match(responderCliente("marca", p, wa), /TRIM GO/);
  assert.match(responderCliente("aplicacao", p, wa), /HR\/K2500 D4CB 2013\+/);
  assert.match(responderCliente("codigo", p, null), /26110-4A700/);
  assert.match(responderCliente("preco", p, wa), /939,47/);
});

test("cliente: nunca cita provedor de IA", () => {
  for (const i of ["preco", "estoque", "aplicacao", "marca", "codigo", "comprar", "outra"] as const)
    assert.ok(!/deepseek|gemini|openai|llama|claude/i.test(responderCliente(i, base, wa)));
});
