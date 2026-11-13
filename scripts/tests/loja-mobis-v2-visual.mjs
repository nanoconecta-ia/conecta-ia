// Regressão visual REAL do novo layout comercial Mobis, sem dados de clientes nem API Bling real.
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import assert from "node:assert/strict";
const root=new URL("../../",import.meta.url).pathname,painel=root+"painel/";
const require=createRequire(painel+"package.json"),{chromium}=require("playwright");
const base="http://127.0.0.1:4243";
const payload={
  loja:{nome:"Mobis Autopeças — TESTE SINTÉTICO",slug:"mobis",ambiente:"teste",modo_venda:"catalogo",whatsapp:"5562991654515",venda_habilitada:false},
  produtos:[],banners:[],veiculos:[],categorias:[],total:0,pagina:1,por_pagina:24,
  politicas:null
};
const server=spawn(process.execPath,[painel+"node_modules/vite/bin/vite.js","--host","127.0.0.1","--port","4243"],{cwd:painel,stdio:"ignore"});
let browser;
try{
 for(let i=0;i<100;i++){try{if((await fetch(base+"/")).ok)break}catch{}await new Promise(r=>setTimeout(r,110))}
 browser=await chromium.launch({headless:true});
 await mkdir(root+"evidencias-chat",{recursive:true});
 for(const width of [360,390,412,1280]){
  const context=await browser.newContext({viewport:{width,height:844}});
  const page=await context.newPage(),errors=[],requests=[];
  page.on("pageerror",err=>errors.push(err.message));
  await page.route("**/*",async route=>{
   const req=route.request(),url=new URL(req.url());
   if(url.hostname==="127.0.0.1")return route.continue();
   if(url.hostname.endsWith("supabase.co")&&url.pathname.endsWith("/functions/v1/loja-publica")){
     const body=JSON.parse(req.postData()||"{}");requests.push(body);
     return route.fulfill({status:200,contentType:"application/json",headers:{"access-control-allow-origin":"*"},body:JSON.stringify(payload)});
   }
   // Nenhum contato com plataformas reais neste teste.
   return route.abort();
  });
  await page.goto(base+"/#/loja/mobis");
  await page.locator('[data-mobis-layout="aprovado-v2"]').waitFor({state:"visible",timeout:20000});
  await page.getByRole("heading",{name:/Peças para quem trabalha/}).waitFor();
  await page.getByText(/Nenhuma peça disponível nessa busca/).waitFor({timeout:10000});
  assert.equal(await page.locator(".v-hero").count(),0,"layout antigo não pode ser renderizado");
  assert.equal(await page.locator(".m2-veiculo").count(),4,"4 opções de veículos");
  assert.equal(await page.locator(".m2-sistema-grade button").count(),8,"8 módulos de peças");
  assert.equal(await page.locator(".m2-aviso-teste").isVisible(),true,"loja continua em teste");
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),true,
    "sem rolagem horizontal para "+width+"px");
  assert.deepEqual(errors,[],"sem erros JS de layout");
  await page.screenshot({path:root+"evidencias-chat/loja-mobis-v2-"+width+"-SIMULADO.png",fullPage:width===390});
  await page.locator("#m2-pesquisar").fill("D4CB");
  const respostaBusca=page.waitForResponse(resp=>resp.url().includes("/loja-publica") && (resp.request().postData()||"").includes('"q":"D4CB"'));
  await page.locator(".m2-search button").click();
  await respostaBusca;
  assert.ok(requests.some(x=>x.q==="D4CB"&&x.slug==="mobis"),"busca conecta à API da loja");
  assert.equal(await page.getByRole("heading",{name:"Indexar e enriquecer"}).count(),0,"não expor painel privado");
  await context.close();
  console.log("MOBIS NOVO LAYOUT "+width+"px OK: rota pública, filtros, não publicado, responsivo");
 }
} finally {await browser?.close();server.kill("SIGTERM");}
