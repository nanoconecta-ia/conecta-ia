import { test } from "node:test";
import assert from "node:assert/strict";
import { faltaParaAprovarForma, faltaParaAprovarRegra, formatarCep, montarRegra, normalizarCep, situacao } from "./condicoes.ts";

const base = { tipo: "transportadora", cepInicio: "01000-000", cepFim: "01999-999", prazoMin: "2", prazoMax: "4", valorFrete: "", gratisAcima: "", fonte: "tabela da transportadora" };

test("situação: nada fica visível sem aprovação e sem o botão mostrar", () => {
  assert.equal(situacao({ status: "rascunho", visivel_no_site: false }), "rascunho");
  assert.equal(situacao({ status: "aprovada", visivel_no_site: false }), "aprovada_oculta");
  assert.equal(situacao({ status: "aprovada", visivel_no_site: true }), "visivel");
  assert.equal(situacao({ status: "rascunho", visivel_no_site: true }), "rascunho", "visível sem aprovação não vale");
});
test("CEP: 8 dígitos, com ou sem hífen", () => {
  assert.equal(normalizarCep("01310-100"), "01310100");
  assert.equal(normalizarCep("0131010"), null);
  assert.equal(formatarCep("01310100"), "01310-100");
});
test("regra: frete vazio é 'a calcular' (null), nunca zero", () => {
  const r = montarRegra(base);
  assert.ok(r.ok);
  if (r.ok) { assert.equal(r.valor.valor_frete, null); assert.equal(r.valor.cep_inicio, "01000000"); assert.equal(r.valor.prazo_dias_max, 4); }
  const gratis = montarRegra({ ...base, valorFrete: "0" });
  assert.ok(gratis.ok && gratis.valor.valor_frete === 0, "zero só quando o lojista digita 0");
  const virgula = montarRegra({ ...base, valorFrete: "19,90" });
  assert.ok(virgula.ok && virgula.valor.valor_frete === 19.9);
});
test("regra: recusa faixa invertida, prazo incoerente, número inválido e fonte vazia", () => {
  assert.ok(!montarRegra({ ...base, cepInicio: "02000000", cepFim: "01000000" }).ok);
  assert.ok(!montarRegra({ ...base, prazoMin: "5", prazoMax: "3" }).ok);
  assert.ok(!montarRegra({ ...base, prazoMax: "abc" }).ok);
  assert.ok(!montarRegra({ ...base, prazoMax: "91" }).ok);
  assert.ok(!montarRegra({ ...base, valorFrete: "-1" }).ok);
  assert.ok(!montarRegra({ ...base, fonte: "  " }).ok);
  assert.ok(!montarRegra({ ...base, cepInicio: "123" }).ok);
});
test("aprovação: regra sem prazo máximo e parcelas fora do cartão de crédito ficam bloqueadas", () => {
  assert.ok(faltaParaAprovarRegra({ prazo_dias_max: null }));
  assert.equal(faltaParaAprovarRegra({ prazo_dias_max: 4 }), null);
  assert.ok(faltaParaAprovarForma({ forma: "pix", parcelas_max: 3 }));
  assert.equal(faltaParaAprovarForma({ forma: "cartao_credito", parcelas_max: 6 }), null);
});
