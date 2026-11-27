import {test} from "node:test";
import assert from "node:assert/strict";
import {compararPatrimonioCodigo,type EntradaPatrimonial,type SnapshotPatrimonial} from "./patrimonio.ts";
const e=(path:string,sha="a".repeat(40)):EntradaPatrimonial=>({path,sha,mode:"100644",type:"blob"});
const snap=(entradas:EntradaPatrimonial[]):SnapshotPatrimonial=>({commit:"b".repeat(40),tree:"c".repeat(40),completo:true,entradas});
const base=snap([e("mcp/index.ts"),e("api/contrato.ts"),e("docs/no.md")]);
test("PAT-97-01: denominador fixo e presença não equivalem à homologação",()=>{
 const r=compararPatrimonioCodigo(base,snap([...base.entradas,e("novo.ts")]));
 assert.equal(r.obrigatorios,3);assert.equal(r.identicos,3);assert.equal(r.novos,1);assert.equal(r.indicePresenca,1);assert.equal(r.homologacaoOperacional,false);
});
test("PAT-97-02: arquivo novo ou rename não compensa perda",()=>{
 const r=compararPatrimonioCodigo(base,snap([e("mcp/novo.ts"),e("api/contrato.ts"),e("docs/no.md"),e("extra.ts")]));
 assert.equal(r.ausentes,1);assert.equal(r.novos,2);assert.equal(r.indicePresenca,2/3);assert.equal(r.pendencias[0].path,"mcp/index.ts");
});
test("PAT-97-03: hash e modo alterados exigem revisão",()=>{
 const r=compararPatrimonioCodigo(base,snap([e("mcp/index.ts","d".repeat(40)),{...e("api/contrato.ts"),mode:"100755"},e("docs/no.md")]));
 assert.equal(r.alterados,2);assert.equal(r.indicePresenca,1);assert.equal(r.indiceIdentidade,1/3);assert.equal(r.pendencias.length,2);
});
test("PAT-97-04: snapshot parcial, vazio, duplicado ou identificador inválido é rejeitado",()=>{
 for(const x of [{...base,completo:false},snap([]),snap([e("x"),e("x")]),{...base,tree:"invalido"},snap([e("../x")]),snap([e("x","0")])])assert.throws(()=>compararPatrimonioCodigo(base,x));
});
test("PAT-97-05: submódulo e symlink são identidade, não apenas conteúdo",()=>{
 const b=snap([{path:"sub",sha:"a".repeat(40),mode:"160000",type:"commit"},{...e("link"),mode:"120000"}]);
 const r=compararPatrimonioCodigo(b,snap([e("sub"),e("link")]));assert.equal(r.alterados,2);
});
