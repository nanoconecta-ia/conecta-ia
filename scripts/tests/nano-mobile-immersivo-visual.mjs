// Nano.IA: chat ocupa a area util no smartphone sem moldura ficticia.
// Teste visual real da rota App + dados 100% sinteticos; nada sai para producao.
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import assert from "node:assert/strict";
const root = new URL("../../", import.meta.url).pathname, painel = root + "painel/";
const require = createRequire(painel + "package.json"), { chromium } = require("playwright");
const porta = 4198, base = `http://127.0.0.1:${porta}`;
const ref = "dsfzhsrudriqkumtlqwj";
const servidor = spawn(process.execPath, [painel+"node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", String(porta)], { cwd:painel, stdio:"ignore" });
let browser;
try {
  for(let i=0;i<100;i++) { try { if((await fetch(base+"/")).ok) break; } catch {} await new Promise(r=>setTimeout(r,100)); }
  browser = await chromium.launch({ headless:true });
  for(const [largura, altura] of [[300,640],[360,740],[390,844],[780,360]]) {
    const page = await browser.newPage({ viewport:{width:largura,height:altura} }), erros = [];
    page.on("pageerror", e=>erros.push(e.message));
    const sessao = { access_token:"sintetico.sintetico.sintetico",refresh_token:"sintetico",token_type:"bearer",expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user:{id:"11111111-1111-1111-1111-111111111111",aud:"authenticated",role:"authenticated",email:"demo@exemplo.invalid",app_metadata:{},user_metadata:{},created_at:"2026-01-01T00:00:00Z"} };
    await page.addInitScript(([k,v])=>localStorage.setItem(k,v), [`sb-${ref}-auth-token`, JSON.stringify(sessao)]);
    await page.route("**/*", async route=>{
      const u=new URL(route.request().url());
      if(u.hostname==="127.0.0.1") return route.continue();
      if(!u.hostname.endsWith("supabase.co")) throw Error("Rede proibida no teste: "+u.hostname);
      const h={"access-control-allow-origin":"*","access-control-allow-headers":"*","access-control-allow-methods":"*"};
      if(route.request().method()==="OPTIONS") return route.fulfill({status:204,headers:h});
      let dados={};try{dados=JSON.parse(route.request().postData()||"{}")}catch{}
      let body={};
      if(u.pathname.endsWith("/rest/v1/lojas")) body=[{id:"aaaaaaaa-0000-0000-0000-000000000001",nome:"Loja SIMULADA",slug:"loja-sintetica",modo_venda:"whatsapp",ambiente:"teste",perfil_ramo:null}];
      else if(u.pathname.endsWith("/functions/v1/assistente")) body=dados.acao==="provedores" ? {verificado:true,provedores:[{id:"gemini",nome:"Gemini",modelo:"gemini-sintetico",estado:"disponivel",principal:true}]} : dados.acao==="chat_config" ? {persistente:true,bling:true,leitura_administrativa:false,retencao_dias:180} : {conversas:[]};
      else if(u.pathname.endsWith("/auth/v1/user")) body=sessao.user;
      else if(u.pathname.includes("/rest/v1/")) body=[];
      return route.fulfill({status:200,contentType:"application/json",headers:h,body:JSON.stringify(body)});
    });
    await page.goto(base+"/#/assistente");
    const cab=page.locator(".topo--nano-chat"), painel=page.locator(".layout--nano-chat"), chat=page.locator(".abas-centro > .chat");
    await cab.waitFor();await chat.waitFor();await page.getByRole("button",{name:"Abrir menu do Nano.IA"}).waitFor();
    const medidas=await page.evaluate(()=>{
      const rect=s=>{const r=document.querySelector(s).getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:r.height,left:r.left,right:r.right};};
      return {topo:rect(".topo--nano-chat"),layout:rect(".layout--nano-chat"),chat:rect(".abas-centro > .chat"),campo:rect(".compositor-campo textarea"),enviar:rect(".compositor-enviar"),footer:getComputedStyle(document.querySelector(".barra-status")).display,scroll:document.documentElement.scrollWidth};
    });
    assert.equal(medidas.footer,"none","sem barra de status ocupando o chat");
    assert.ok(medidas.topo.height<=60,"cabeçalho reduzido "+JSON.stringify(medidas));
    assert.ok(Math.abs(medidas.layout.bottom-altura)<=2,"chat ate rodape real "+JSON.stringify(medidas));
    assert.ok(medidas.chat.height>=Math.min(140,altura*.20),"historico utilizavel "+JSON.stringify(medidas));
    assert.ok(medidas.campo.bottom<=altura+1 && medidas.enviar.bottom<=altura+1,"campo e Enviar visiveis "+JSON.stringify(medidas));
    assert.ok(medidas.scroll<=largura+1,"sem scroll horizontal "+JSON.stringify(medidas));
    assert.equal(await page.locator(".nano-mini-agentes .nano-mini-acao").count(),3,"atalhos para modulos existentes");
    await page.getByRole("button",{name:"Abrir menu do Nano.IA"}).click();
    const drawer=page.locator(".nano-navegacao");
    await drawer.locator(".nano-pasta-principal[open]").waitFor();
    const nested=drawer.locator(".nano-pasta-nivel2").filter({hasText:"Catálogo e conteúdo"});
    assert.equal(await nested.count(),1,"ferramentas em segundo nivel");
    await nested.locator("summary").click();
    await nested.getByRole("button",{name:"Catálogo",exact:true}).waitFor();
    await page.getByRole("button",{name:"Fechar menu",exact:true}).click();
    await page.getByRole("button",{name:"Modelo e privacidade",exact:true}).click();
    await page.locator("#aba-modelo").waitFor({state:"visible"});
    await page.getByRole("button",{name:"Recolher modelo e privacidade"}).click();
    await mkdir(root+"evidencias-chat",{recursive:true});
    await page.screenshot({path:root+`evidencias-chat/nano-immersivo-${largura}.png`});
    assert.deepEqual(erros,[],"sem erros JS");
    await page.close();
  }
  console.log("nano-mobile-immersivo-visual ok (300, 360, 390 px e paisagem; altura, menus aninhados, modelo e compositor)");
} finally {await browser?.close();servidor.kill("SIGTERM");}
