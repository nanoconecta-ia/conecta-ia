import {test} from "node:test";
import assert from "node:assert/strict";
import {filtrarProdutos,blocosFabricante,previaBling,type Produto,type No,type Aplicacao,resolverRepresentacaoNo,type ReferenciaVisualNo,validarBibliotecaVisual,type RegistroVisualNo,projetarRastreabilidadeVisual,type ContextoVisualAplicacao} from "./projecoes.ts";
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


const registro=(r:ReferenciaVisualNo):RegistroVisualNo=>({...r,icon_id:JSON.stringify([r.no_id,r.tipo,r.nivel]),sha256:"a".repeat(64),descricao_acessivel:"Referência sintética "+r.no_id,estado:"vigente"});
test("VIS-91-01: identidade estável por nó e nível; só revisão vigente entra na projeção",()=>{
 const r=registro(vis[0]),antigo={...r,estado:"historico" as const},novo={...r,revisao:2,ativo_id:"asset-hr-v2",sha256:"b".repeat(64)};
 for(const entrada of [[antigo,novo],[novo,antigo]]){
  const out=validarBibliotecaVisual("l",entrada);
  assert.equal(out.length,1);assert.equal(resolverRepresentacaoNo("l",a.modelo,"modelo","compacto",out).ativo_id,"asset-hr-v2");
  assert.equal("sha256" in out[0],false);
 }
});
test("VIS-91-02: revogação e histórico não ativam automaticamente a maior revisão",()=>{
 const r=registro(vis[0]);const out=validarBibliotecaVisual("l",[{...r,estado:"historico"},{...r,revisao:2,estado:"revogado",direitos:false}]);
 assert.equal(out.length,0);assert.equal(resolverRepresentacaoNo("l",a.modelo,"modelo","compacto",out).estado,"texto");
});
test("VIS-91-03: rejeita colisão de identidade, revisão e autoridade vigente",()=>{
 const r=registro(vis[0]);
 for(const entrada of [[r,r],[r,{...r,revisao:2}],[r,{...r,no_id:"bongo",revisao:2}],[r,{...r,icon_id:"outro",revisao:2}]]){
  assert.throws(()=>validarBibliotecaVisual("l",entrada));
 }
});
test("VIS-91-04: integridade declarada, acessibilidade e origem obrigatórias",()=>{
 const r=registro(vis[0]);
 for(const alterado of [{...r,sha256:"invalid"},{...r,descricao_acessivel:" "},{...r,fonte:""},{...r,consultado_em:"inválido"},{...r,direitos:false},{...r,aprovado:false}]){
  assert.throws(()=>validarBibliotecaVisual("l",[alterado]));
 }
 assert.throws(()=>validarBibliotecaVisual("l",[r,{...r,revisao:2,estado:"historico",sha256:"b".repeat(64)}]));
});
test("VIS-91-05: manifesto não mistura lojas e não altera taxonomia/aplicações",()=>{
 const registros=vis.map(registro),out=validarBibliotecaVisual("l",registros);
 assert.equal(out.length,5);
 assert.equal(resolverRepresentacaoNo("l",b.modelo,"modelo","compacto",out).ativo_id,"asset-bongo");
 assert.equal(resolverRepresentacaoNo("l",n("ev","Elétrico"),"propulsao","compacto",out).ativo_id,"asset-ev");
 assert.equal(filtrarProdutos("l",[p],{modelo:"ev"}).length,0);
 assert.throws(()=>validarBibliotecaVisual("l",[{...registros[0],loja_id:"outra"}]));
});

