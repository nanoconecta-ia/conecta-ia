// Regressão Android da página Mobis (somente dados sintéticos; jamais acessa o Bling).
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import assert from "node:assert/strict";
const root=new URL("../../",import.meta.url).pathname,painel=root+"painel/";
const require=createRequire(painel+"package.json"),{chromium}=require("playwright");
const port=4219,base="http://127.0.0.1:"+port,lojaId="aaaaaaaa-0000-0000-0000-000000000001";
const session={access_token:"s.s.s",refresh_token:"s",token_type:"bearer",expires_in:3600,
 expires_at:Math.floor(Date.now()/1000)+3600,user:{id:"11111111-1111-1111-1111-111111111111",
 aud:"authenticated",role:"authenticated",email:"demo@exemplo.invalid",app_metadata:{},user_metadata:{},created_at:"2026-01-01T00:00:00Z"}};
const server=spawn(process.execPath,[painel+"node_modules/vite/bin/vite.js","--host","127.0.0.1","--port",String(port)],{cwd:painel,stdio:"ignore"});
let browser;
try {
 for(let i=0;i<100;i++){try{if((await fetch(base+"/")).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
 browser=await chromium.launch({headless:true});
 await mkdir(root+"evidencias-chat",{recursive:true});
 for(const [width,height,scale] of [[360,740,100],[390,844,100],[412,915,100],[360,700,140]]){
  const context=await browser.newContext({viewport:{width,height}});
  const page=await context.newPage(),errors=[];
  page.on("pageerror",e=>errors.push(e.message));
  await page.addInitScript((s)=>{
   localStorage.setItem("sb-dsfzhsrudriqkumtlqwj-auth-token",JSON.stringify(s));
   localStorage.setItem("conecta:balao",JSON.stringify({lado:"dir",y:92}));
  },session);
  await page.route("**/*",async route=>{
   const req=route.request(),u=new URL(req.url());
   if(u.hostname==="127.0.0.1")return route.continue();
   assert.ok(u.hostname.endsWith(".supabase.co"),"Rede fora da simulação: "+u.hostname);
   const h={"access-control-allow-origin":"*","access-control-allow-headers":"*",
    "access-control-allow-methods":"*","access-control-expose-headers":"content-range"};
   if(req.method()==="OPTIONS")return route.fulfill({status:204,headers:h});
   if(u.pathname.endsWith("/auth/v1/user"))return route.fulfill({status:200,contentType:"application/json",headers:h,body:JSON.stringify(session.user)});
   if(u.pathname.endsWith("/rest/v1/lojas"))return route.fulfill({status:200,contentType:"application/json",headers:h,body:JSON.stringify([
    {id:lojaId,nome:"Mobis · DEMONSTRAÇÃO",slug:"mobis",ambiente:"teste",modo_venda:"whatsapp",ativa:true,perfil_ramo:"autopecas"}
   ])});
   if(u.pathname.endsWith("/rest/v1/produtos"))return route.fulfill({status:200,contentType:"application/json",
    headers:{...h,"content-range":"0-1/2"},body:JSON.stringify([
     {id:"b1",sku:"DEMO-100",nome:"Bomba d'água de teste",marca:"DEMONSTRAÇÃO",publicado:false,taxonomia_no_id:null},
     {id:"b2",sku:"DEMO-101",nome:"Radiador de teste",marca:"DEMONSTRAÇÃO",publicado:false,taxonomia_no_id:null}
    ])});
   if(u.pathname.endsWith("/rest/v1/produto_aplicacoes")||u.pathname.endsWith("/rest/v1/aprovacoes"))
    return route.fulfill({status:200,contentType:"application/json",headers:{...h,"content-range":"*/0"},body:"[]"});
   return route.fulfill({status:200,contentType:"application/json",headers:h,body:u.pathname.includes("/rest/v1/")?"[]":"{}"});
  });
  await page.goto(base+"/");
  if(scale!==100)await page.addStyleTag({content:"html{font-size:"+scale+"% !important}"});
  await page.locator(".ca-pagina .ca-titulo h1").waitFor({state:"visible",timeout:20000});
  await page.locator(".ca-metricas .ca-metrica").first().waitFor();
  const ball=page.locator(".balao-genesis");await ball.waitFor({state:"visible"});
  await page.waitForTimeout(150);
  const b=await ball.boundingBox(),title=await page.locator(".ca-titulo").boundingBox();
  assert.ok(b&&title,"Balão e título presentes");
  const overlap=(a,c)=>Math.max(0,Math.min(a.x+a.width,c.x+c.width)-Math.max(a.x,c.x))*
    Math.max(0,Math.min(a.y+a.height,c.y+c.height)-Math.max(a.y,c.y));
  assert.ok(overlap(b,title)<2,"Nano não cobre título: "+width+" "+JSON.stringify({b,title}));
  assert.ok(b.y>height/2,"Nano fica no canto inferior "+width);
  assert.ok(b.x>=0&&b.x+b.width<=width+1&&b.y>=0&&b.y+b.height<=height+1,"Balão dentro da tela");
  assert.ok(b.width<=68&&b.height<=68,"Balão compacto");
  const ctas=await page.locator(".ca-topo-acoes a").all();
  assert.equal(ctas.length,3,"Indexar, espelho e revisar");
  for(let i=0;i<ctas.length;i++){
   const a=await ctas[i].boundingBox();
   assert.ok(a&&a.width>95&&a.height>=42&&a.x>=0&&a.x+a.width<=width+1,"CTA dentro da largura");
   for(let j=0;j<i;j++){const outro=await ctas[j].boundingBox();assert.ok(overlap(a,outro)<2,"CTAs separados");}
  }
  assert.equal(await page.locator(".ca-brand img").isVisible(),true,"Logo Mobis visível no banner");
  assert.equal(await page.locator(".barra-status").evaluate(el=>getComputedStyle(el).display),"none","Barra de status fora do caminho");
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,"Sem scroll horizontal");
  assert.equal(await page.locator(".ca-metricas .ca-metrica").count(),4,"Quatro indicadores");
  assert.deepEqual(errors,[],"Sem erros JS");
  await page.screenshot({path:root+"evidencias-chat/mobis-aplicacao-"+width+"-"+scale+"-SIMULADO.png"});
  await context.close();
  console.log("MOBIS MOBILE OK "+width+"x"+height+"@"+scale+"%: Nano, CTA, logo e métricas sem sobreposição");
 }
}finally{await browser?.close();server.kill("SIGTERM");}
