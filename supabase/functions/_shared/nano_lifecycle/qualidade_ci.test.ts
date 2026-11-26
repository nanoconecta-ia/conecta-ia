import {test} from "node:test";
import assert from "node:assert/strict";
import {qualidadeCI} from "./qualidade_ci.ts";
test("nota parcial: faltantes e ignorados obrigatorios nao viram aprovacao",()=>{const r=qualidadeCI("r",["a","b","c"],[{id:"a",revisao:"r",estado:"aprovado"},{id:"b",revisao:"r",estado:"ignorado"}]);assert.equal(r.indice,1/3);assert.equal(r.pendentes,2);assert.equal(r.ciCompleto,false)});
test("revisao anterior e duplicidade nao contaminam nota",()=>{const a={id:"a",revisao:"r",estado:"aprovado" as const};assert.equal(qualidadeCI("r",["a"],[{...a,revisao:"velha"}]).indice,0);assert.equal(qualidadeCI("r",["a"],[a,a]).indice,0);assert.equal(qualidadeCI("r",["a"],[a]).ciCompleto,true)});
test("falha impede conclusao e politica sem denominador nao e nota",()=>{assert.equal(qualidadeCI("r",["a"],[{id:"a",revisao:"r",estado:"falhou"}]).falhas,1);assert.throws(()=>qualidadeCI("r",[],[]))});