// Fixtures exclusivamente sintéticas: nenhuma afirmação sobre veículos reais.
const ger=n("g1","Geração sintética 1"),ger2=n("g2","Geração sintética 2");
const v92=(tipo:"montadora"|"modelo"|"geracao",no_id:string,ativo_id:string,nivel:ReferenciaVisualNo["nivel"]="compacto")=>({...fato,tipo,no_id,nivel,ativo_id,revisao:1});
const c92:ContextoVisualAplicacao={...fato,loja_id:"l",produto_id:"p",aplicacao_id:"a",montadora_id:"m",modelo_id:"hr",geracao:ger,mercado:"BR",referencias:[v92("montadora","m","asset-m"),v92("modelo","hr","asset-hr"),v92("geracao","g1","asset-g1"),v92("geracao","g1","asset-g1-3d","3d"),v92("geracao","g1","asset-g1-epc","epc")]};
const lib92=[...vis.map(registro),registro(visual("m","montadora","compacto","asset-m")),registro(visual("g1","geracao","compacto","asset-g1")),registro(visual("g1","geracao","3d","asset-g1-3d")),registro(visual("g1","geracao","epc","asset-g1-epc")),registro(visual("g2","geracao","compacto","asset-g2"))];
test("VIS-92-01: monta identidade exata e três níveis sem misturar aplicações",()=>{
 const out=projetarRastreabilidadeVisual("l",p,[c92],lib92,"compacto");
 assert.equal(out.length,1);
 assert.deepEqual([out[0].montadora_id,out[0].modelo_id,out[0].geracao_id,out[0].mercado],["m","hr","g1","BR"]);
 assert.deepEqual(out[0].representacoes.map(x=>x.ativo_id),["asset-m","asset-hr","asset-g1"]);
 for(const [nivel,ativo] of [["3d","asset-g1-3d"],["epc","asset-g1-epc"]] as const){
  assert.deepEqual(projetarRastreabilidadeVisual("l",p,[c92],lib92,nivel)[0].representacoes.map(x=>x.ativo_id),[null,null,ativo]);
 }
});
test("VIS-92-02: mesmo modelo em mercados e gerações distintos exige vínculo explícito",()=>{
 const a2={...a,id:"a2",mercado:"KR",inicio:2020,fim:2022};
 const c2={...c92,aplicacao_id:"a2",mercado:"KR",geracao:ger2,referencias:[v92("geracao","g2","asset-g2")]};
 const q={...p,aplicacoes:[a,a2]};
 const out=projetarRastreabilidadeVisual("l",q,[c92,c2],lib92,"compacto");
 assert.deepEqual(out.map(x=>[x.mercado,x.geracao_id,x.representacoes[2].ativo_id]),[["BR","g1","asset-g1"],["KR","g2","asset-g2"]]);
 assert.deepEqual(out[1].representacoes.slice(0,2).map(x=>x.estado),["texto","texto"]);
 assert.equal(projetarRastreabilidadeVisual("l",q,[{...c2,mercado:"BR"}],lib92,"compacto").length,0);
 assert.equal(filtrarProdutos("l",[q],{modelo:"hr",ano:2021}).length,0);
});
test("VIS-92-03: rejeita troca de fabricante/modelo, geração não aprovada e contexto sem fonte",()=>{
 for(const c of [{...c92,montadora_id:"k"},{...c92,modelo_id:"bongo"},{...c92,geracao:{...ger,aprovado:false}},{...c92,fonte:""},{...c92,mercado:"br"},{...c92,aplicacao_id:"inexistente"}]){
  assert.equal(projetarRastreabilidadeVisual("l",p,[c],lib92,"compacto").length,0);
 }
 assert.equal(projetarRastreabilidadeVisual("l",{...p,aplicacoes:[{...a,aprovado:false}]},[c92],lib92,"compacto").length,0);
});
test("VIS-92-04: vínculo ausente, revogado, não aprovado ou revisão antiga retorna texto",()=>{
 const v=v92("geracao","g1","asset-g1");
 for(const refs of [[],[{...v,aprovado:false}],[{...v,revisao:2}],[{...v,ativo_id:"asset-g2"}]]){
  assert.equal(projetarRastreabilidadeVisual("l",p,[{...c92,referencias:refs}],lib92,"compacto")[0].representacoes[2].estado,"texto");
 }
 const rev=lib92.map(r=>r.no_id==="g1"&&r.nivel==="compacto"?{...r,estado:"revogado" as const}:r);
 assert.equal(projetarRastreabilidadeVisual("l",p,[c92],rev,"compacto")[0].representacoes[2].estado,"texto");
});
test("VIS-92-05: colisão, troca de nó e escopo entre lojas/produtos falham fechado",()=>{
 for(const c of [{...c92,loja_id:"outra"},{...c92,produto_id:"outro"},{...c92,referencias:[v92("geracao","g2","asset-g2")]},{...c92,referencias:[c92.referencias[0],c92.referencias[0]]}]){
  assert.throws(()=>projetarRastreabilidadeVisual("l",p,[c],lib92,"compacto"));
 }
 assert.throws(()=>projetarRastreabilidadeVisual("l",p,[c92,c92],lib92,"compacto"));
 assert.throws(()=>projetarRastreabilidadeVisual("l",{...p,aplicacoes:[a,a]},[c92],lib92,"compacto"));
 assert.throws(()=>projetarRastreabilidadeVisual("l",p,[c92],lib92.map(r=>({...r,loja_id:"outra"})),"compacto"));
 const cb={...c92,aplicacao_id:"b",montadora_id:"k",modelo_id:"bongo",referencias:[]};
 assert.throws(()=>projetarRastreabilidadeVisual("l",p,[c92,cb],lib92,"compacto"));
});
test("VIS-92-06: tecnologias novas sem inferência, sem preço ou dados privados, sem produto não publicado",()=>{
 const ev={...a,id:"ev",montadora:n("ev-m"),modelo:n("ev-model"),motor:n("ev-motor","Motor elétrico"),mercado:"DE",fim:null};
 const he={...a,id:"he",montadora:n("he-m"),modelo:n("he-model"),motor:n("he-motor","Propulsão híbrida"),mercado:"JP"};
 const q={...p,aplicacoes:[ev,he],preco:999,fornecedor:"SIGILO"};
 const ce={...c92,aplicacao_id:"ev",montadora_id:"ev-m",modelo_id:"ev-model",geracao:n("ev-g"),mercado:"DE",referencias:[]};
 const ch={...c92,aplicacao_id:"he",montadora_id:"he-m",modelo_id:"he-model",geracao:n("he-g"),mercado:"JP",referencias:[]};
 const out=projetarRastreabilidadeVisual("l",q,[ce,ch],lib92,"compacto");
 assert.equal(out.length,2);assert.equal(out[0].fim,null);assert.ok(out.every(x=>x.representacoes.every(y=>y.estado==="texto")));
 assert.ok(!JSON.stringify(out).includes("SIGILO"));assert.ok(!JSON.stringify(out).includes("999"));
 assert.equal(projetarRastreabilidadeVisual("l",{...q,publicado:false},[ce,ch],lib92,"compacto").length,0);
 assert.equal(projetarRastreabilidadeVisual("l",{...q,ativo:false},[ce,ch],lib92,"compacto").length,0);
});
