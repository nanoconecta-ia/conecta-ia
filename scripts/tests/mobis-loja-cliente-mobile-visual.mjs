// Loja Mobis: navegação de cliente, política não aprovada, banner e lista por SKU.
// Usa somente dados sintéticos; nenhum contato com Bling/Supabase real.
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import assert from "node:assert/strict";
const root=new URL("../../",import.meta.url).pathname,painel=root+"painel/";
const require=createRequire(painel+"package.json"),{chromium}=require("playwright");
const port=4224,base="http://127.0.0.1:"+port;
const ficha={
 nome:"Bomba de água — TESTE SINTÉTICO",sku:"TESTE-001",preco:385.99,
 em_estoque:null,marca:"MARCA DE TESTE",descricao:"Descrição técnica homologada de demonstração",
 imagem:null,whatsapp:"https://wa.me/5562991654515?text=Consulta%20TESTE-001",atualizado_em:"2026-11-01T12:00:00Z"
};
const banner={sku:ficha.sku,nome:ficha.nome,preco:ficha.preco,chamada:"Conferir aplicação antes de comprar",
 flash:true,whatsapp:ficha.whatsapp,url:null};
const dados={
 loja:{nome:"Mobis Autopeças",slug:"mobis",modo_venda:"catalogo",ambiente:"teste",
 venda_habilitada:false,aviso_teste:"LOJA EM TESTE",whatsapp:"5562991654515"},
 banners:[banner,{...banner,sku:"TESTE-002",nome:"Radiador — TESTE SINTÉTICO",flash:false}],
 tema:{variaveis:{},logo_url:null,icone_url:null},
 politicas:null,produtos:[ficha],total:1,pagina:1,por_pagina:24,
 veiculos:[{modelo:"HR",motor:"D4CB",de:2013,ate:2022}],
 tipos:[],categorias:[{nome:"Arrefecimento",slug:"arrefecimento",total:1}],
 ficha:{veiculos:[{modelo:"HR",motor:"D4CB",de:2013,ate:2022,tipo:null}]}
};
const server=spawn(process.execPath,[painel+"node_modules/vite/bin/vite.js","--host","127.0.0.1","--port",String(port)],
 {cwd:painel,stdio:"ignore"});
let browser;
try {
 for(let n=0;n<90;n++){try{if((await fetch(base+"/")).ok)break}catch{}await new Promise(r=>setTimeout(r,120))}
 browser=await chromium.launch({headless:true});
 await mkdir(root+"evidencias-chat",{recursive:true});
 for(const width of [360,390,412]){
  const context=await browser.newContext({viewport:{width,height:840}});
  const page=await context.newPage(),erros=[],outbound=[];
  page.on("pageerror",err=>erros.push(err.message));
  await page.route("**/*",async route=>{
   const req=route.request(),url=new URL(req.url());
   if(url.hostname==="127.0.0.1")return route.continue();
   outbound.push(req.url());
   if(url.pathname.endsWith("/functions/v1/loja-publica"))
    return route.fulfill({status:200,contentType:"application/json",
     headers:{"access-control-allow-origin":"*"},body:JSON.stringify(dados)});
   if(url.hostname.endsWith("supabase.co"))
    return route.fulfill({status:200,contentType:"application/json",
     headers:{"access-control-allow-origin":"*"},body:"{}"});
   return route.abort();
  });
  await page.goto(base+"/#/loja/mobis");
  await page.getByRole("heading",{name:"Encontre a peça correta"}).waitFor({timeout:20000});
  assert.equal(await page.locator(".v-modulos-cliente button").count(),7,"sete módulos de cliente");
  assert.equal(await page.getByText("Demonstração do banner · Loja teste").isVisible(),true,"banner é prévia");
  assert.equal(await page.getByRole("button",{name:"Pausar rotação"}).count(),1,"controle flash pausável");
  await page.getByRole("button",{name:"Adicionar à lista"}).click();
  assert.equal(await page.getByRole("heading",{name:"Minha lista de consulta"}).isVisible(),true,"lista sem checkout");
  const link=await page.getByRole("link",{name:"Consultar no WhatsApp"}).last().getAttribute("href");
  assert.ok(link && link.includes("TESTE-001"),"SKU é repassado na consulta");
  assert.ok(link && !link.includes("bling_id"),"ID do Bling não aparece");
  assert.equal(await page.getByRole("button",{name:"Adicionar à lista"}).count(),0,"não duplicar mesmo SKU");
  assert.equal(await page.getByRole("button",{name:/Privacidade — aguardando aprovação/}).isDisabled(),true,"rascunho bloqueado");
  assert.equal(await page.getByText("As políticas comerciais da loja ainda não foram aprovadas.").count(),0,
    "a mensagem real vem acompanhada de orientação, sem texto jurídico não aprovado");
  assert.equal(await page.locator(".v-rodape-politica-link button").count(),5,"cinco políticas visíveis");
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,"sem overflow horizontal");
  assert.deepEqual(erros,[],"sem erro JavaScript");
  await page.screenshot({path:root+"evidencias-chat/loja-mobis-cliente-"+width+"-SIMULADO.png"});
  await page.getByRole("link",{name:"Ver ficha e aplicações"}).click();
  await page.getByRole("heading",{name:/Atendimento da loja/}).waitFor({timeout:15000});
  assert.equal(await page.locator(".v-rodape-politica-link button").count(),5,"mesmas políticas na ficha individual");
  assert.equal(await page.getByRole("link",{name:"Voltar ao catálogo"}).count(),1,"voltar funciona");
  await context.close();
  console.log("MOBIS CLIENTE "+width+"px OK: banners, privacidade, lista e ficha em modo teste");
 }
}finally{await browser?.close();server.kill("SIGTERM");}
