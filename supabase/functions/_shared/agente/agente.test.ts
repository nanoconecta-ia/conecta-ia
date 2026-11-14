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
  assert.equal(classificarSlug("PRODUTO QUALQUER"), null);
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


test("classifica as famílias reais do catálogo da Mobis (nomes reais)", () => {
  const casos: Array<[string, string | null]> = [
    ["BOMBA OLEO HR/K2500 2.5 16V 13/ D4CB EURO V 26 DTS ALUMINIO - MARCA: TRIM GO", "bomba-oleo"],
    ["10215 - BOMBA DE OLEO", "bomba-oleo"],
    ["Bomba de Óleo Hyundai Hr / Kia Bongo K2500 (13/... Euro V)", "bomba-oleo"],
    ["Bomba d'água TRIM GO HR/K2500 2.5 8V Euro III com juntas", "bombas-agua"],
    ["BOMBA DAGUA HR/K2500 2.5 16V 13/ D4CB EURO V ALUMINIO C/ JUNTA", "bombas-agua"],
    ["854008 BOMBA D AGUA", "bombas-agua"],
    ["CABECOTE COMPLETO 4D56 L200 HPE  - 8 VALVULAS", "cabecote-valvulas"],
    ["Balancim Longo Admissão D4cb 2013/ CI001051", "cabecote-valvulas"],
    ["Comando Valvula Iveco 3.0 16v Admisao Marca Trim Go Autoparts", "cabecote-valvulas"],
    ["TUCHO VALVULA HR/K2500 16V COD CI001053", "cabecote-valvulas"],
    ["KIT DISTRIBUICAO HR/K2500 2.5 16V D4CB EURO V 13/ 16 PECAS", "correias-tensores"],
    ["TENSOR CORREIA DENTADA PRINC HR/K2500/L200 2.5 8V", "correias-tensores"],
    ["JUNTA CABECOTE METAL 2 PICS HR/K2500 2.5 16V D4CB EURO V 13/ 0.90MM", "juntas-retentores"],
    ["RETENTOR EIXO COMANDO VALVULAS HR/K2500/L200", "juntas-retentores"],
    ["Jogo de Bronzina Biela  Hyndai Hr/k2500 D4cb 16v", "bronzinas-biela"],
    ["BIELA MOTOR HR/K2500 2.5 16V 13/ D4CB EURO V", "bielas"],
    ["BANDEJA SUPERIOR HR/H100 LD", "bandejas"],
    ["20529-MOTOR PARTIDA HYUNDAI HR 2.5, KIA BONGO 2.5", "motores-partida"],
    ["MOTOR 4D56/D4BH NOVO PARCIAL C/ CABECOTE", "blocos-motores"],
    ["Bloco Motor Std Hyundai Hr 2.5 16v D4cb 2013/2020", "blocos-motores"],
    ["Filtro Lubrificante Hyundai Hr 05/... / Mitsubishi L200 - JFO0505P - WEGA", "filtro-oleo"],
    ["JFC901 FILTRO COMBUSTIVEL", "filtro-combustivel"],
    ["JFA0H13 FILTRO AR MOTOR", "filtro-ar"],
  ];
  for (const [nome, esperado] of casos) assert.equal(classificarSlug(nome), esperado, nome);
});

test("exclusões: não confunde acessório, caixa de filtro nem peça só citada na aplicação", () => {
  const sem: string[] = [
    "CAIXA FILTRO AR HR", "TAMPA CAIXA FILTRO AR HR",
    "TUBO REFRIGERACAO CABECOTE/AR QUENTE HR/K2500 2.5 8V",
    "BATENTE SUPERIOR BANDEJA MITSUBISHI L200 TRITON PNEU",
    "BUCHA BARRA TENSORA K2500/K2700", "SENSOR PRESSAO OLEO HR/K2500",
    "VALVULA TERMOSTATICA HR/K2500/L200", "RADIADOR DE OLEO HR 2006 A 2012 MOTOR 4D56",
    "REPARO DA BOMBA HIDRAULICA COM ANEL DE ACO", "10W30 BALDE OLEO UNITRACTOR TRANSMISSAO",
    "TURBINA HR 16V - EURO - D4CB", "KIT EMBREAGEM 254MM", "AREIA - DIVERSOS",
  ];
  for (const nome of sem) assert.equal(classificarSlug(nome), null, nome);
});
