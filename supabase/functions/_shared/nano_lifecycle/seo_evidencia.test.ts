import {test} from "node:test";
import assert from "node:assert/strict";
import {reconciliarProvaSeo,type HomologacaoSeoVigente} from "./seo_evidencia.ts";
import type {Produto,ContextoVisualAplicacao} from "./projecoes.ts";
import {aplicacaoIndexavel,type AplicacaoSeo} from "../seo/aplicacao.ts";
import type {ProdutoSeo,LojaSeo} from "../seo/dados.ts";
import {responderSeo} from "../seo/rotas.ts";
import {urlsDoSitemap} from "../seo/sitemap.ts";
const fato={aprovado:true,fonte:"fixture",consultado_em:"2026-11-26"};
const n=(id:string,rotulo:string)=>({...fato,id,rotulo});
const p:Produto={loja_id:"l",produto_id:"p",sku:"TEST-1",bling_id:"123",nome:"Filtro teste",ativo:true,publicado:true,categoria:[],aplicacoes:[{...fato,id:"a",montadora:n("m","Montadora X"),modelo:n("v","Modelo X"),motor:n("t","M1"),inicio:2010,fim:2015,mercado:"BR",oems:[{...fato,codigo:"OEMTEST"}]}]};
const c:ContextoVisualAplicacao={...fato,loja_id:"l",produto_id:"p",aplicacao_id:"a",montadora_id:"m",modelo_id:"v",geracao:n("g","G1"),mercado:"BR",referencias:[]};
const ps:ProdutoSeo={sku:"TEST-1",nome:"Filtro teste",descricao:null,descricao_longa:null,marca:null,gtin:null,mpn:null,preco:999.99,estoque:12,publicado:true,situacao:"A",atualizado_em:null,categoria:null,imagens:[]};
const loja:LojaSeo={nome:"Mobis",slug:"mobis",ativa:true,dominio:"exemplo.com.br",whatsapp:null,politicas:null};
const a:AplicacaoSeo={slug:"modelo-x-teste",sku:"TEST-1",titulo:"Filtro teste Modelo X",descricao:"Descrição de teste",modelo:"Modelo X",motor:"M1",inicio:2010,fim:2015,oem:"OEMTEST",restricao:null,contraindicacao:null,status:"aprovado",visivel:true,modeloId:"v",fonte:"Documento fixture",coletadoEm:"2026-11-26",prova:{validada:true,revisao:"r1",referencia:"ref1",aplicacaoSlug:"modelo-x-teste",sku:"TEST-1",modeloId:"v",motor:"M1",inicio:2010,fim:2015,oem:"OEMTEST",mercado:"BR"}};
const h:HomologacaoSeoVigente={loja_id:"l",produto_id:"p",aplicacao_id:"a",geracao_id:"g",montadora_id:"m",motor_id:"t",estado:"homologada",revisao:"r1",produtor:"prod",aprovador:"aud",referencia:"ref1",pagina:a,produtoTecnico:{loja_id:"l",sku:"TEST-1",oem:["OEMTEST"],fabricante:[]},proposta:{loja_id:"l",sku:"TEST-1",base:"versao_do_veiculo",veiculo:{marca:"Montadora X",modelo:"Modelo X",motor:"M1",ano_inicial:2010,ano_final:2015,tipo_ano:"ano_modelo_crlv",versao:"G1"},fontes:[{tipo:"catalogo_fabricante",documento:"fixture",data:"2026-11-26",codigo_conferido:"OEMTEST"}]}};
const run=(hs:HomologacaoSeoVigente[]=[h],pagina=a,produtos=[p],ctx=[c],rev="r1",pais=[ps])=>reconciliarProvaSeo("l",produtos,"p","a",rev,ctx,[],pagina,pais,hs,"2026-11-27");
test("SEO-96-01: prova vigente exata passa contrato e rota existentes, sem preço",()=>{
 const out=run();assert.equal(aplicacaoIndexavel(out,[ps]),true);
 const r=responderSeo("/aplicacao/"+a.slug,loja,[ps],[out]);assert.equal(r.status,200);assert.match(r.corpo,/canonical/);assert.ok(!r.corpo.includes("999.99"));
 assert.ok(urlsDoSitemap(loja.dominio,[ps],[],[out]).some(x=>x.loc.endsWith("/aplicacao/"+a.slug)));
});
test("SEO-96-02: legado, procedência histórica, revogação e autoaprovação não emitem prova",()=>{
 for(const hs of [[],[{...h,estado:"procedencia_conferida" as const}],[{...h,estado:"revogada" as const}],[{...h,aprovador:h.produtor}],[h,h]])assert.equal(run(hs).prova,undefined);
 assert.equal(run([h],a,[p],[c],"r2").prova,undefined);
 const out=run([]);assert.ok(!urlsDoSitemap(loja.dominio,[ps],[],[out]).some(x=>x.loc.endsWith("/aplicacao/"+a.slug)));
});
test("SEO-96-03: identidade e escopo técnico exatos; não empresta OEM, motor ou geração",()=>{
 for(const x of [{...h,geracao_id:"outra"},{...h,motor_id:"outro"},{...h,montadora_id:"outra"}])assert.equal(run([x]).prova,undefined);
 for(const x of [{...a,oem:"OUTRO"},{...a,fim:2016}])assert.equal(run([{...h,pagina:x}],x).prova,undefined);
 for(const x of [{...a,titulo:"Título alterado"},{...a,restricao:"Alteração não aprovada"}])assert.equal(run([h],x).prova,undefined);
 assert.equal(run([h],a,[p],[]).prova,undefined);
 assert.throws(()=>run([{...h,loja_id:"outra"}]));assert.throws(()=>run([{...h,aplicacao_id:"outra"}]));
});
test("SEO-96-04: validador existente impede fonte fraca, base por motor e ano mundial",()=>{
 for(const prop of [{...h.proposta,base:"somente_motor" as const},{...h.proposta,fontes:[{tipo:"catalogo_distribuidor" as const,documento:"fixture",data:"2026-11-26",codigo_conferido:"OEMTEST"}]},{...h.proposta,veiculo:{...h.proposta.veiculo,tipo_ano:"lancamento_mundial" as const}}])assert.equal(run([{...h,proposta:prop}]).prova,undefined);
 assert.equal(run([{...h,produtoTecnico:{...h.produtoTecnico,oem:[]}}]).prova,undefined);
});
test("SEO-96-05: pai não publicado, inativo ou ambíguo nunca indexável",()=>{
 for(const q of [{...p,publicado:false},{...p,ativo:false}])assert.equal(run([h],a,[q]).prova,undefined);
 assert.equal(run([h],a,[p],[c],"r1",[ps,ps]).prova,undefined);
 assert.equal(run([h],a,[p],[c],"r1",[{...ps,publicado:false}]).prova,undefined);
 assert.throws(()=>run([h],a,[p,p]));
});
