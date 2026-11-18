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
  const hero=page.locator('.gcv3');
  await hero.waitFor();
  const fotos=[];
  const quantidade=await hero.locator('.gcv3-topo > span').last().textContent();
  if(/\/\s*03/.test(quantidade||"")) {
    for(let i=0;i<3;i++){
      const img=hero.locator('.gcv3-midia img');
      await img.waitFor();
      await img.evaluate(async i=>{if(!i.complete)await new Promise((ok,erro)=>{i.addEventListener('load',ok,{once:true});i.addEventListener('error',erro,{once:true});});});
      assert.equal(await img.evaluate(i=>i.naturalWidth>0),true,"fotografia de veículo carregou");
      fotos.push(await img.getAttribute("src"));
      await hero.getByRole('button',{name:"Próximo destaque"}).click();
    }
    assert.equal(new Set(fotos).size,3,"modelos distintos no carrossel sem repetir foto");
  }
  assert.equal(await page.locator('img[src*="veiculos-reais"],img[src*="mascotes"],img[src*="nano-equipe"]').count(),0,"sem as fotos do Wikimedia nem mascotes na loja");
  assert.equal(await page.locator('.mbi,.mgv,.m3-hero,.m3-faixa-sistemas').count(),0,"blocos duplicados removidos");

  assert.equal(await page.locator('.m2-header').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(255, 255, 255)',"cabeçalho publicado é branco");
  assert.equal(await page.locator(".v-hero").count(),0);
  const r=await consulta;assert.equal(r.status(),200,"catálogo público deve carregar");
  const dados=await r.json();assert.equal(dados.loja.slug,"mobis");
  assert.equal(dados.loja.ambiente,"teste","loja deve permanecer em teste");
  assert.notEqual(dados.loja.venda_habilitada,true,"vendas não podem estar habilitadas");
  assert.equal(await page.locator(".m2-aviso-teste").count(),0,"aviso de ambiente de teste removido da vitrine (pedido do dono)");
  for(const bloco of ["cabecalho","banner","montadoras","taxonomia","filtros","produtos","rodape"]){
    assert.equal(await page.locator('[data-bloco="'+bloco+'"]').count(),1,"bloco real "+bloco);
  }
  assert.equal(await page.locator(".m4-montadora-item").count(),9,"nove montadoras de atendimento");
  assert.ok(await page.locator(".m4-taxonomia-item").count()>0,"taxonomia e consultas carregam");
  // A paleta aprovada e publicada pode usar fundo branco ou branco-gelo. Os cartões
  // devem acompanhar exatamente o token de fundo aplicado na raiz da vitrine,
  // sem obrigar #fff quando o cliente publicou #f6f7f8.
  const fundoAprovado=await page.locator(".mobis-v2.m4").evaluate(el=>
    el.getAttribute("data-paleta-publicada")==="sim"
      ?getComputedStyle(el).backgroundColor
      :"rgb(255, 255, 255)");
  assert.equal(await page.locator(".m4-montadora-item").first().evaluate(el=>getComputedStyle(el).backgroundColor),fundoAprovado,"bloco de montadoras respeita a paleta publicada");
  assert.equal(await page.locator(".m4-taxonomia-item").first().evaluate(el=>getComputedStyle(el).backgroundColor),fundoAprovado,"bloco de taxonomia respeita a paleta publicada");
  assert.equal(await page.locator(".m2-filtros").evaluate(el=>getComputedStyle(el).maxWidth),"none","filtros sem largura administrativa de 440px");
  assert.equal(await page.locator(".gcv3").count(),1,"uma única vitrine dinâmica sem hero duplicado");
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
