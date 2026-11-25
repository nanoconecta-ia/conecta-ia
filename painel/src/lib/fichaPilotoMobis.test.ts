import { test } from "node:test";
import assert from "node:assert/strict";
import { fichaPilotoMobis } from "./fichaPilotoMobis.ts";
import type { FichaProduto } from "./ficha.ts";
const produto: FichaProduto = {sku:"CI003696", nome:"MOTOR HR/K2500 2.5 16V 13/ D4CB EURO V NOVO PARCIAL C/ CABECOTE - MARCA: TRIM GO", marca:"TRIM GO", preco:18900, descricao:null, imagem:null, whatsapp:null};
test("piloto lê atributos do cadastro sem publicar preço ou compatibilidade", () => {
  const c = Object.fromEntries(fichaPilotoMobis(produto)!.map(x => [x.rotulo,x.valor]));
  assert.deepEqual(c, {"Motor":"D4CB","Cilindrada":"2,5 L","Válvulas":"16V","Combustível":"Diesel","Emissão":"Euro V","Tipo":"Parcial c/ cabeçote","Condição":"Novo","Marca":"TRIM GO","Código":"CI003696"});
});
test("não propaga atributos ausentes ou conflitantes e não afeta outros SKUs", () => {
  assert.equal(fichaPilotoMobis({...produto,sku:"CI003000"}),null);
  const c=fichaPilotoMobis({...produto,nome:"MOTOR D4CB D4BH 8V 16V EURO V EURO IV USADO NOVO",marca:null})!;
  assert.deepEqual(c.map(x => x.rotulo),["Código"]);
});
