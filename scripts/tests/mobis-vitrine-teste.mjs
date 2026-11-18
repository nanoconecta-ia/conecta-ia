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
async function abrir(flags, width = 1280, erro = false, cenarioFlash = false) {
  const context = await browser.newContext({viewport:{width,height:900}, serviceWorkers:"block", reducedMotion:"reduce"});
  const page = await context.newPage(), consultas = [], erros = [];
  page.on("pageerror", e => erros.push(e.message));
  await page.route("**/*.supabase.co/**", async route => {
    if (!route.request().url().endsWith("/functions/v1/loja-publica")) return route.abort();
    const headers = {"access-control-allow-origin":"*", "access-control-allow-methods":"POST, OPTIONS", "access-control-allow-headers":"apikey, content-type, authorization, x-client-info"};
    if (route.request().method() === "OPTIONS") return route.fulfill({status:204,headers});
    const pedido = route.request().postDataJSON();
    consultas.push(pedido);
    if (erro) return route.fulfill({status:503, headers, contentType:"application/json", body:'{"erro":"simulado"}'});
    return route.fulfill({status:200, headers, contentType:"application/json", body:JSON.stringify({
      loja:{nome:"Mobis Autopeças",slug:"mobis",whatsapp:"5562991654515",...flags},
      layout:{blocos:flags.layoutOrdem??["banner","montadoras","taxonomia","catalogo","empresa"],intervalo_segundos:flags.layoutIntervalo??6},
      paleta:flags.paleta??null,
      produtos:flags.previaSimulada
        ? [{sku:"CI003696",nome:"Motor parcial D4CB",marca:"TRIM-GO",preco:null,em_estoque:null,
            imagem:null,descricao:null,consulta_previa:true,whatsapp:"https://wa.me/5562991654515"}]
        : cenarioFlash && pedido.sku==="CI003000"
        ? [{sku:"CI003000",nome:"Motor parcial D4CB",marca:"TRIM-GO",preco:null,em_estoque:false,
            imagem:null,descricao:null,whatsapp:null}] : [],
      banners:cenarioFlash ? [{sku:"CI003000",nome:"Motor parcial D4CB",preco:null,chamada:"Motor HR / Bongo 2.5 16V",
        flash:true,imagem:"data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=",whatsapp:null,fim:null},
         ...(flags.multiplosBanners?[{sku:"EXEMPLO-2",nome:"Peça de teste 2",preco:null,chamada:"Segunda campanha de teste",flash:true,imagem:null,whatsapp:null,fim:null}]:[])] : [],
      ficha:cenarioFlash && pedido.sku==="CI003000" ? {veiculos:[
        {modelo:"Hyundai HR",motor:"2.5 16V",de:2013,ate:2022,tipo:"caminhao"},
        {modelo:"Kia Bongo K2500",motor:"2.5 16V",de:2013,ate:2022,tipo:"caminhao"},
      ]} : null,
      paginas_aplicacao:cenarioFlash ? {CI003000:[
        {slug:"hyundai-hr-motor-d4cb",titulo:"Motor parcial 2.5 D4CB para Hyundai HR",modelo:"Hyundai HR",status:"aprovado"},
        {slug:"kia-bongo-motor-d4cb",titulo:"Motor parcial 2.5 D4CB para Kia Bongo",modelo:"Kia Bongo K2500",status:"aprovado"},
        {slug:"pendente-nao-publicado",titulo:"Aplicação em estudo",modelo:"Outro",status:"a_confirmar"}]} : {},
      veiculos:[{modelo:"Hyundai HR",motor:"2.5 16V",de:2013,ate:2022},{modelo:"Kia Bongo K2500",motor:"2.5 16V",de:2013,ate:2022}],
      categorias:flags.arvoreSimulada ? [{nome:"Motor parcial",slug:"tec-blocos-motores-motor-parcial",total:1}]
        : flags.categoriaSimulada ? [{nome:"Motor",slug:"motor",total:1}] : [],
      arvore_categorias:flags.arvoreSimulada ? [
        {nome:"Motor",slug:"motor",pai_slug:null,nivel:0,total:1},
        {nome:"Blocos e motores completos",slug:"blocos-motores",pai_slug:"motor",nivel:1,total:1},
        {nome:"Motor parcial",slug:"tec-blocos-motores-motor-parcial",pai_slug:"blocos-motores",nivel:2,total:1},
      ] : [],
      total:flags.previaSimulada?1:0, pagina:1, por_pagina:24
    })});
  });
  await page.goto(base + "#/loja/mobis");
  if(flags.previaSimulada) await page.locator(".m2-produto").waitFor();
  else await page.locator(".m2-catalogo").getByText(erro ? "Não foi possível carregar o catálogo." : "Catálogo de peças em preparação.", {exact:true}).waitFor();
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
    assert.equal(await page.locator("#m2-produto-teste").count(),0,"a página comercial não mostra produto fictício");
    assert.equal(await page.locator(".m2-produto").count(),0,"um catálogo vazio não inventa itens");
    assert.equal(await page.locator(".m4-banner-campanha").count(),0,"sem campanha publicada não existe banner de oferta fictício");
    assert.equal(await page.locator(".m4-montadora-item").count(),9,"nove montadoras como caminho de consulta");
    assert.equal(await page.locator(".m4-tipo-veiculo").count(),4,
      "tipos de veículo: picapes, vans, utilitários e passeio");
    assert.equal(await page.locator(".m4-tipo-veiculo img.m4-emblema-veiculo").count(),4,
      "quatro arquivos com o M MOBIS e moldura metálica");
    assert.equal(await page.locator(".m4-tipo-veiculo img[src*='passeio']").count(),1,
      "veículo de passeio é uma categoria própria na navegação");

    assert.equal(await page.locator(".m4-taxonomia-item").count(),9,"nove sistemas de consulta sem produto publicado");
    assert.equal(await page.locator('.m4-taxonomia-item[data-mobis-emblema="sim"]').count(),7,
      "sete emblemas metálicos oficiais da MOBIS, sem alterar Freios/Arrefecimento");
    assert.equal(await page.locator(".m4-sistema-emblema").count(),7,
      "emblemas do catálogo usam imagens locais em WebP");
    assert.equal(await page.locator('.m4-taxonomia-item[data-mobis-emblema="nao"]').count(),2,
      "sistemas sem arte aprovada preservam seus ícones técnicos");
    await page.locator(".m4-montadora-item").filter({hasText:"Iveco"}).click();
    await page.locator(".m4-montadora-opcoes button").filter({hasText:"Consultar a equipe"}).click();
    const link=await page.locator("#m2-atendimento .m2-contato-form a").getAttribute("href");
    assert.match(decodeURIComponent(link||""),/Iveco/,"consulta inclui a linha selecionada na mensagem");
    assert.equal(consultas.length,1,"a seleção comercial não consulta nem grava produto");
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,"sem overflow");
    assert.equal(await page.locator(".m2-aviso-teste").count(),0,"aviso de ambiente de teste removido da vitrine (pedido do dono)");
    assert.equal(await page.getByText("Prévia da loja", {exact:false}).count(),0,"legenda de prévia removida do carrossel (pedido do dono)");
    assert.deepEqual(erros,[]);
    if (width===1280 || width===390) {
      await page.locator(".m4-bloco-montadoras").screenshot({path:dir+`montadoras-CONSULTA-SIMULADO-${width}.png`});
      await page.evaluate(()=>scrollTo(0,0));
      await page.screenshot({path:dir+`inicio-SIMULADO-${width}.png`});
    }
    resultados.push({width,amostra:false,montadoras:9,nosComConsulta:9,produtosPublicados:0,erros});
    await context.close();
  }
  {
    // A ordem da homepage é definida pelo ponteiro publicado (simulado),
    // não pelo JSX fixo ou por uma prévia não aprovada do lojista.
    const {context,page,erros}=await abrir({ambiente:"teste",venda_habilitada:false,
      layoutOrdem:["catalogo","banner","montadoras","taxonomia","empresa"]},390);
    const ordem=await page.locator("main [data-bloco]").evaluateAll(els=>
      els.map(el=>el.getAttribute("data-bloco")).filter(x=>["banner","montadoras","taxonomia","filtros","produtos"].includes(x)));
    assert.deepEqual(ordem,["banner","filtros","produtos","montadoras","taxonomia"],
      "prioridade comercial V3: carrossel, catálogo, montadoras, sistemas");
    assert.deepEqual(erros,[],"sem exceções JS ao montar a ordem personalizada");
    await context.close();
  }
  {
    const cores={cor_fundo:"#ffffff",cor_superficie:"#eaf2f6",cor_texto:"#1f2327",
      cor_botao:"#1f2327",cor_acento:"#e2181a"};
    const {context,page,erros}=await abrir({ambiente:"teste",venda_habilitada:false,paleta:cores},390);
    const root=page.locator(".mobis-v2.m4");
    assert.equal(await root.getAttribute("data-paleta-publicada"),"sim",
      "somente paleta publicada pela API é aplicada à Mobis");
    assert.equal(await root.evaluate(el=>getComputedStyle(el).getPropertyValue("--mobis-botao").trim()),"#1f2327");
    assert.equal(await page.locator(".m4-busca button").first().evaluate(el=>getComputedStyle(el).backgroundColor),
      "rgb(31, 35, 39)","botões seguem o token grafite da paleta oficial");
    assert.equal(await page.locator(".m2-header").evaluate(el=>getComputedStyle(el).borderBottomColor),
      "rgb(226, 24, 26)","cabeçalho usa o vermelho oficial publicado");
    assert.deepEqual(erros,[]);
    await context.close();
  }
  {
    const {context,page,erros}=await abrir({ambiente:"teste",venda_habilitada:false},390);
    assert.equal(await page.locator(".mobis-v2.m4").getAttribute("data-paleta-publicada"),"nao",
      "rascunho ou ausência de paleta não muda site");
    assert.equal(await page.locator(".m2-header").evaluate(el=>getComputedStyle(el).borderBottomColor),
      "rgb(176, 18, 24)","identidade MOBIS mantém vermelho escuro institucional mesmo sem paleta publicada");
    assert.deepEqual(erros,[]);
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
    const {context,page,consultas} = await abrir({ambiente:"teste",venda_habilitada:false,categoriaSimulada:true});
    await page.getByLabel("Ano",{exact:true}).fill("2019");
    await consultar(page, () => page.getByRole("button",{name:"Aplicar filtros",exact:true}).click(), q => q.ano === 2019);
    await page.locator(".m4-montadora-item").filter({hasText:"Hyundai"}).click();
    await consultar(page, () => page.locator(".m4-montadora-opcoes button").filter({hasText:"Hyundai HR"}).click(), q => q.modelo === "Hyundai HR");
    assert.equal(consultas.at(-1).modelo,"Hyundai HR");
    assert.equal(consultas.at(-1).q,undefined);
    assert.equal(consultas.at(-1).ano,undefined);
    assert.equal(await page.getByLabel("Ano",{exact:true}).inputValue(),"");
    await consultar(page, () => page.locator(".m4-taxonomia-item[data-taxonomia-no='motor']").click(), q => q.categoria === "motor");
    assert.equal(consultas.at(-1).categoria,"motor");
    assert.equal(consultas.at(-1).modelo,undefined);
    assert.equal(await page.getByLabel("Modelo",{exact:true}).inputValue(),"");
    await page.getByLabel("Qual peça você procura?",{exact:true}).fill("bomba");
    await consultar(page, () => page.getByRole("search",{name:"Busca rápida de peças"}).getByRole("button",{name:"Buscar peças",exact:false}).click(), q => q.q === "bomba");
    assert.equal(consultas.at(-1).q,"bomba");
    assert.equal(consultas.at(-1).categoria,"motor");
    await page.getByRole("tab",{name:"SKU, fabricante ou OEM"}).click();
    assert.equal(await page.getByRole("tab",{name:"SKU, fabricante ou OEM"}).getAttribute("aria-selected"),"true");
    await context.close();
  }
  {
    const {context,page} = await abrir({ambiente:"teste",venda_habilitada:false});
    // Host público SIMULADO, servido apenas pelo build local: não chama a loja real.
    await context.route("https://www.mobisautopecas.com.br/**", async route => {
      const u = new URL(route.request().url());
      // Imagens ainda em voo quando o teste termina: se o contexto fechar, o erro é esperado.
      try {
        const response = await route.fetch({url:new URL(u.pathname + u.search,base).href});
        await route.fulfill({response});
      } catch (e) {
        if (!/closed/i.test(String(e?.message))) throw e;
      }
    });
    for (const hash of ["#/", "#/estudio", "#/catalogo-espelho"]) {
      await page.goto("https://www.mobisautopecas.com.br/conecta.html" + hash);
      await page.locator('[data-acesso-layout="aprovado-v2"]').waitFor();
      assert.equal(await page.locator('[data-conecta-layout="aprovado-v2"], [data-nano-layout="aprovado-v2"]').count(),0,"admin sem sessão não monta dados");
      assert.equal(await page.locator('[data-mobis-layout="aprovado-v2"]').count(),0,"entrada privada não redireciona para loja");
    }
    await page.goto("https://www.mobisautopecas.com.br/#/estudio");
    await page.locator('[data-mobis-layout="aprovado-v2"]').waitFor();
    assert.equal(await page.locator('[data-acesso-layout="aprovado-v2"]').count(),0,"raiz pública continua loja mesmo com hash administrativo");
    await context.unrouteAll({behavior:"ignoreErrors"});
    await context.close();
    resultados.push({separacao:"raiz pública = loja; conecta.html exige sessão em início, Nano e catálogo"});
  }
  {
    const {context,page,erros}=await abrir({ambiente:"teste",venda_habilitada:false,arvoreSimulada:true},390);
    assert.equal(await page.getByRole("tab",{name:"Pesquisa de veículos"}).getAttribute("aria-selected"),"true");
    await page.getByRole("tab",{name:"Pesquisa de produtos"}).click();
    assert.equal(await page.getByLabel("Montadora",{exact:true}).count(),0,
      "modo produto oculta filtros de veículo");
    await page.getByRole("tab",{name:"Pesquisa de veículos"}).click();
    assert.equal(await page.getByLabel("Montadora",{exact:true}).count(),1,
      "modo veículo exibe a cascata montadora/modelo/motor/ano");
    const raiz=page.locator(".m4-taxonomia-item[data-taxonomia-no='motor']");
    assert.equal(await raiz.count(),1,"somente categorias pai com filhos publicados");
    await raiz.click();
    assert.equal(await page.locator(".m4-taxonomia-item[data-taxonomia-no='blocos-motores']").count(),1,
      "filho real Blocos e motores completos");
    await consultar(page,()=>page.getByRole("button",{name:"Ver todas as peças deste grupo"}).click(),
      q=>q.categoria==="motor");
    await page.locator(".m4-taxonomia-item[data-taxonomia-no='blocos-motores']").click();
    assert.equal(await page.locator(".m4-taxonomia-item[data-taxonomia-no='tec-blocos-motores-motor-parcial']").count(),1,
      "terceiro nível da árvore é Motor parcial");
    await consultar(page,()=>page.locator(".m4-taxonomia-item[data-taxonomia-no='tec-blocos-motores-motor-parcial']").click(),
      q=>q.categoria==="tec-blocos-motores-motor-parcial");
    assert.deepEqual(erros,[],"hierarquia não produz erros na interface");
    await context.close();
  }
  {
    const {context,page,erros} = await abrir({ambiente:"teste",venda_habilitada:false},390,false,true);
    assert.equal(await page.locator(".gcv3").count(),1,"banner Flash gerado apenas a partir da API");
    assert.equal(await page.locator(".gcv3-midia").getAttribute("href"),"#/p/mobis/CI003000",
      "imagem da campanha abre diretamente a página SKU");
    assert.equal(await page.locator(".gcv3-cta").getAttribute("href"),"#/p/mobis/CI003000",
      "CTA do carrossel abre diretamente a página SKU");
    assert.equal(await page.locator(".gcv3-titulo-link").getAttribute("href"),"#/p/mobis/CI003000",
      "título da campanha abre diretamente a página SKU");
    assert.equal(await page.getByRole("dialog").count(),0,"não exibe janela intermediária");
    await page.locator(".gcv3-cta").click();
    await page.locator(".produto-publico-mobis-aplicacoes").waitFor();
    assert.equal(await page.locator(".produto-publico-mobis-layout").count(),1,
      "ficha do SKU usa layout MOBIS em gelo com QR separado");
    assert.equal(await page.locator(".produto-publico-mobis-qr-area img").count(),1,
      "página contém o QR do WhatsApp Business oficial");
    assert.equal(await page.locator(".produto-publico-mobis-qr-area img").evaluate(img=>img.complete && img.naturalWidth>0),true,
      "arquivo do QR oficial abre sem erro");
    assert.equal(await page.getByRole("tab",{name:"Descrição",exact:true}).count(),1,
      "ficha MOBIS dispõe das três abas funcionais da descrição");
    await page.getByRole("tab",{name:"Especificações técnicas",exact:true}).click();
    assert.equal(await page.locator(".produto-publico-mobis-especificacoes dd").first().textContent(),"CI003000");
    await page.getByRole("tab",{name:"Utilização em veículos",exact:true}).click();
    assert.equal(await page.locator(".produto-publico-mobis-aplicacoes-lista li").count(),2,
      "aba utiliza apenas duas aplicações aprovadas, sem inventar veículos");
    await page.getByRole("tab",{name:"Descrição",exact:true}).click();
    assert.equal(await page.locator(".produto-publico-mobis-conteudo-abas").getByText("Descrição complementar a confirmar",{exact:false}).count(),1);
    assert.equal(await page.locator(".produto-publico-mobis-sistema").count(),7,
      "sete sistemas visuais da MOBIS, sem implicar compatibilidade");
    assert.equal(await page.locator(".produto-publico-mobis-acessar").getAttribute("href"),
      "https://wa.me/mobisautopecas?src=qr","contato institucional quando não há link específico do produto");

    assert.equal(new URL(page.url()).hash,"#/p/mobis/CI003000","navegação direta à página canônica");
    assert.equal(await page.locator(".produto-publico-mobis-aplicacoes a").count(),2,
      "página física tem os destinos individuais por veículo aprovados");
    assert.equal(await page.locator(".produto-publico-mobis-aplicacoes a[href*=pendente]").count(),0,
      "aplicação pendente nunca vira link público");
    assert.deepEqual(erros,[]);
    resultados.push({flash:"foto, título e CTA navegam direto ao SKU; páginas por veículo só aprovadas"});
    await context.close();
  }
  {
    const {context,page,erros}=await abrir({ambiente:"teste",venda_habilitada:false,multiplosBanners:true},390,false,true);
    assert.equal(await page.getByRole("button",{name:"Próximo destaque"}).count(),1,"carrossel com duas campanhas");
    assert.equal(await page.locator(".gcv3-cta").getAttribute("href"),"#/p/mobis/CI003000");
    await page.getByRole("button",{name:"Próximo destaque"}).click();
    assert.equal(await page.locator(".gcv3-cta").getAttribute("href"),"#/p/mobis/EXEMPLO-2",
      "cada campanha na mesma faixa aponta ao seu próprio SKU");
    assert.match(await page.locator(".gcv3-topo > span").last().textContent()||"",/02\s*\/\s*02/);
    assert.deepEqual(erros,[]);
    await context.close();
  }
  {
    const {context,page,erros}=await abrir({ambiente:"teste",venda_habilitada:false,previaSimulada:true},390);
    assert.equal(await page.locator(".m2-produto").count(),1,"prévia sinalizada mostra produto de consulta");
    assert.equal(await page.locator(".gcv3-cta").getAttribute("href"),"https://wa.me/5562991654515");
    assert.equal(await page.locator(".gcv3-preco").count(),0,"prévia não mostra preço");
    assert.equal(await page.locator("#m2-empresa").count(),0,"institucional não ocupa home");
    assert.deepEqual(erros,[]);
    await context.close();
  }
  {
    const {context,page,erros}=await abrir({ambiente:"teste",venda_habilitada:false},390);
    await page.locator(".m4-menu-empresa").click();
    await page.locator("#m2-empresa").waitFor();
    assert.equal(new URL(page.url()).hash,"#/loja/mobis/empresa","empresa tem página dedicada");
    assert.equal(await page.locator(".m2-catalogo").count(),0,"empresa não duplica catálogo");
    assert.deepEqual(erros,[]);
    await context.close();
  }
  resultados.push({guardas:"produto sintético ausente em todos os ambientes, inclusive em falha de API",filtros:"modelo canônico, ano/categoria limpos, busca rápida e foco por código aprovados"});
  console.log(JSON.stringify(resultados,null,2));
} catch (erro) {
  resultados.push({erro:String(erro),stack:erro.stack});
  throw erro;
} finally {
  await browser.close();
  if (server) await new Promise(resolve => server.close(resolve));
  await writeFile(dir+"resultado-SIMULADO.json",JSON.stringify({simulado:true,resultados},null,2));
}
