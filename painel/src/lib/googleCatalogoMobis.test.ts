import test from "node:test";
import assert from "node:assert/strict";
import { analisarShoppingMobis,verificarGtin } from "./googleCatalogoMobis.ts";

const base={
 id:"CI002916",titulo:"Motor parcial diesel 2.5 8V Trim Go",descricao:"Composição e aplicação técnica documentadas. ".repeat(15),
 marca:"Trim Go",textoGeradoPorIA:true,aplicacaoAprovada:true,fotoRealAutorizada:true,
 preco:13500,disponibilidadeConfirmada:true,
};

test("identificador e tamanho dos textos atendem limite Merchant, com declaração de IA",()=>{
 const r=analisarShoppingMobis(base);
 assert.deepEqual(r.bloqueios,[]);
 assert.equal(r.tipoTitulo,"structured_title");
 assert.equal(r.tipoDescricao,"structured_description");
 assert.equal(r.tipoOrigemIA,"trained_algorithmic_media");
});
test("ficha em revisão não é lançável como Shopping",()=>{
 const r=analisarShoppingMobis({...base,aplicacaoAprovada:false,fotoRealAutorizada:false,
  titulo:"X".repeat(151),descricao:"",disponibilidadeConfirmada:false});
 assert.ok(r.bloqueios.length>=4);
});
test("GTIN não pode ser inventado",()=>{
 assert.equal(verificarGtin("4006381333931"),true);
 assert.equal(verificarGtin("4006381333932"),false);
 assert.equal(verificarGtin("0000"),false);
 assert.ok(analisarShoppingMobis({...base,gtin:"1234567890123"}).bloqueios.some(x=>x.includes("GTIN")));
});
