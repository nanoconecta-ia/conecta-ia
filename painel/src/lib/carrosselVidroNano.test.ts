import { test } from "node:test";
import assert from "node:assert/strict";
import {indiceVisivel, proximaFoto, indiceDaFoto} from "./carrosselVidroNano.ts";
test("navega circularmente em até oito fotos sem descartar ordem",()=>{
  assert.equal(proximaFoto(8,7,1),0);
  assert.equal(proximaFoto(8,0,-1),7);
  assert.equal(proximaFoto(3,1,1),2);
  assert.equal(proximaFoto(3,1,-1),0);
});
test("vazio e filtro removendo a seleção voltam à primeira",()=>{
  assert.equal(proximaFoto(0,0,1),0);
  assert.equal(indiceDaFoto([{id:"a"},{id:"b"}],"b"),1);
  assert.equal(indiceDaFoto([{id:"a"}],"b"),0);
  assert.equal(indiceDaFoto([],"b"),0);
});
test("entradas fora do intervalo ficam dentro da galeria",()=>{
  assert.equal(indiceVisivel(4,-1),3);
  assert.equal(indiceVisivel(4,100),0);
  assert.equal(indiceVisivel(4,Infinity),0);
});
