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
 for(const width of [360,390,412,768,1280,1920]){
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
  assert.equal(await page.locator('[data-mobis-palette="branco-gelo"]').count(),1,"tema oficial branco-gelo ativo");
  // Modelo claro v4: banner fluido com a imagem do veículo correto de cada modelo; sem as fotos do Wikimedia nem mascotes.
  assert.equal(await page.locator('[data-mobis-visual="claro-v4"]').count(),1,"layout claro aplicado");
  const hero=page.locator('.m4-banner');
  await hero.waitFor();
  const fotosBanner=hero.locator('.m4-banner-arte img.m4-foto-veiculo');
  assert.equal(await fotosBanner.count(),3,"banner com a imagem de cada modelo");
  const origens=await fotosBanner.evaluateAll(l=>l.map(i=>i.currentSrc||i.src));
  assert.equal(new Set(origens).size,3,"nenhuma imagem de veículo repetida entre modelos");
  await fotosBanner.first().evaluate(async img=>{if(!img.complete)await new Promise((ok,erro)=>{img.addEventListener('load',ok,{once:true});img.addEventListener('error',erro,{once:true});});});
  assert.equal(await fotosBanner.first().evaluate(img=>img.naturalWidth>0),true,"imagem do veículo carrega");
  assert.equal(await page.locator('img[src*="veiculos-reais"],img[src*="mascotes"],img[src*="nano-equipe"]').count(),0,"sem as fotos do Wikimedia nem mascotes na loja");
  assert.equal(await page.locator('.mbi,.mgv,.m3-hero,.m3-faixa-sistemas').count(),0,"blocos duplicados removidos");
  assert.equal(await page.evaluate(()=>getComputedStyle(document.querySelector('.mobis-v2')).backgroundColor),'rgb(255, 255, 255)',"fundo branco");
  assert.equal(await page.locator('.m2-busca-rapida').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(255, 255, 255)',"busca rápida branca");
  const caixa=await hero.boundingBox();
  assert.ok(caixa&&caixa.width>=width-1,"banner ocupa a largura da tela em "+width+"px");
  assert.equal(await hero.evaluate(el=>el.scrollWidth<=el.clientWidth+1),true,"banner sem estouro lateral em "+width+"px");

  assert.equal(await page.locator('.m2-header').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(255, 255, 255)',"cabeçalho branco");
  await page.locator(".m4-banner h1").getByText(/Peças para utilitários diesel/i).waitFor();
  assert.ok((await page.locator(".m4-banner-texto>p").innerText()).length<100,"título e descrição curtos para o banner compacto");
  await page.getByText(/Catálogo de peças em preparação/).waitFor({timeout:10000});
  await hero.getByRole('button',{name:'Já tenho o código'}).click();
  assert.equal(await page.getByRole('tab',{name:'SKU, fabricante ou OEM'}).getAttribute('aria-selected'),'true','CTA do banner habilita modo código');
  await page.locator('#m2-pesquisar').fill('CI000120');
  const respostaCodigo=page.waitForResponse(resp=>resp.url().includes('/loja-publica')&&(resp.request().postData()||'').includes('"q":"CI000120"')&&(resp.request().postData()||'').includes('"referencia_exata":true'));
  await page.locator('.m2-search button').click();
  await respostaCodigo;
  assert.ok(requests.some(x=>x.q==='CI000120'&&x.referencia_exata===true),'busca de referência exata chega ao servidor');
  await page.getByRole('tab',{name:'Nome, peça ou sistema'}).click();
  await page.locator('#m2-pesquisar').fill('');

  const cores=await page.locator('.m2-veiculo').first().evaluate(el=>({fundo:getComputedStyle(el).backgroundColor,imagem:getComputedStyle(el).backgroundImage}));
  assert.deepEqual(cores,{fundo:'rgb(255, 255, 255)',imagem:'none'},'paleta branca prevalece sobre o tema administrativo');
  await page.getByRole('tab',{name:'O que ele precisa?',exact:true}).click();
  assert.equal(await page.locator('.m2-sistema-grade button').first().evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(255, 255, 255)','sistemas exibem superfície branca');
  await page.getByRole('tab',{name:'Qual é o seu veículo?',exact:true}).click();
  assert.equal(await page.locator('.m2-filtros').evaluate(el=>getComputedStyle(el).maxWidth),'none','filtros não herdam largura administrativa de 440px');
  if(width===1280){await page.locator('.m2-veiculo').first().hover();assert.equal(await page.locator('.m2-veiculo').first().evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(255, 255, 255)','hover preserva fundo branco');}

  assert.equal(await page.locator(".v-hero").count(),0,"layout antigo não pode ser renderizado");
  const linhas=page.locator(".m4-linha-card");
  assert.equal(await linhas.count(),4,"quatro linhas adicionais sob consulta, sem duplicar HR/Bongo/L200");
  await page.getByRole("button",{name:"Consultar peças para Iveco Daily"}).click();
  const consultaLinha=await page.locator("#m2-atendimento .m2-contato-form a").getAttribute("href");
  assert.match(decodeURIComponent(consultaLinha||""),/Iveco Daily/,"consulta comercial inclui a linha escolhida");
  assert.equal(await page.locator(".m4-banner-campanha").count(),0,"sem campanha ativa não existe oferta simulada no banner");
  assert.equal(await page.locator(".m2-veiculo").count(),4,"três modelos e consulta a outros modelos");
  assert.equal(await page.locator(".m2-veiculo img.m4-foto-veiculo").count(),3,"cada modelo com a imagem do veículo correto");
  assert.equal(new Set(await page.locator(".m2-veiculo img").evaluateAll(l=>l.map(i=>i.currentSrc||i.src))).size,3,"nenhuma imagem repetida nos cartões");
  await page.getByRole('tab',{name:'O que ele precisa?',exact:true}).click();
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
  for(const [nome,id] of [["Catálogo de produtos","m2-catalogo"],["Buscar por veículo","m2-busca"],["Categorias de peças","m2-explorar"],["Voltar aos produtos ↑","m2-catalogo"]]){
   const link=page.getByRole("link",{name:nome,exact:true});
   assert.equal(await link.getAttribute("href"),"#/loja/mobis","abrir em outra aba também mantém a loja");
   await link.click();
   assert.equal(new URL(page.url()).hash,"#/loja/mobis","rodapé não pode sair da vitrine");
   await page.waitForFunction(id=>{const y=document.getElementById(id)?.getBoundingClientRect().top;return y!==undefined&&y>=-1&&y<innerHeight;},id,{timeout:8000}).catch(async e=>{throw new Error('rolagem falhou para '+nome+' ('+id+') top='+await page.evaluate(i=>document.getElementById(i)?.getBoundingClientRect().top,id)+' w='+width)});
   assert.equal(await page.locator('[data-mobis-layout="aprovado-v2"]').count(),1);
  }
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
