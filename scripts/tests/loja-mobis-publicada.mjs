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
  // Modelo claro v4: banner fluido com a imagem do veículo correto de cada modelo; sem as fotos do Wikimedia nem mascotes.
  assert.equal(await page.locator('[data-mobis-visual="claro-v4"]').count(),1,"layout claro publicado");
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

  assert.equal(await page.locator('.m2-header').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(255, 255, 255)',"cabeçalho publicado é branco");
  assert.equal(await page.locator(".v-hero").count(),0);
  const r=await consulta;assert.equal(r.status(),200,"catálogo público deve carregar");
  const dados=await r.json();assert.equal(dados.loja.slug,"mobis");
  assert.equal(dados.loja.ambiente,"teste","loja deve permanecer em teste");
  assert.notEqual(dados.loja.venda_habilitada,true,"vendas não podem estar habilitadas");
  await page.locator(".m2-aviso-teste").waitFor();
  for(const bloco of ["cabecalho","banner","montadoras","taxonomia","filtros","produtos","privacidade"]){
    assert.equal(await page.locator('[data-bloco="'+bloco+'"]').count(),1,"bloco real "+bloco);
  }
  assert.equal(await page.locator(".m4-montadora-item").count(),9,"nove montadoras de atendimento");
  assert.ok(await page.locator(".m4-taxonomia-item").count()>0,"taxonomia e consultas carregam");
  assert.equal(await page.locator(".m4-montadora-item").first().evaluate(el=>getComputedStyle(el).backgroundColor),"rgb(255, 255, 255)","bloco de montadoras branco");
  assert.equal(await page.locator(".m4-taxonomia-item").first().evaluate(el=>getComputedStyle(el).backgroundColor),"rgb(255, 255, 255)","bloco de taxonomia branco");
  assert.equal(await page.locator(".m2-filtros").evaluate(el=>getComputedStyle(el).maxWidth),"none","filtros sem largura administrativa de 440px");
  assert.equal(await page.locator(".m4-banner-arte img.m4-foto-veiculo").count(),3,"fotografias dos três modelos mantidas");
  assert.equal(await page.locator(".m4-linha-card,.m2-veiculo-grade").count(),0,"seções repetidas não aparecem");
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
