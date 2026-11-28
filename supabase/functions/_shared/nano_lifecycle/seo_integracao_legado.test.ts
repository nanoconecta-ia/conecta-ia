// Checkpoint 101: regressão de fronteiras API/SEO e integração pura das provas.
// Sem HTTP real, Deno.serve, banco ou autoridade persistente: a inspeção do
// código dos adaptadores é estática; rota e sitemap são exercitados de verdade.
import {readFileSync} from "node:fs";
import {test} from "node:test";
import assert from "node:assert/strict";
import {reconciliarProvaSeo,type HomologacaoSeoVigente} from "./seo_evidencia.ts";
import type {Produto,ContextoVisualAplicacao} from "./projecoes.ts";
import {aplicacaoIndexavel,podeConsultarAplicacao,projetarAplicacaoLegada,type AplicacaoSeo,type RegistroAplicacaoLegada} from "../seo/aplicacao.ts";
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

const api=readFileSync(new URL("../../loja-publica/index.ts",import.meta.url),"utf8");
const seo=readFileSync(new URL("../../loja-seo/index.ts",import.meta.url),"utf8");
const caminho="/aplicacao/"+a.slug;
const naRota=(out:AplicacaoSeo)=>responderSeo(caminho,loja,[ps],[out]);
const noMapa=(out:AplicacaoSeo)=>urlsDoSitemap(loja.dominio,[ps],[],[out]).some(x=>x.loc.endsWith(caminho));
function exigeNoindex(out:AplicacaoSeo){
 assert.equal(out.prova,undefined);
 assert.equal(aplicacaoIndexavel(out,[ps]),false);
 const r=naRota(out);assert.equal(r.status,200);assert.match(r.cabecalhos["x-robots-tag"],/noindex/);
 assert.doesNotMatch(r.corpo,/rel="canonical"|OEMTEST/);assert.equal(noMapa(out),false);
}
test("INT-101-01: contrato estático da API não anuncia indexação legada e SEO não inventa prova",()=>{
 const inicio=api.indexOf("pagina_aplicacao: {"),fim=api.indexOf("preco: null, estoque: null, whatsapp",inicio);
 assert.ok(inicio>=0&&fim>inicio);
 const corpo=api.slice(inicio,fim);
 assert.match(corpo,/status:\s*app\.status,\s*indexavel:\s*false\s*,/);
 assert.doesNotMatch(corpo,/\bprova\s*:/);
 const proj=seo.split("\n").find(l=>l.includes("aplicacoes=appRows.flatMap"));
 assert.ok(proj);assert.doesNotMatch(proj,/\bprova\s*:/);
 exigeNoindex(run([]));
});
test("INT-101-02: prova enviada na página sem autoridade ou autoaprovada não habilita SEO",()=>{
 exigeNoindex(run([],a));exigeNoindex(run([{...h,aprovador:h.produtor}]));
 exigeNoindex(run([{...h,estado:"procedencia_conferida"}]));
 assert.throws(()=>run([{...h,loja_id:"outra"}]));
});
test("INT-101-03: revogação e mudança de revisão eliminam prova e URL de sitemap",()=>{
 const antes=run();assert.equal(noMapa(antes),true);
 exigeNoindex(run([{...h,estado:"revogada"}]));
 exigeNoindex(run([h],a,[p],[c],"r2"));
 exigeNoindex(run([h,h]));
});
test("INT-101-04: divergência de OEM, geração e identidade física não herda homologação",()=>{
 exigeNoindex(run([{...h,geracao_id:"outra"}]));
 exigeNoindex(run([{...h,motor_id:"outro"}]));
 const oemAlterado={...a,oem:"OUTRO"};
 exigeNoindex(run([{...h,pagina:oemAlterado}],oemAlterado));
 assert.equal(run([h],a,[{...p,publicado:false}]).prova,undefined);
 assert.throws(()=>run([{...h,produto_id:"outro"}]));
 assert.equal(run().sku,p.sku);
});
test("INT-101-05: evidência sintética vigente concorda com rota e sitemap; domínio ausente não indexa rota",()=>{
 const out=run();assert.equal(aplicacaoIndexavel(out,[ps]),true);
 const r=naRota(out);assert.equal(r.status,200);
 assert.equal(r.cabecalhos["x-robots-tag"],undefined);
 assert.match(r.corpo,/rel="canonical"/);assert.equal(noMapa(out),true);
 const previa=responderSeo(caminho,{...loja,dominio:null},[ps],[out]);
 assert.match(previa.cabecalhos["x-robots-tag"],/noindex/);
 assert.doesNotMatch(previa.corpo,/rel="canonical"/);
 assert.deepEqual(urlsDoSitemap(null,[ps],[],[out]),[]);
});
test("INT-101-06: consulta de aplicação não emite preço, estoque ou oferta",()=>{
 for(const out of [run(),run([])]){
  const r=naRota(out);assert.equal(r.status,200);
  assert.doesNotMatch(r.corpo,/999\.99|schema\.org\/Offer|"offers"|in_stock/);
  assert.match(r.corpo,/Preço sob consulta/);
 }
 const inicio=api.indexOf("pagina_aplicacao: {");
 assert.ok(inicio>=0);assert.match(api.slice(inicio,inicio+1800),/preco:\s*null,\s*estoque:\s*null/);
});

