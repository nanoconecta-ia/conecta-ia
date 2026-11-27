import {test} from "node:test";
import assert from "node:assert/strict";
import {filtrarProdutos,blocosFabricante,previaBling,type Produto,type No,type Aplicacao,resolverRepresentacaoNo,type ReferenciaVisualNo} from "./projecoes.ts";
const fato={aprovado:true,fonte:"fixture",consultado_em:"2026-11-26"};
const n=(id:string,rotulo=id):No=>({...fato,id,rotulo});
const a:Aplicacao={...fato,id:"a",montadora:n("m","Hyundai"),modelo:n("hr","HR"),motor:n("d","D4CB"),inicio:2014,fim:2018,mercado:"BR",oems:[{...fato,codigo:"TEST-001"}]};
const b:Aplicacao={...a,id:"b",montadora:n("k","Kia"),modelo:n("bongo","Bongo"),motor:n("x","Motor X"),inicio:2019,fim:2022,oems:[{...fato,codigo:"TEST-002"}]};
const p:Produto={loja_id:"l",produto_id:"p",bling_id:"123",sku:"SKU1",nome:"Filtro",ativo:true,publicado:true,marca:n("marca"),fabricante:n("fab"),categoria:[n("filtro")],aplicacoes:[a,b]};
test("facetas devem casar na mesma aplicação, não em veículos diferentes",()=>{assert.equal(filtrarProdutos("l",[p],{modelo:"hr",ano:2020}).length,0);assert.equal(filtrarProdutos("l",[p],{modelo:"hr",motor:"d",ano:2016}).length,1)});
test("OEM pesquisável sem pontuação e vinculado ao veículo",()=>{assert.equal(filtrarProdutos("l",[p],{busca:"TEST001",modelo:"hr"}).length,1);assert.equal(filtrarProdutos("l",[p],{busca:"TEST001",modelo:"bongo"}).length,0)});
test("candidatos não chegam ao filtro; não extrapola ano final desconhecido",()=>{const q={...p,aplicacoes:[{...a,aprovado:false},{...b,fim:null}]};assert.equal(filtrarProdutos("l",[q],{modelo:"hr"}).length,0);assert.equal(filtrarProdutos("l",[q],{modelo:"bongo",ano:2020}).length,0)});
test("público não vê despublicado, inativo ou colisão de SKU",()=>{assert.equal(filtrarProdutos("l",[{...p,publicado:false}]).length,0);assert.equal(filtrarProdutos("l",[{...p,ativo:false}]).length,0);assert.equal(filtrarProdutos("l",[p,{...p,produto_id:"q",bling_id:"124"}]).length,0)});
test("fabricante não é inferido da marca; total é de peças físicas",()=>{assert.equal(blocosFabricante("l",[p])[0].total,1);assert.equal(blocosFabricante("l",[{...p,fabricante:undefined}]).length,0)});
test("projeção não propaga campos comerciais ou privados extras",()=>{const out=JSON.stringify(filtrarProdutos("l",[{...p,preco:999,custo:333,fornecedor:"sigilo"} as Produto]));assert.ok(!out.includes("999"));assert.ok(!out.includes("sigilo"))});
test("escopo entre lojas",()=>assert.throws(()=>filtrarProdutos("outra",[p])));
const opts={htmlHomologado:false,origemMidia:"https://media.example.com",prefixoMidia:"/icons/",pausado:false};
test("prévia Bling texto por padrão e somente campos permitidos",()=>{const r=previaBling("l",p,opts);assert.deepEqual(Object.keys(r.campos),["descricaoCurta","descricaoComplementar"]);assert.ok(r.campos.descricaoComplementar.includes("TEST-001"));assert.ok(!r.campos.descricaoComplementar.includes("<img"));assert.throws(()=>previaBling("l",p,{...opts,pausado:true}))});
test("HTML escapa texto, aceita só mídia autorizada e local; não insere pendência",()=>{const q={...p,nome:"<script>evil</script>",aplicacoes:[{...a,montadora:{...a.montadora,icone:{url:"https://media.example.com/icons/brand.webp",direitos:true,aprovado:true}},modelo:{...a.modelo,icone:{url:"https://evil.example.com/icons/car.png",direitos:true,aprovado:true}}},{...b,aprovado:false}]};const h=previaBling("l",q,{...opts,htmlHomologado:true}).campos.descricaoComplementar;assert.ok(h.includes("&lt;script&gt;"));assert.ok(h.includes("brand.webp"));assert.ok(!h.includes("evil.example.com"));assert.ok(!h.includes("TEST-002"))});


