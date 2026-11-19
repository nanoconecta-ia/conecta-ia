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
  const hero=page.locator('.gcv3');
  await hero.waitFor();
  const origens=[];
  for(let i=0;i<3;i++){
    const foto=hero.locator('.gcv3-midia img');
    await foto.waitFor();
    await foto.evaluate(async img=>{if(!img.complete)await new Promise((ok,erro)=>{img.addEventListener('load',ok,{once:true});img.addEventListener('error',erro,{once:true});});});
    assert.equal(await foto.evaluate(img=>img.naturalWidth>0),true,"foto real de veículo carrega");
    origens.push(await foto.getAttribute('src'));
    await hero.getByRole('button',{name:'Próximo destaque'}).click();
  }
  assert.equal(new Set(origens).size,3,"três veículos diferentes passam pelo carrossel");
  assert.equal(await page.locator('img[src*="veiculos-reais"],img[src*="mascotes"],img[src*="nano-equipe"]').count(),0,"sem as fotos do Wikimedia nem mascotes na loja");
  assert.equal(await page.locator('.mbi,.mgv,.m3-hero,.m3-faixa-sistemas').count(),0,"blocos duplicados removidos");
  assert.equal(await page.evaluate(()=>getComputedStyle(document.querySelector('.mobis-v2')).backgroundColor),'rgb(234, 242, 246)',"fundo gelo oficial V3");
  assert.equal(await page.locator('.ms-cabecalho').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(11, 15, 18)',"masthead grafite da V3");
  const caixa=await hero.boundingBox();
  assert.ok(caixa&&caixa.width>=width-1,"banner ocupa a largura da tela em "+width+"px");
  assert.equal(await hero.evaluate(el=>el.scrollWidth<=el.clientWidth+1),true,"banner sem estouro lateral em "+width+"px");

  assert.equal(await page.locator('.ms-departamentos-lista button').count(),7,"sete departamentos com ícones oficiais V3");
   assert.equal(await page.locator('.ms-aplicacoes .ms-linha,.ms-abertura,.ms-consulta-rodape').count(),0,"sem linhas, abertura ou faixa de contato duplicadas");
  assert.ok((await hero.locator("h1").innerText()).length>5,"carrossel tem chamada real");
  assert.ok((await hero.locator(".gcv3-copy p").innerText()).length<150,"texto comercial curto");
  await page.getByText(/Itens em organização por aplicação aprovada/).waitFor({timeout:10000});
  assert.equal(await page.locator('.ms-pesquisa').count(),1,"somente uma busca textual V3");
  assert.equal(await page.locator('.ms-encontrar form').count(),1,"somente um formulário de aplicação");
  assert.equal(await page.locator('.m2-search,.m2-filtros').count(),0,"formulários extras antigos ausentes");
  await page.locator('.ms-codigo-exato input[type="checkbox"]').check();
  assert.equal(await page.locator('.ms-codigo-exato input[type="checkbox"]').isChecked(),true,"busca de código exato disponível");
  await page.locator('#ms-buscar').fill('CI000120');
  const respostaCodigo=page.waitForResponse(resp=>resp.url().includes('/loja-publica')&&(resp.request().postData()||'').includes('"q":"CI000120"')&&(resp.request().postData()||'').includes('"referencia_exata":true'));
  await page.locator('.ms-pesquisa button[type="submit"]').click();
  await respostaCodigo;
  assert.ok(requests.some(x=>x.q==='CI000120'&&x.referencia_exata===true),'busca de referência exata chega ao servidor');
  await page.locator('.ms-codigo-exato input[type="checkbox"]').uncheck();
  await page.locator('#ms-buscar').fill('');

  // V3 enxuta: não montar os três grupos legados enviados nas capturas pelo proprietário.
  for(const bloco of ["cabecalho","banner","filtros","produtos","rodape"]){
    assert.equal(await page.locator('[data-bloco="'+bloco+'"]').count(),1,"bloco aprovado "+bloco);
  }
  for(const bloco of ["montadoras","taxonomia"]){
    assert.equal(await page.locator('[data-bloco="'+bloco+'"]').count(),0,"bloco legado "+bloco+" ausente");
  }
  assert.equal(await page.locator(".m4-montadora-item,.m4-taxonomia-item").count(),0,"grades antigas não montadas");
  assert.equal(await page.locator("#m2-atendimento,.m2-contato-form,#m2-lista").count(),0,"consulta e lista duplicadas removidas");
  assert.equal(await page.locator(".ms-departamentos-lista button").count(),7,"departamentos modernos mantidos");
  // Não deve haver link de ícone para WhatsApp, mesmo quando categorias da API estão vazias.
  for(const [chave,nome] of [["motor","Motor"],["cabecote","Cabeçote"],["suspensao","Suspensão"],["transmissao","Transmissão"],["eletrica","Elétrica"],["carroceria","Carroceria"],["acessorios","Acessórios"]]){
    const botao=page.getByRole("button",{name:"Filtrar produtos de "+nome,exact:true});
    const resposta=page.waitForResponse(resp=>resp.url().includes("/loja-publica") && (resp.request().postData()||"").includes('"categoria":"'+chave+'"'));
    await botao.click();await resposta;
    assert.equal(await botao.getAttribute("aria-pressed"),"true","departamento ativo "+nome);
    assert.equal(await page.getByLabel("Sistema / categoria",{exact:true}).inputValue(),chave,"categoria selecionada "+nome);
    assert.ok(page.url().includes("#/loja/mobis"),"o departamento não navega ao WhatsApp");
  }
  assert.equal(await page.locator(".m2-estado-compacto").count(),0,"sem cartão redundante de WhatsApp");
  assert.ok((await page.locator('link[rel="icon"][type="image/svg+xml"]').getAttribute("href")).includes("mobis-v3-favicon.svg"),"favicon oficial V3 configurado");
 
  assert.equal(await page.locator(".ms-encontrar form").count(),1,"filtro hierárquico preservado sem duplicação");
  assert.equal(await page.locator(".m4-linha-card,.m2-veiculo-grade").count(),0,"outras grades duplicadas ausentes");
  assert.equal(await page.locator(".gcv3-etiqueta-flash").count(),0,"sem campanha ativa não há oferta Flash fictícia");
  assert.equal(await page.locator(".v-rodape-privacidade-bloco").count(),0,"rodapé enxuto: políticas ficam na página institucional, não no rodapé");
  assert.equal(await page.locator(".v-rodape-privacidade-bloco button").count(),0,"sem política aprovada não publica texto inventado");
  assert.equal(new Set(origens).size,3,"rotacao exibe fotografias distintas por modelo");
  assert.equal(await page.locator(".v-hero").count(),0,"layout antigo não é renderizado");
  assert.equal(await page.locator(".m2-aviso-teste").count(),0,"aviso de teste removido da vitrine (pedido do dono)");
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),true,
    "sem rolagem horizontal para "+width+"px");
  assert.deepEqual(errors,[],"sem erros JS de layout");
  await page.screenshot({path:root+"evidencias-chat/loja-mobis-v2-"+width+"-SIMULADO.png",fullPage:width===390});
  await page.locator("#ms-buscar").fill("D4CB");
  const respostaBusca=page.waitForResponse(resp=>resp.url().includes("/loja-publica") && (resp.request().postData()||"").includes('"q":"D4CB"'));
  await page.locator(".ms-pesquisa button[type=\"submit\"]").click();
  await respostaBusca;
  assert.ok(requests.some(x=>x.q==="D4CB"&&x.slug==="mobis"),"busca conecta à API da loja");
  assert.equal(await page.getByRole("heading",{name:"Indexar e enriquecer"}).count(),0,"não expor painel privado");
  for(const [nome,id] of [["Catálogo","m2-catalogo"],["Buscar por veículo","ms-aplicacoes"],["Peças por sistema","ms-departamentos"]]){
   const link=page.getByRole("link",{name:nome,exact:true});
   assert.equal(await link.getAttribute("href"),"#/loja/mobis","abrir em outra aba também mantém a loja");
   await link.click();
   assert.equal(new URL(page.url()).hash,"#/loja/mobis","rodapé não pode sair da vitrine");
   await page.waitForFunction(id=>{const y=document.getElementById(id)?.getBoundingClientRect().top;return y!==undefined&&y>=-1&&y<innerHeight;},id,{timeout:8000}).catch(async e=>{throw new Error('rolagem falhou para '+nome+' ('+id+') top='+await page.evaluate(i=>document.getElementById(i)?.getBoundingClientRect().top,id)+' w='+width)});
   assert.equal(await page.locator('[data-mobis-layout="aprovado-v2"]').count(),1);
    assert.equal(await page.locator('[data-mobis-site="v3"]').count(),1,"layout completo V3 carregado");
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
    produtos:[{sku:"TESTE-SINTETICO",nome:"Peça sintética para teste",preco:null,marca:null,descricao:null,imagem:null,whatsapp:"https://wa.me/5562991654515?text=TESTE-SINTETICO",em_estoque:null,atualizado_em:null}]};
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
   await page.locator(".m2-produto h3").getByText("Peça sintética para teste").waitFor();
   assert.equal(await page.locator('[data-mobis-layout="aprovado-v2"]').count(),1);
    assert.equal(await page.locator('[data-mobis-site="v3"]').count(),1,"layout completo V3 carregado");
   assert.equal(await page.locator(".v-hero").count(),0);
   await page.getByLabel("Montadora",{exact:true}).selectOption("Hyundai");
   await page.getByLabel("Veículo / modelo",{exact:true}).selectOption("HR");
   await page.getByLabel("Motor / versão",{exact:true}).selectOption("D4CB");
   assert.equal(await page.getByLabel("Motor / versão",{exact:true}).locator("option").filter({hasText:"D4BH"}).count(),0,"motores respeitam modelo");
   await page.getByLabel("Ano / geração",{exact:true}).fill("2019");
   await page.getByLabel("Sistema / categoria",{exact:true}).selectOption("motor");
   const resposta=page.waitForResponse(r=>r.url().endsWith("/loja-publica")&&(r.request().postData()||"").includes('"motor":"D4CB"'));
   await page.getByRole("button",{name:"Aplicar filtros",exact:true}).click();await resposta;
   assert.ok(requests.some(x=>x.slug==="mobis"&&x.modelo==="HR"&&x.motor==="D4CB"&&x.ano===2019&&x.categoria==="motor"));
   assert.equal(await page.locator("#m2-lista").count(),0,"não reintroduzir bloco de lista antigo");
   assert.equal(await page.getByRole("button",{name:"Adicionar à lista +",exact:true}).count(),0,"não duplicar fluxo da lista no produto");
   const link=page.locator(".m2-produto").getByRole("link",{name:"Consultar no WhatsApp",exact:false});
   assert.match(await link.getAttribute("href"),/TESTE-SINTETICO/,"atendimento direto no produto preservado");
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,"sem overflow no domínio "+width);
   assert.deepEqual(errors,[]);
   await context.close();
   console.log("DOMÍNIO SIMULADO "+host+" "+width+"px OK: layout, catálogo, cascata e consulta");
  }
 }
} finally {await browser?.close();server.kill("SIGTERM");}
