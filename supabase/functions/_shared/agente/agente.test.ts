import { test } from "node:test";
import assert from "node:assert/strict";
import { classificarSlug, extrairDoNome } from "./extrair.ts";
import { checarCamposExigidos, montarLinhas, resultadoDe } from "./plano.ts";

test("extrai só o que está escrito no nome (4 produtos reais da Mobis)", () => {
  const a = extrairDoNome("BOMBA OLEO HR/K2500 2.5 16V 13/ D4CB EURO V 26 DTS ALUMINIO - MARCA: TRIM GO");
  assert.deepEqual(a, { marca: "TRIM GO", veiculo: "HR/K2500", cilindrada: "2.5", valvulas: 16, anoInicial: 2013, motor: "D4CB" });
  const b = extrairDoNome("Jogo de Juntas Completo do Motor HR / K2500 2.5 16V D4CB Euro 5 c/ Retentores SABó");
  assert.equal(b.marca, null, "sem 'MARCA:' não adivinha a marca");
  assert.equal(b.veiculo, "HR/K2500");
  assert.equal(b.motor, "D4CB");
  assert.equal(b.anoInicial, null);
  const c = extrairDoNome("RADIADOR OLEO HR/K2500 2.5 16V 13/ D4CB EURO V - MARCA: TRIM GO");
  assert.equal(c.motor, "D4CB");
  assert.equal(c.marca, "TRIM GO");
});

test("nome sem padrão não gera dado nenhum", () => {
  assert.deepEqual(extrairDoNome("PRODUTO QUALQUER"), { marca: null, veiculo: null, cilindrada: null, valvulas: null, anoInicial: null, motor: null });
  assert.equal(extrairDoNome("Motor Euro 5 2.5").motor, null);
});

test("classifica por palavras-chave e não chuta", () => {
  assert.equal(classificarSlug("FILTRO DE OLEO HR 2.5"), "filtro-oleo");
  assert.equal(classificarSlug("Filtro de Ar Hilux"), "filtro-ar");
  assert.equal(classificarSlug("BOMBA OLEO HR/K2500"), null);
});

test("linhas entram sempre a_confirmar, com fonte, data e confiança", () => {
  const e = extrairDoNome("BOMBA OLEO HR/K2500 2.5 16V 13/ D4CB EURO V - MARCA: TRIM GO");
  const linhas = montarLinhas("16719530080", e, null, "2026-10-17T00:00:00Z");
  assert.ok(linhas.length >= 5);
  for (const l of linhas) {
    assert.equal(l.status, "a_confirmar");
    assert.equal(l.fonte, "bling:produto:16719530080:nome");
    assert.ok(l.confianca > 0 && l.confianca <= 1);
    assert.ok(l.coletado_em);
  }
  assert.equal(linhas.find((l) => l.campo === "ano_inicial")!.confianca, 0.4);
});

test("campos exigidos: o que não está comprovado fica vazio e o produto não fica 'sucesso'", () => {
  const exigidos = ["nome", "sku", "preco", "categoria", "imagem_principal", "marca_peca", "codigo_fabricante", "aplicacao_veicular"];
  const r = checarCamposExigidos(exigidos, {
    nome: "X", sku: "CI1", preco: 10, categoria: null,
    temImagemPrincipal: false, temCodigoFabricante: false, temAplicacao: false,
    camposEnriquecidos: new Set(["marca_peca", "aplicacao_veicular"]),
  });
  assert.deepEqual(r.vazios, ["categoria", "imagem_principal", "codigo_fabricante"]);
  assert.equal(resultadoDe(r.vazios), "parcial");
  assert.equal(resultadoDe([]), "sucesso");
  const semSku = checarCamposExigidos(["sku"], { sku: "", temImagemPrincipal: false, temCodigoFabricante: false, temAplicacao: false, camposEnriquecidos: new Set() });
  assert.deepEqual(semSku.vazios, ["sku"], "SKU vazio (caso real do radiador) fica vazio");
});
