import { test } from "node:test";
import assert from "node:assert/strict";
import { LIMITE_ENRIQUECER_CHAT, pedidoEnriquecimentoLote, pedidoImagensPorFicha, rotaStudioDoProduto } from "./contextoEnriquecimentoNano.ts";
import type { DadosStudio } from "./conectorDados.ts";
const id="13904336-e754-43df-a9b9-2957770c2634";
const base={id,sku:null,nome:"Motor parcial 4D56/D4BH",marca:"Trim Go",gtin:null,taxonomia_no_id:null};
test("lote selecionado mantém ID real, sem inventar SKU e sem escrita",()=>{
 const r=pedidoEnriquecimentoLote([base],new Set([id]));
 assert.equal(r.erro,null);assert.match(r.texto??"",/SKU vazio NÃO pode ser inventado/);
 assert.ok(r.texto?.includes(id));assert.match(r.texto??"",/Não alterar Bling/);
});
test("recusa item ausente e quantidade acima do limite",()=>{
 assert.equal(pedidoEnriquecimentoLote([base],new Set(["outro"])).texto,null);
 const muitos=Array.from({length:LIMITE_ENRIQUECER_CHAT+1},(_,i)=>({...base,id:"produto-"+i}));
 assert.equal(pedidoEnriquecimentoLote(muitos,new Set(muitos.map(x=>x.id))).texto,null);
});
test("pesquisa de imagem diferencia OEM aprovado, código pendente e aplicação não homologada",()=>{
 const s={produto:{...base,descricao_curta:null,preco:null},codigos:[
 {tipo:"oem",valor:"26300-42040",status:"aprovado",fonte:"catalogo"},
 {tipo:"similar",valor:"OC540",status:"a_confirmar",fonte:"marketplace"}],
 aplicacoes:[{modelo:"HR",motorizacao:"2.5 16V",ano_inicial:2013,ano_final:2022,status:"a_confirmar",fonte:"marketplace"}],
 categoriaBling:"Motor",taxonomia:"Motor parcial"} as unknown as DadosStudio;
 const r=pedidoImagensPorFicha(s);
 assert.match(r,/26300-42040/);assert.match(r,/OC540/);assert.match(r,/A CONFIRMAR/);
 assert.match(r,/não são equivalentes/);assert.match(r,/Não buscar apenas por nome genérico/);
 assert.ok(r.includes(id));
});
test("rota de Estúdio aceita só UUID",()=>{
 assert.equal(rotaStudioDoProduto(id),"#/studio?produto="+id);
 assert.equal(rotaStudioDoProduto("javascript:alert(1)"),null);
});