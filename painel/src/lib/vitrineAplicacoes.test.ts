import {test} from "node:test";
import assert from "node:assert/strict";
import {modeloDoAtalho,paginasDaSelecao,rotuloAplicacao} from "./vitrineAplicacoes.ts";
const a={slug:"hr",titulo:"Filtro HR",modelo:"HR",status:"aprovado",motorizacao:"D4CB",ano_inicial:2014,ano_final:2019};
const b={...a,slug:"bongo",modelo:"Bongo",motorizacao:"D4BH",ano_inicial:2008,ano_final:2012};
test("links correspondem ao mesmo veículo, motor e ano",()=>{assert.deepEqual(paginasDaSelecao([a,b],{modelo:"HR",motor:"D4CB",ano:"2016"}),[a]);assert.equal(paginasDaSelecao([a,b],{modelo:"HR",ano:"2010"}).length,0)});
test("metadado ausente, ano desconhecido ou status candidato não confirma",()=>{assert.equal(paginasDaSelecao([{...a,ano_final:null}],{ano:"2019"}).length,0);assert.equal(paginasDaSelecao([{...a,motorizacao:null}],{motor:"D4CB"}).length,0);assert.equal(paginasDaSelecao([{...a,status:"a_confirmar"}],{}).length,0)});
test("rótulo inclui versão e período, não extrapola",()=>assert.equal(rotuloAplicacao(a),"HR · D4CB · 2014–2019"));

test("atalhos usam rótulos de modelos aprovados, não adivinham variantes",()=>{assert.equal(modeloDoAtalho("Bongo",["HR","Bongo K2500"]),"Bongo K2500");assert.equal(modeloDoAtalho("Bongo",["Bongo","Bongo K2500"]),"Bongo");assert.equal(modeloDoAtalho("Bongo",["Kia Bongo","Bongo K2500"]),"Bongo");assert.equal(modeloDoAtalho("L200",["L200 Triton"]),"L200")});
