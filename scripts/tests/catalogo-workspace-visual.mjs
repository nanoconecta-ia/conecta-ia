// Catálogo técnico: tela privada com dados 100% sintéticos.
// Nenhum request consulta a conta real da Mobis ou permite gravações em ERP.
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import assert from "node:assert/strict";
const root = new URL("../../", import.meta.url).pathname;
const painel = root + "painel/";
const require = createRequire(painel + "package.json"), { chromium } = require("playwright");
const port = 4213, base = `http://127.0.0.1:${port}`;
const REF = "dsfzhsrudriqkumtlqwj", lojaId = "aaaaaaaa-0000-0000-0000-000000000001";
const server = spawn(process.execPath, [painel+"node_modules/vite/bin/vite.js","--host","127.0.0.1","--port",String(port)], {cwd:painel,stdio:"ignore"});
let browser;
try {
  for (let i=0; i<100; i++) { try { if ((await fetch(base+"/")).ok) break; } catch {} await new Promise(r=>setTimeout(r,100)); }
  browser = await chromium.launch({headless:true});
  await mkdir(root+"evidencias-chat", {recursive:true});
  for(const [width,height] of [[300,640],[390,844],[1280,800]]) {
    const context = await browser.newContext({viewport:{width,height}});
    const page = await context.newPage(), errors=[], writes=[], consultas=[], corrigirChamadas=[];
    const modelo=(i)=>({id:`bbbbbbbb-0000-0000-0000-${String(i+10).padStart(12,"0")}`,sku:`P-${String(i).padStart(4,"0")}`,nome:`Peça de teste ${String(i).padStart(4,"0")}`,preco:100,estoque:1,publicado:false,marca:"TESTE",gtin:null,peso_kg:1,descricao_curta:"Peça simulada",descricao_complementar:null,categoria_bling_id:null,situacao:"A",taxonomia_no_id:null});
    const todos=[
      ...Array.from({length:503},(_,i)=>modelo(i)),
      { ...modelo(503), sku:"CI000016", nome:"Bomba d'água TRIM GO", marca:"TRIM GO", preco:176.77, publicado:true },
      { ...modelo(504), sku:"854008", nome:"Bomba d'água INDISA", marca:"INDISA", situacao:"E", preco:260, estoque:0, descricao_curta:null, peso_kg:null },
    ];
    page.on("pageerror", err=>errors.push(err.message));
    const session={access_token:"s.s.s",refresh_token:"s",token_type:"bearer",expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user:{id:"11111111-1111-1111-1111-111111111111",aud:"authenticated",role:"authenticated",email:"demo@exemplo.invalid",app_metadata:{},user_metadata:{},created_at:"2026-01-01T00:00:00Z"}};
    await page.addInitScript(([k,v])=>localStorage.setItem(k,v),[`sb-${REF}-auth-token`,JSON.stringify(session)]);
    await page.route("**/*",async route=>{
      const req=route.request(),u=new URL(req.url());
      if(u.hostname==="127.0.0.1")return route.continue();
      assert.ok(u.hostname.endsWith("supabase.co"),"Host não permitido: "+u.hostname);
      const h={"access-control-allow-origin":"*","access-control-allow-headers":"*","access-control-allow-methods":"*","access-control-expose-headers":"content-range"};
      if(req.method()==="OPTIONS")return route.fulfill({status:204,headers:h});
      if(!["GET","HEAD"].includes(req.method()))writes.push({url:u.pathname,method:req.method()});
      if(u.pathname.endsWith("/auth/v1/user"))return route.fulfill({status:200,contentType:"application/json",headers:h,body:JSON.stringify(session.user)});
      if(u.pathname.endsWith("/rest/v1/lojas"))return route.fulfill({status:200,contentType:"application/json",headers:h,body:JSON.stringify([{id:lojaId,nome:"Loja DEMO",slug:"loja-demo",modo_venda:"whatsapp",ambiente:"teste",perfil_ramo:"autopecas"}])});
      if(u.pathname.endsWith("/rest/v1/produtos")) {
        assert.equal(u.searchParams.get("loja_id"),"eq."+lojaId,"somente loja autorizada");
        const filtro=u.searchParams.get("or")??"";
        const listados=filtro?todos.filter(x=>[x.sku,x.nome,x.marca,x.gtin].some(v=>v&&String(v).toLowerCase().includes(filtro.toLowerCase().includes("854008")?"854008":"___nenhum___"))):todos;
        const offset=Number(u.searchParams.get("offset")??0), limit=Number(u.searchParams.get("limit")??100);
        assert.ok(limit<=100,"endpoint não pode pedir mais que 100 registros por vez");
        consultas.push({filtro,offset,limit});
        const lote=listados.slice(offset,offset+limit);
        const range=`${offset}-${Math.max(offset,offset+lote.length-1)}/${listados.length}`;
        return route.fulfill({status:200,contentType:"application/json",headers:{...h,"content-range":range},body:JSON.stringify(lote)});
      }
      if(u.pathname.endsWith("/rest/v1/produto_imagens")){
        // consulta da galeria da ficha (filtra por produto e pede as colunas completas) x contagem de imagens da lista (só produto_id)
        if((u.searchParams.get("select")||"").includes("url_original")){
          const img=(n,p={})=>({id:`cccccccc-0000-0000-0000-00000000000${n}`,url:"data:image/gif;base64,R0lGODlhAQABAAAAACw=",tipo:"real",origem:"busca_web",url_original:`https://www.fabricante.exemplo.com.br/pagina/${n}`,licenca_tipo:"fabricante",cruzamento_tipo:"oem",cruzamento_valor:"20910-4AU07",confianca:0.9,largura_px:1200,altura_px:900,aprovada:false,principal:false,direitos_confirmados_em:null,removida_em:null,ordem:n,...p});
          return route.fulfill({status:200,contentType:"application/json",headers:h,body:JSON.stringify([img(1),img(2,{tipo:"ilustrativa",licenca_tipo:null,cruzamento_tipo:"similar",largura_px:200,altura_px:150}),img(3,{aprovada:true,principal:true,licenca_tipo:"propria"})])});
        }
        return route.fulfill({status:200,contentType:"application/json",headers:h,body:JSON.stringify([{produto_id:"bbbbbbbb-0000-0000-0000-000000000003"}])});
      }
      if(u.pathname.endsWith("/rest/v1/taxonomia_nos"))return route.fulfill({status:200,contentType:"application/json",headers:h,body:JSON.stringify([{id:"n1",pai_id:null,nome:"Arrefecimento",slug:"arrefecimento",ordem:1},{id:"n2",pai_id:"n1",nome:"Bombas d'água",slug:"bombas-agua",ordem:1}])});
      if(u.pathname.endsWith("/rest/v1/bling_categorias")||u.pathname.endsWith("/rest/v1/produto_automacao"))return route.fulfill({status:200,contentType:"application/json",headers:h,body:"[]"});
      if(u.pathname.endsWith("/functions/v1/assistente")){const a=JSON.parse(req.postData()||"{}").acao;if(a==="chat_corrigir_produto"){corrigirChamadas.push(JSON.parse(req.postData()));return route.fulfill({status:200,contentType:"application/json",headers:h,body:JSON.stringify({ia:false,modo:"correcao_sem_llm",proposta:{id:"p1",titulo:"Atualizar marca, gtin de 854008 no Bling",versao:1,hash:"h",risco:"MEDIUM"},resposta:"Proposta criada: Atualizar marca, gtin de 854008 no Bling. Revise o antes/depois e aprove na fila; nada foi gravado no Bling."})})}return route.fulfill({status:200,contentType:"application/json",headers:h,body:JSON.stringify(a==="provedores"?{verificado:true,provedores:[]}:a==="chat_config"?{persistente:false,bling:false,leitura_administrativa:false,retencao_dias:180}:{conversas:[],registros:[]})});}
      return route.fulfill({status:200,contentType:"application/json",headers:h,body:u.pathname.includes("/rest/v1/")?"[]":"{}"});
    });
    await page.goto(base+"/#/catalogo");
    await page.getByRole("heading",{name:/Catálogo técnico/}).waitFor();
    await page.getByRole("group",{name:"Modo de visualização"}).getByRole("button",{name:"Cartões"}).click();
    const query=page.getByRole("searchbox",{name:"Buscar produto por SKU, nome, marca ou GTIN"});
    await query.fill("854008");
    await page.locator(".catalogo-produto").filter({hasText:"INDISA"}).waitFor();
    await page.getByRole("status").filter({hasText:"1 encontrado(s)"}).waitFor();
    assert.equal(await page.locator(".catalogo-produto").count(),1,"SKU exato não deve retornar TRIM GO");
    assert.ok(consultas.some(c=>c.filtro.includes("854008")),"busca por SKU deve chegar ao servidor");
    await page.getByRole("button",{name:"Ver ficha técnica"}).click();
    const modal=page.getByRole("dialog",{name:"Bomba d'água INDISA"});
    await modal.waitFor();
    assert.match(await modal.innerText(),/IN D I S A|INDISA/);
    assert.match(await modal.innerText(),/GTIN\/EAN/);
    assert.equal((await modal.innerText()).includes("151,00"),false,"custo confidencial não exibido");
    // PR #242: galeria de até 8 imagens na ficha: estado, origem, licença e aprovação por imagem; nada publicável sem direitos
    const galeria=modal.locator(".galeria-produto");await galeria.waitFor();
    assert.equal(await galeria.locator(".galeria-item").count(),3,"as três imagens do produto aparecem");
    const txtGaleria=await galeria.innerText();
    assert.match(txtGaleria,/3 de 8/);assert.match(txtGaleria,/fabricante\.exemplo\.com\.br/);assert.match(txtGaleria,/Imagem ilustrativa/);assert.match(txtGaleria,/não prova a peça/);assert.match(txtGaleria,/aprovar não publica/);
    assert.equal(await galeria.locator(".galeria-item").nth(0).getByText("publicável",{exact:true}).count(),0,"pendente sem direitos nunca é publicável");
    assert.equal(await galeria.getByRole("button",{name:"Aprovar esta"}).count(),2,"só as pendentes têm botão de aprovar");
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true,`galeria sem overflow a ${width}px`);
    await page.keyboard.press("Escape");await modal.waitFor({state:"hidden"});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true,`sem overflow a ${width}px`);
    await page.screenshot({path:root+`evidencias-chat/catalogo-${width}.png`,fullPage:true});
    if(width===1280) {
      await query.fill("");
      await page.getByRole("status").filter({hasText:"505 encontrado(s)"}).waitFor();
      for(let n=1;n<=5;n++) {
        const btn=page.getByRole("button",{name:"Carregar mais 100"});
        await btn.click();
        await page.getByRole("status").filter({hasText:`${Math.min((n+1)*100,505)} carregado(s)`}).waitFor();
      }
      assert.equal(await page.locator(".catalogo-produto").count(),505);
      assert.ok(consultas.some(c=>c.offset>=500),"registro acima da posição 500 foi consultado");
      assert.equal(await page.getByRole("button",{name:"Carregar mais 100"}).count(),0,"última página não exibe Carregar mais");
    }
    { // ponte ficha -> Nano.IA: o pedido leva o produto e as pendências à caixa do chat, sem enviar nada
      await page.goto(base+"/#/catalogo");await page.getByRole("heading",{name:/Catálogo técnico/}).waitFor();
      await page.getByRole("searchbox",{name:"Buscar produto por SKU, nome, marca ou GTIN"}).fill("854008");
      await page.getByRole("status").filter({hasText:"1 encontrado(s)"}).waitFor();
      await page.getByRole("button",{name:"Ver ficha técnica"}).click();
      const ficha=page.getByRole("dialog");await ficha.waitFor();
      assert.equal(await ficha.getAttribute("aria-modal"),"false","ficha lateral não é modal");
      if(width>=960){const f=await ficha.boundingBox(),b=await page.getByRole("searchbox",{name:"Buscar produto por SKU, nome, marca ou GTIN"}).boundingBox();assert.ok(b.x+b.width<=f.x+1,`ficha ao lado do catálogo, sem cobrir a busca (${Math.round(b.x+b.width)} vs ${Math.round(f.x)})`);}
      await ficha.getByLabel("Propor outra posição").selectOption({label:"Bombas d'água"});
      await ficha.getByLabel(/O que você sabe sobre ele/).fill("acho que o fabricante é teste");
      { // correção de cadastro SEM IA: valida no cliente, cria só a PROPOSTA (nenhuma gravação no ERP)
        const marca=ficha.getByLabel(/Marca \(fabricante real\)/),fonte=ficha.getByLabel(/Fonte \(URL/),criar=ficha.getByRole("button",{name:"Criar proposta de correção"});
        await marca.fill("IMPORTADO");await fonte.fill("https://fabricante.exemplo.com.br/catalogo/854008");await criar.click();
        await ficha.getByText(/não identifica o fabricante/).waitFor();assert.equal(corrigirChamadas.length,0,"marca genérica nem chega ao servidor");
        await marca.fill("SABÓ");await ficha.getByLabel(/GTIN\/EAN/).fill("7891252828923");await fonte.fill("");await criar.click();
        await ficha.getByText(/Informe a fonte/).waitFor();assert.equal(corrigirChamadas.length,0,"sem fonte nada é enviado");
        await fonte.fill("https://fabricante.exemplo.com.br/catalogo/854008");await criar.click();
        await ficha.getByText(/nada foi gravado no Bling/).waitFor();
        assert.equal(corrigirChamadas.length,1);const corpo=corrigirChamadas[0];
        assert.equal(corpo.acao,"chat_corrigir_produto");assert.equal(corpo.sku,"854008");assert.deepEqual(corpo.campos,{marca:"SABÓ",gtin:"7891252828923"});
        assert.equal(JSON.stringify(corpo).includes("custo"),false);
      }
      await page.screenshot({path:root+`evidencias-chat/ficha-lateral-${width}.png`});
      const antesEnvios=writes.length;
      await ficha.getByRole("button",{name:"Pedir correção ao Nano.IA"}).click();
      await page.waitForFunction(()=>location.hash==="#/assistente");
      const caixa=page.getByRole("textbox").last();await caixa.waitFor();
      await page.waitForFunction(()=>[...document.querySelectorAll("textarea")].some(t=>t.value.includes("Corrigir o cadastro do produto SKU")));
      const v=await page.evaluate(()=>[...document.querySelectorAll("textarea")].find(t=>t.value.includes("Corrigir o cadastro"))?.value??"");
      assert.match(v,/854008/);assert.match(v,/hipótese, SEM fonte: confirme antes de usar\): acho que o fabricante é teste/);assert.match(v,/não aprova nem grava no Bling/);assert.match(v,/Posição na taxonomia sugerida pelo lojista \(hipótese, SEM fonte\): Arrefecimento › Bombas d'água/);
      assert.equal(v.includes("151,00"),false,"pedido sem custo");
      assert.deepEqual(writes.slice(antesEnvios).filter(x=>!x.url.endsWith("/functions/v1/assistente")&&!x.url.includes("/rest/v1/rpc/pode_")),[],"preencher a caixa não grava em nenhuma tabela nem no ERP (só leituras e checagem de permissão)");
      assert.ok((await page.evaluate(()=>[...document.querySelectorAll("textarea")].find(t=>t.value.includes("Corrigir o cadastro"))?.value??"")).length>0,"o texto continua na caixa: nada foi enviado");
      await page.screenshot({path:root+`evidencias-chat/ficha-pedir-correcao-${width}.png`});
    }
    assert.deepEqual(writes.filter(x=>/bling|produtos|produto_automacao/.test(x.url)),[],"nenhuma escrita no ERP ou catálogo");
    assert.deepEqual(errors,[],"sem exceções no navegador");
    await context.close();
    console.log(`Catalogo ${width}px: cartoes, SKU 854008 excluido, ficha sem custo, sem overflow`);
  }
}finally{await browser?.close();server.kill();}