// Checkpoint 102: ambos os adaptadores usam a mesma projeção e o gate da rota.
const legado:RegistroAplicacaoLegada={pagina_slug:a.slug,pagina_titulo:a.titulo,pagina_descricao:a.descricao,modelo:a.modelo,motorizacao:a.motor,ano_inicial:a.inicio,ano_final:a.fim,codigo_oem:a.oem,restricao:a.restricao,contraindicacao:a.contraindicacao,status:a.status,pagina_indexavel:a.visivel,modelo_id:a.modeloId,fonte:a.fonte,coletado_em:a.coletadoEm};
test("INT-102-01: projeção compartilhada mantém campos e descarta prova e preço injetados",()=>{
 const entrada={...legado,prova:a.prova,preco:999,estoque:12};
 const out=projetarAplicacaoLegada(entrada,p.sku);
 assert.equal(out.sku,p.sku);assert.equal(out.oem,a.oem);assert.equal(out.modeloId,a.modeloId);
 assert.equal(podeConsultarAplicacao(out,[ps]),true);exigeNoindex(out);
 assert.equal(Object.hasOwn(out,"preco"),false);assert.equal(Object.hasOwn(out,"estoque"),false);
});
test("INT-102-02: fonte ausente, contraditória e data inválida negam consulta nos dois destinos",()=>{
 for(const delta of [{fonte:null},{fonte:"não homologada"},{coletado_em:null},{coletado_em:"inválida"},{modelo:null},{pagina_titulo:null},{pagina_indexavel:false},{status:"pendente"}]){
  const out=projetarAplicacaoLegada({...legado,...delta},p.sku);
  assert.equal(podeConsultarAplicacao(out,[ps]),false);assert.equal(naRota(out).status,404);assert.equal(noMapa(out),false);
 }
});
test("INT-102-03: pai publicado ativo com nome e SKU é exigido, sem consultar preço",()=>{
 const out=projetarAplicacaoLegada(legado,p.sku);
 for(const pais of [[{...ps,nome:null}],[{...ps,situacao:"I"}],[{...ps,publicado:false}],[{...ps,sku:"OUTRO"}],[ps,ps],[]]){
  assert.equal(podeConsultarAplicacao(out,pais),false);assert.equal(responderSeo(caminho,loja,pais,[out]).status,404);
 }
 assert.equal(podeConsultarAplicacao(out,[{sku:ps.sku,nome:ps.nome,publicado:ps.publicado,situacao:ps.situacao}]),true);
});
test("INT-102-04: ligação estática dos adaptadores ao contrato comum e dados já existentes",()=>{
 assert.match(api,/const consulta = projetarAplicacaoLegada\(app, p\.sku\)/);
 assert.match(api,/!podeConsultarAplicacao\(consulta, \[p\]\)/);
 assert.match(api,/contraindicacao,modelo_id,fonte,coletado_em/);
 assert.match(seo,/\[projetarAplicacaoLegada\(a,sku\)\]/);
});
