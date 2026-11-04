import test from "node:test";
import assert from "node:assert/strict";
import { chaveDaSelecao, previaValida, resumoDaPrevia, LIMITE_PILOTO_ENRIQUECIMENTO, type PreviaLote } from "./enriquecimentoLote.ts";

const pre: PreviaLote = {
  itens:[
    {produto_id:"u1",sku:"OC1224",nome:"Filtro de óleo",estado:"automacao_pausada"},
    {produto_id:"u2",sku:"CI000016",nome:"Bomba d'água",estado:"apto"},
  ],
  aptos:1,pausados:1,inativos:0,ja_na_fila:0,aviso:"pré-visualização"
};
test("piloto real bloqueia pausados e soma os estados",()=>{
  assert.equal(LIMITE_PILOTO_ENRIQUECIMENTO,10);
  assert.equal(previaValida(pre),true);
  assert.match(resumoDaPrevia(pre),/1 pausado/);
});
test("seleção não muda por ordem nem IDs repetidos",()=>{
  assert.equal(chaveDaSelecao(["z","a","z"]),chaveDaSelecao(["a","z"]));
  assert.notEqual(chaveDaSelecao(["a","z"]),chaveDaSelecao(["a","b"]));
});
test("recusa resposta incompleta e contagem incoerente",()=>{
  assert.equal(previaValida({...pre,aptos:2}),false);
  assert.equal(previaValida({...pre,itens:[{...pre.itens[0],estado:"executado"}]}),false);
  assert.equal(previaValida({...pre,itens:Array.from({length:11},()=>pre.itens[0])}),false);
});
