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
 browser=await chromium.launch({headless:true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? {executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH} : {})});
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
 // O bug do PR #318 ocorre na raiz do domínio, sem hash. Servimos o mesmo
 // frontend local sob hosts simulados; nenhum DNS ou serviço real é alterado.
 for(const host of ["mobisautopecas.com.br","www.mobisautopecas.com.br"]){
  for(const width of [360,390,412,1280]){
   const context=await browser.newContext({viewport:{width,height:844},serviceWorkers:"block"});
   const page=await context.newPage(),errors=[],requests=[];
   page.on("pageerror",err=>errors.push(err.message));
   const fixture={...payload,veiculos:[{modelo:"HR",motor:"D4CB",de:2013,ate:2022},{modelo:"Bongo",motor:"D4BH",de:2006,ate:2011}],
    categorias:[{nome:"Motor",slug:"motor",total:1}],total:1,
    produtos:[{sku:"TESTE-SINTETICO",nome:"Peça sintética para teste",preco:null,marca:null,descricao:null,imagem:null,whatsapp:null,em_estoque:null,atualizado_em:null}]};
   await page.route("**/*",async route=>{
    const req=route.request(),url=new URL(req.url());
    if(url.hostname===host){
     const response=await fetch(base+url.pathname+url.search);
     return route.fulfill({status:response.status,contentType:response.headers.get("content-type")??"text/plain",body:Buffer.from(await response.arrayBuffer())});
    }
    if(url.hostname.endsWith("supabase.co")&&url.pathname.endsWith("/functions/v1/loja-publica")){
     requests.push(JSON.parse(req.postData()||"{}"));
     return route.fulfill({status:200,contentType:"application/json",headers:{"access-control-allow-origin":"*"},body:JSON.stringify(fixture)});
    }
    return route.abort();
   });
   await page.goto("https://"+host+"/");
   await page.getByRole("heading",{name:"Peça sintética para teste"}).waitFor();
   assert.equal(await page.locator('[data-mobis-layout="aprovado-v2"]').count(),1);
   assert.equal(await page.locator(".v-hero").count(),0);
   await page.locator(".m2-filtros-grid select").nth(0).selectOption("HR");
   await page.locator(".m2-filtros-grid select").nth(1).selectOption("D4CB");
   assert.equal(await page.locator(".m2-filtros-grid select").nth(1).locator("option").filter({hasText:"D4BH"}).count(),0,"motores respeitam modelo");
   await page.locator(".m2-filtros-grid input").fill("2019");
   await page.locator(".m2-filtros-grid select").nth(2).selectOption("motor");
   const resposta=page.waitForResponse(r=>r.url().endsWith("/loja-publica")&&(r.request().postData()||"").includes('"motor":"D4CB"'));
   await page.getByRole("button",{name:"Aplicar filtros",exact:true}).click();await resposta;
   assert.ok(requests.some(x=>x.slug==="mobis"&&x.modelo==="HR"&&x.motor==="D4CB"&&x.ano===2019&&x.categoria==="motor"));
   await page.getByRole("button",{name:"Adicionar à lista +",exact:true}).click();
   const link=page.getByRole("link",{name:"Consultar no WhatsApp",exact:false});
   assert.match(await link.getAttribute("href"),/TESTE-SINTETICO/);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,"sem overflow no domínio "+width);
   assert.deepEqual(errors,[]);
   await context.close();
   console.log("DOMÍNIO SIMULADO "+host+" "+width+"px OK: layout, catálogo, cascata e consulta");
  }
 }
} finally {await browser?.close();server.kill("SIGTERM");}
