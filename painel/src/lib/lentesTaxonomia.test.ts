import { test } from "node:test";
import assert from "node:assert/strict";
import { eixoDaRaiz, indicePecas, normalizar, pct, sinaisVeiculo, sugerirPeca } from "./lentesTaxonomia.ts";

const nos = [
  { id: "1", nome: "Motor", caminho: "Motor", profundidade: 0 },
  { id: "2", nome: "Bombas d'água", caminho: "Arrefecimento › Bombas d'água", profundidade: 1 },
  { id: "3", nome: "Bombas de óleo", caminho: "Motor › Bombas de óleo", profundidade: 1 },
  { id: "4", nome: "Bielas", caminho: "Motor › Bielas", profundidade: 1 },
  { id: "5", nome: "Bandeja superior", caminho: "Suspensão › Bandejas › Bandeja superior", profundidade: 2 },
  { id: "6", nome: "Bandejas", caminho: "Suspensão › Bandejas", profundidade: 1 },
  { id: "7", nome: "Pistões", caminho: "Motor › Pistões", profundidade: 1 },
];
const ix = indicePecas(nos);

test("normaliza acento, plural e d'água", () => {
  assert.equal(normalizar("Bombas d'água"), "bomba dagua");
  assert.equal(normalizar("BOMBA DAGUA HR/K2500"), "bomba dagua hr k2500");
  assert.equal(normalizar("Pistões"), "pistao");
  assert.equal(normalizar("K2500"), "k2500");
});
test("eixo da raiz: peça, marca, veículo e fila", () => {
  assert.equal(eixoDaRaiz("Motor"), "peca");
  assert.equal(eixoDaRaiz("Marcas e fabricantes"), "marca");
  assert.equal(eixoDaRaiz("Veículos e aplicações"), "veiculo");
  assert.equal(eixoDaRaiz("Sem classificação"), "fila");
});
test("sugestão: o nó mais específico vence; palavra inteira; sem sinal = null", () => {
  assert.equal(sugerirPeca("BOMBA DAGUA HR/K2500/ 2.5 8V", ix)?.noId, "2");
  assert.equal(sugerirPeca("BOMBA OLEO 4D56 D4BH", ix), null, "sem 'de' no nome não casa 'bombas de óleo': não inventa");
  assert.equal(sugerirPeca("Bomba de Óleo Motor HR 2.5 16v", ix)?.noId, "3");
  assert.equal(sugerirPeca("BANDEJA SUPERIOR K2500 2013/ LD", ix)?.noId, "5");
  assert.equal(sugerirPeca("BANDEJA INFERIOR HR LD", ix)?.noId, "6");
  assert.equal(sugerirPeca("BIELA MOTOR HR/K2500 2.5 16V", ix)?.noId, "4", "'biela' é mais específico que 'motor'");
  assert.equal(sugerirPeca("PEA97980 50 PISTAO C/ANEL", ix)?.noId, "7");
  assert.equal(sugerirPeca("MOTORISTA KIT", ix), null, "prefixo não é palavra inteira");
  assert.equal(sugerirPeca("10A1075C CORREIA V", ix), null);
});
test("sinais de veículo: só termos cadastrados, por palavra inteira, sem repetir", () => {
  const termos = [
    { tipo: "modelo" as const, id: "m1", rotulo: "HR", grupo: "Hyundai" },
    { tipo: "modelo" as const, id: "m2", rotulo: "K2500", grupo: "Kia" },
    { tipo: "motor" as const, id: "e1", rotulo: "D4CB", grupo: "D4" },
    { tipo: "modelo" as const, id: "m3", rotulo: "L200", grupo: "Mitsubishi" },
  ];
  assert.deepEqual(sinaisVeiculo("BIELA MOTOR HR/K2500 2.5 16V 13/ D4CB EURO V", termos).map((t) => t.id), ["m1", "m2", "e1"]);
  assert.deepEqual(sinaisVeiculo("CHRYSLER 200", termos), []);
});
test("pct seguro", () => { assert.equal(pct(42, 275), 15); assert.equal(pct(1, 0), 0); });
