// Regressão da interface com respostas SIMULADAS. Não homologa Bling/Supabase ou HTTPS.
import { createRequire } from "node:module";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { resolve, extname } from "node:path";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../../", import.meta.url));
const require = createRequire(root + "painel/package.json");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
let base = process.env.MOBIS_TEST_BASE;
let server;
if (!base) {
  const publicRoot = resolve(root, "painel/dist");
  server = createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
      const file = resolve(publicRoot, "." + (pathname === "/" ? "/index.html" : pathname));
      if (!file.startsWith(publicRoot + (process.platform === "win32" ? "\\" : "/"))) return res.writeHead(403).end();
      const body = await readFile(file);
      res.writeHead(200, {"content-type": ({".html":"text/html", ".js":"application/javascript", ".css":"text/css", ".svg":"image/svg+xml", ".webp":"image/webp", ".woff2":"font/woff2", ".json":"application/json"})[extname(file)] || "application/octet-stream"}).end(body);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  base = `http://127.0.0.1:${server.address().port}/`;
}
const dir = root + "evidencias-vitrine-teste/";
await mkdir(dir, { recursive: true });
const browser = await chromium.launch({headless:true, executablePath:process.env.CHROMIUM_EXECUTABLE || undefined, args:["--no-sandbox"]});
const resultados = [];
async function abrir(flags, width = 1280, erro = false) {
  const context = await browser.newContext({viewport:{width,height:900}, serviceWorkers:"block", reducedMotion:"reduce"});
  const page = await context.newPage(), consultas = [], erros = [];
  page.on("pageerror", e => erros.push(e.message));
  await page.route("**/*.supabase.co/**", async route => {
    if (!route.request().url().endsWith("/functions/v1/loja-publica")) return route.abort();
    const headers = {"access-control-allow-origin":"*", "access-control-allow-methods":"POST, OPTIONS", "access-control-allow-headers":"apikey, content-type, authorization, x-client-info"};
    if (route.request().method() === "OPTIONS") return route.fulfill({status:204,headers});
    consultas.push(route.request().postDataJSON());
    if (erro) return route.fulfill({status:503, headers, contentType:"application/json", body:'{"erro":"simulado"}'});
    return route.fulfill({status:200, headers, contentType:"application/json", body:JSON.stringify({
      loja:{nome:"Mobis Autopeças",slug:"mobis",...flags}, produtos:[], banners:[],
      veiculos:[{modelo:"Hyundai HR",motor:"2.5 16V",de:2013,ate:2022},{modelo:"Kia Bongo K2500",motor:"2.5 16V",de:2013,ate:2022}],
      categorias:[{nome:"Motor",slug:"motor",total:0}], total:0, pagina:1, por_pagina:24
    })});
  });
  await page.goto(base + "#/loja/mobis");
  await page.locator(".m2-catalogo").getByText(erro ? "Não foi possível carregar o catálogo." : "Catálogo de peças em preparação.", {exact:true}).waitFor();
  return {context,page,consultas,erros};
}
async function consultar(page, acao, criterio) {
  const resposta = page.waitForResponse(r => r.url().endsWith("/functions/v1/loja-publica") && r.request().method() === "POST" && criterio(r.request().postDataJSON()));
  await acao();
  await resposta;
  await page.getByText("0 produto(s) encontrado(s)", {exact:true}).waitFor();
}
try {
  for (const width of [360,390,720,1280]) {
    const {context,page,consultas,erros} = await abrir({ambiente:"teste",venda_habilitada:false}, width);
    await page.getByRole("button",{name:"Ver produto de teste",exact:false}).click();
    await page.locator("#m2-produto-teste").waitFor();
    assert.equal(await page.locator(".m2-produto").count(),0,"amostra não é produto publicado");
    assert.equal(await page.locator(".m2-amostra a").count(),0,"amostra não possui link comercial");
    await page.getByRole("button",{name:"Abrir ficha de teste",exact:false}).click();
    assert.equal(await page.getByRole("button",{name:"Recolher ficha de teste",exact:false}).getAttribute("aria-expanded"),"true");
    await page.getByText("Ficha demonstrativa",{exact:true}).waitFor();
    assert.equal(consultas.length,1,"abrir amostra não consulta nem grava produto");
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,"sem overflow");
    assert.equal(await page.locator(".m2-aviso-teste").evaluate(el=>el.getBoundingClientRect().top < document.querySelector(".m2-hero").getBoundingClientRect().top),true);
    assert.deepEqual(erros,[]);
    if (width===1280 || width===390) {
      await page.locator("#m2-produto-teste").screenshot({path:dir+`produto-SIMULADO-${width}.png`});
      await page.evaluate(()=>scrollTo(0,0));
      await page.screenshot({path:dir+`inicio-SIMULADO-${width}.png`});
    }
    resultados.push({width,amostra:true,produtosPublicados:0,erros});
    await context.close();
  }
  for (const flags of [{ambiente:"producao",venda_habilitada:false},{ambiente:"teste",venda_habilitada:true},{ambiente:"teste"},{}]) {
    const {context,page} = await abrir(flags);
    assert.equal(await page.locator("#m2-produto-teste").count(),0,"sem autorização explícita de teste não há amostra");
    await context.close();
  }
  {
    const {context,page} = await abrir({ambiente:"teste",venda_habilitada:false},1280,true);
    assert.equal(await page.locator("#m2-produto-teste").count(),0,"falha de API não inventa catálogo");
    await context.close();
  }
  {
    const {context,page,consultas} = await abrir({ambiente:"teste",venda_habilitada:false});
    await page.getByLabel("Ano",{exact:true}).fill("2019");
    await consultar(page, () => page.getByRole("button",{name:"Aplicar filtros",exact:true}).click(), q => q.ano === 2019);
    await consultar(page, () => page.locator(".m2-veiculo").filter({hasText:"Hyundai HR"}).click(), q => q.modelo === "Hyundai HR");
    assert.equal(consultas.at(-1).modelo,"Hyundai HR");
    assert.equal(consultas.at(-1).q,undefined);
    assert.equal(consultas.at(-1).ano,undefined);
    assert.equal(await page.getByLabel("Ano",{exact:true}).inputValue(),"");
    await consultar(page, () => page.locator(".m2-sistema-grade button").filter({hasText:/^Motor/}).click(), q => q.categoria === "motor");
    assert.equal(consultas.at(-1).categoria,"motor");
    assert.equal(consultas.at(-1).modelo,undefined);
    assert.equal(await page.getByLabel("Modelo",{exact:true}).inputValue(),"");
    await page.getByLabel("Qual peça você procura?",{exact:true}).fill("bomba");
    await consultar(page, () => page.getByRole("search",{name:"Busca rápida de peças"}).getByRole("button",{name:"Buscar peças",exact:false}).click(), q => q.q === "bomba");
    assert.equal(consultas.at(-1).q,"bomba");
    assert.equal(consultas.at(-1).categoria,"motor");
    await page.getByRole("button",{name:"Já tenho o código",exact:false}).click();
    assert.equal(await page.locator("#m2-pesquisar").evaluate(el=>el===document.activeElement),true);
    await context.close();
  }
  resultados.push({guardas:"producao, venda ativa, flags ausentes e erro de API: amostra ausente",filtros:"modelo canônico, ano/categoria limpos, busca rápida e foco por código aprovados"});
  console.log(JSON.stringify(resultados,null,2));
} catch (erro) {
  resultados.push({erro:String(erro),stack:erro.stack});
  throw erro;
} finally {
  await browser.close();
  if (server) await new Promise(resolve => server.close(resolve));
  await writeFile(dir+"resultado-SIMULADO.json",JSON.stringify({simulado:true,resultados},null,2));
}
