// Homologação somente de leitura da publicação real. Nunca simula o catálogo.
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const root=new URL("../../",import.meta.url).pathname;
const require=createRequire(root+"painel/package.json"),{chromium}=require("playwright");
const base="https://nanoconecta-ia.github.io/conecta-ia/";
const esperado=process.env.GITHUB_SHA?.slice(0,7);
assert.ok(esperado,"GITHUB_SHA identifica o release esperado");
let versao;
for(let i=0;i<18;i++){
 const r=await fetch(base+"version.json?release="+esperado+"&tentativa="+i,{cache:"no-store"});
 if(r.ok){versao=await r.json();if(versao.commit===esperado)break;}
 await new Promise(r=>setTimeout(r,5000));
}
assert.equal(versao?.commit,esperado,"version.json deve corresponder ao commit publicado");
const dir=root+"evidencias-publicacao/";await mkdir(dir,{recursive:true});
const browser=await chromium.launch({headless:true});
const resultados=[];
try{
 for(const width of [360,390,412,1280]){
  const context=await browser.newContext({viewport:{width,height:844},serviceWorkers:"block"});
  const page=await context.newPage(),errors=[],rede=[];page.on("pageerror",e=>errors.push(e.message));
  page.on("requestfailed",r=>rede.push({url:r.url(),erro:r.failure()?.errorText}));
  const cdp=await context.newCDPSession(page);
  await cdp.send("Network.enable");await cdp.send("Network.setCacheDisabled",{cacheDisabled:true});
  try{
  const consulta=page.waitForResponse(r=>r.url().endsWith("/functions/v1/loja-publica"),{timeout:45000});
  await page.goto(base+"?release="+esperado+"#/loja/mobis");
  await page.locator('[data-mobis-layout="aprovado-v2"]').waitFor();
  assert.equal(await page.locator('[data-mobis-palette="branco-gelo"]').count(),1,"publicação usa paleta branca");
  assert.equal(await page.locator('.m2-header').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(255, 255, 255)',"cabeçalho publicado é branco");
  assert.equal(await page.locator('.mgv').evaluate(el=>getComputedStyle(el).color),'rgb(31, 35, 39)',"glassy publicado é claro");
  assert.equal(await page.locator(".v-hero").count(),0);
  const r=await consulta;assert.equal(r.status(),200,"catálogo público deve carregar");
  const dados=await r.json();assert.equal(dados.loja.slug,"mobis");
  assert.equal(dados.loja.ambiente,"teste","loja deve permanecer em teste");
  assert.notEqual(dados.loja.venda_habilitada,true,"vendas não podem estar habilitadas");
  await page.locator(".m2-aviso-teste").waitFor();
  // Glassy V2 na loja comercial: ícones oficiais, navegação e CTA sem publicar produtos.
  const glassy=page.locator(".mgv");
  await glassy.waitFor();
  assert.equal(await glassy.locator(".mgv-miniatura").count(),6,"seis sistemas visuais aprovados");
  await glassy.getByRole("button",{name:"Próximo sistema"}).click();
  assert.match(await glassy.locator(".mgv-copy h3").innerText(),/Suspensão/);
  await glassy.getByRole("button",{name:"Exibir categoria Motores diesel"}).click();
  assert.match(await glassy.locator(".mgv-copy h3").innerText(),/Motores diesel/);
  assert.equal(await glassy.locator(".mgv-imagem .ico-3d").count(),1,"usar ícone 3D da Mobis");
  assert.equal(await glassy.locator(".mgv").count(),0,"não aninhar carrossel na própria raiz");

  const cores=await page.locator('.m2-veiculo').first().evaluate(el=>({fundo:getComputedStyle(el).backgroundColor,imagem:getComputedStyle(el).backgroundImage}));
  assert.deepEqual(cores,{fundo:'rgb(255, 255, 255)',imagem:'none'},'paleta branca prevalece sobre o tema administrativo');
  await page.getByRole("tab",{name:"O que ele precisa?",exact:true}).click(); // sistemas ficam na aba "O que ele precisa?" desde o #335
  assert.equal(await page.locator('.m2-sistema-grade button').first().evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(255, 255, 255)','sistemas exibem superfície branca');
  assert.equal(await page.locator('.m2-filtros').evaluate(el=>getComputedStyle(el).maxWidth),'none','filtros não herdam largura administrativa de 440px');
  if(width===1280){await page.getByRole("tab",{name:"Qual é o seu veículo?",exact:true}).click();await page.locator('.m2-veiculo').first().hover();assert.equal(await page.locator('.m2-veiculo').first().evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(255, 255, 255)','hover preserva fundo branco');}

  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,"sem overflow "+width);
  assert.deepEqual(errors,[]);
  resultados.push({width,layout:"aprovado-v2",catalogo:r.status(),produtos:dados.total,erros:errors});
  console.log("PUBLICADA "+width+"px OK "+esperado);
  }catch(e){resultados.push({width,erro:String(e),erros:errors,rede});throw e;}
  finally{await page.screenshot({path:dir+"mobis-publicada-"+width+".png",fullPage:true}).catch(()=>{});await context.close();}
 }
}finally{
 await browser.close();await writeFile(dir+"resultado.json",JSON.stringify({versao,resultados},null,2));
}
