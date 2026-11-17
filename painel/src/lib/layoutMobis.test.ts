import {test} from "node:test";
import assert from "node:assert/strict";
import {BLOCOS_COMERCIAIS,NOMES_BLOCOS,ordemPublica,intervaloPublico,moverBloco} from "./layoutMobis.ts";
test("cinco blocos comerciais e cabeçalho/rodapé protegidos fora da ordem editável",()=>{
  assert.equal(BLOCOS_COMERCIAIS.length,5);
  assert.ok(!BLOCOS_COMERCIAIS.includes("cabecalho" as never));
  assert.ok(!BLOCOS_COMERCIAIS.includes("privacidade" as never));
  assert.equal(Object.keys(NOMES_BLOCOS).length,5);
});
test("instruções inesperadas, repetidas ou incompletas são recusadas sem renderizar código",()=>{
  for(const v of [null,[],["banner","banner","taxonomia","catalogo","empresa"],
    ["banner","montadoras","taxonomia","catalogo","<script>"],["banner","montadoras","taxonomia","catalogo"]])
    assert.deepEqual(ordemPublica(v),[...BLOCOS_COMERCIAIS]);
});
test("arrastar respeita ordem e limites; intervalo de giro fica entre 4 e 15s",()=>{
  const m=moverBloco([...BLOCOS_COMERCIAIS],3,1);
  assert.deepEqual(m,["banner","catalogo","montadoras","taxonomia","empresa"]);
  assert.deepEqual(ordemPublica(m),m);
  assert.equal(intervaloPublico(4),4);
  assert.equal(intervaloPublico(15),15);
  assert.equal(intervaloPublico(0),6);
  assert.equal(intervaloPublico(60),6);
});
