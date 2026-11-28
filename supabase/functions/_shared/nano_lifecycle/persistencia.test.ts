import {test} from "node:test";
import assert from "node:assert/strict";
import {registrarCaptura,type PortaCaptura,type RegistroCaptura} from "./persistencia.ts";
import type {ProdutoLifecycle} from "./detector.ts";
const p:ProdutoLifecycle={id:"p",loja_id:"l",bling_id:"123",sku:"SKU1",situacao:"A",nome:"Filtro"};
const ctx={loja:"l",revisao:"sync_0002",antes:[] as ProdutoLifecycle[],depois:[p],pausados:new Set<string>(),completa:true,habilitada:true};
function fake(modo:"normal"|"timeout_antes"|"timeout_depois"|"conflito"="normal"){
 let checkpoint:string|null="sync_0001";let escritas=0;const registros=new Map<string,RegistroCaptura>();
 const porta:PortaCaptura={checkpoint:async()=>checkpoint,obter:async(_l,r)=>registros.get(r)??null,gravar:async r=>{escritas++;if(modo==="conflito")return "conflito";if(modo==="timeout_antes")throw Error("timeout");if(checkpoint!==r.checkpointAnterior)return "conflito";registros.set(r.revisao,r);checkpoint=r.revisao;if(modo==="timeout_depois")throw Error("timeout");return "gravado"}};
 return {porta,escritas:()=>escritas};
}
test("confirma registro durável e não repete mesma revisão",async()=>{const f=fake();assert.equal((await registrarCaptura(f.porta,ctx)).confirmado,true);assert.equal((await registrarCaptura(f.porta,ctx)).estado,"ja_confirmado");assert.equal(f.escritas(),1)});
test("mesma revisao com eventos diferentes não é sucesso",async()=>{const f=fake();await registrarCaptura(f.porta,ctx);assert.equal((await registrarCaptura(f.porta,{...ctx,depois:[]})).estado,"revisao_divergente");assert.equal(f.escritas(),1)});
test("timeout antes do commit não repete escrita",async()=>{const f=fake("timeout_antes");assert.equal((await registrarCaptura(f.porta,ctx)).estado,"resultado_ambiguo_reconciliar");assert.equal(f.escritas(),1)});
test("timeout após commit é reconciliado por leitura",async()=>{const f=fake("timeout_depois");assert.equal((await registrarCaptura(f.porta,ctx)).estado,"confirmado_por_leitura");assert.equal(f.escritas(),1)});
test("CAS concorrente, parcial ou desabilitada não avançam",async()=>{const f=fake("conflito");assert.equal((await registrarCaptura(f.porta,ctx)).confirmado,false);for(const c of [{...ctx,completa:false},{...ctx,habilitada:false}])assert.equal((await registrarCaptura(f.porta,c)).confirmado,false);assert.equal(f.escritas(),1)});