// Fixtures sintéticas: não afirmam geometria, aplicação ou licença real de veículo.
const visual=(no_id:string,tipo:ReferenciaVisualNo["tipo"],nivel:ReferenciaVisualNo["nivel"],ativo_id:string):ReferenciaVisualNo=>({...fato,loja_id:"l",no_id,tipo,nivel,ativo_id,revisao:1,direitos:true,origem:"fabricante"});
const vis=[visual("hr","modelo","compacto","asset-hr"),visual("bongo","modelo","compacto","asset-bongo"),visual("hr","modelo","3d","asset-hr-3d"),visual("hr","modelo","epc","asset-hr-epc"),visual("ev","propulsao","compacto","asset-ev")];
test("VIS-90-01: mesma identidade semântica, três representações independentes",()=>{
 for(const [nivel,ativo] of [["compacto","asset-hr"],["3d","asset-hr-3d"],["epc","asset-hr-epc"]] as const){
  const r=resolverRepresentacaoNo("l",a.modelo,"modelo",nivel,vis);assert.equal(r.no_id,"hr");assert.equal(r.ativo_id,ativo);assert.equal(r.estado,"referencia");
 }
 assert.equal(resolverRepresentacaoNo("l",b.modelo,"modelo","compacto",vis).ativo_id,"asset-bongo");
});
test("VIS-90-02: nunca associa por semelhança de nome ou tipo",()=>{
 assert.equal(resolverRepresentacaoNo("l",n("desconhecido","HR"),"modelo","compacto",vis).estado,"texto");
 assert.equal(resolverRepresentacaoNo("l",a.modelo,"carroceria","compacto",vis).estado,"texto");
 assert.equal(resolverRepresentacaoNo("l",b.modelo,"modelo","epc",vis).estado,"texto");
});
test("VIS-90-03: ausência de direitos, aprovação ou fonte não resolve ativo",()=>{
 const x=vis[0];
 for(const r of [{...x,direitos:false},{...x,aprovado:false},{...x,fonte:""},{...x,consultado_em:"inválido"},{...x,revisao:0}]){
  assert.equal(resolverRepresentacaoNo("l",a.modelo,"modelo","compacto",[r]).ativo_id,null);
 }
 assert.throws(()=>resolverRepresentacaoNo("l",{...a.modelo,aprovado:false},"modelo","compacto",vis));
});
test("VIS-90-04: colisão de registros e isolamento por loja falham fechado",()=>{
 assert.equal(resolverRepresentacaoNo("l",a.modelo,"modelo","compacto",[...vis,{...vis[0],ativo_id:"outro",revisao:2}]).estado,"texto");
 assert.throws(()=>resolverRepresentacaoNo("l",a.modelo,"modelo","compacto",[...vis,{...vis[0],loja_id:"outra"}]));
});
test("VIS-90-05: novas tecnologias reutilizam o contrato sem inferir aplicação",()=>{
 const r=resolverRepresentacaoNo("l",n("ev","Elétrico"),"propulsao","compacto",vis);
 assert.deepEqual(r,{no_id:"ev",tipo:"propulsao",rotulo:"Elétrico",nivel:"compacto",ativo_id:"asset-ev",revisao:1,estado:"referencia"});
 assert.equal(filtrarProdutos("l",[p],{modelo:"ev"}).length,0);
});
