// UI regressão para a área autenticada de enriquecimento, sem Bling real e com backend sintético.
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import assert from "node:assert/strict";
const root=new URL("../../",import.meta.url).pathname,painel=root+"painel/";
const require=createRequire(painel+"package.json"),{chromium}=require("playwright");
const port=4232,base="http://127.0.0.1:"+port;
const ref="dsfzhsrudriqkumtlqwj", lojaId="aaaaaaaa-0000-0000-0000-000000000001";
const produtoId="bbbbbbbb-0000-0000-0000-000000000001";
const produto={id:produtoId,sku:"CI003696",nome:"MOTOR D4CB — PRODUTO SINTÉTICO",bling_id:"12345678",
 publicado:false,descricao_curta:"Descrição de teste",descricao_complementar:null};
const session={access_token:"s.s.s",refresh_token:"s",token_type:"bearer",expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,
 user:{id:"11111111-1111-1111-1111-111111111111",aud:"authenticated",role:"authenticated",email:"teste@exemplo.invalid",app_metadata:{},user_metadata:{},created_at:"2026-01-01T00:00:00Z"}};
const server=spawn(process.execPath,[painel+"node_modules/vite/bin/vite.js","--host","127.0.0.1","--port",String(port)],{cwd:painel,stdio:"ignore"});
let browser;
try{
 for(let i=0;i<90;i++){try{if((await fetch(base+"/")).ok)break}catch{}await new Promise(r=>setTimeout(r,130))}
 browser=await chromium.launch({headless:true});
 await mkdir(root+"evidencias-chat",{recursive:true});
 for(const width of [360,390,1280]){
  const ctx=await browser.newContext({viewport:{width,height:820}});
  const page=await ctx.newPage(),erros=[],calls=[],writes=[];
  page.on("pageerror",e=>erros.push(e.message));
  await page.addInitScript(([key,value])=>localStorage.setItem(key,value),
   ["sb-"+ref+"-auth-token",JSON.stringify(session)]);
  await page.route("**/*",async route=>{
    const request=route.request(),u=new URL(request.url());
    if(u.hostname==="127.0.0.1")return route.continue();
    assert.ok(u.hostname.endsWith("supabase.co"),"Apenas backend sintético");
    const h={"access-control-allow-origin":"*","access-control-allow-headers":"*",
      "access-control-allow-methods":"*","access-control-expose-headers":"content-range"};
    if(request.method()==="OPTIONS")return route.fulfill({status:204,headers:h});
    if(request.method()!=="GET")writes.push({url:u.pathname,method:request.method()});
    if(u.pathname.endsWith("/auth/v1/user"))return route.fulfill({status:200,contentType:"application/json",headers:h,body:JSON.stringify(session.user)});
    if(u.pathname.endsWith("/rest/v1/lojas"))return route.fulfill({status:200,contentType:"application/json",headers:h,
      body:JSON.stringify([{id:lojaId,nome:"Mobis TESTE SINTÉTICO",slug:"mobis",ambiente:"teste",modo_venda:"whatsapp",ativa:true}])});
    if(u.pathname.endsWith("/rest/v1/produtos")) {
      assert.equal(u.searchParams.get("loja_id"),"eq."+lojaId,"produto isolado na própria loja");
      return route.fulfill({status:200,contentType:"application/json",headers:h,body:JSON.stringify([produto])});
    }
    if(u.pathname.endsWith("/functions/v1/conector-ferramentas")){
      const p=JSON.parse(request.postData()??"{}");calls.push(p);
      const resultado=p.acao==="consultar_bling" ? {nome:produto.nome,sku:produto.sku}
        :p.acao==="preparar_erp" ? {proposta_id:"cccccccc-0000-0000-0000-000000000001",versao:1,hash:"sintetico"} :{status:"a_confirmar"};
      return route.fulfill({status:200,contentType:"application/json",headers:h,body:JSON.stringify({ok:true,resultado,observacao:"Nenhuma gravação foi enviada ao Bling."})});
    }
    if(u.pathname.endsWith("/functions/v1/agente")){
      const p=JSON.parse(request.postData()??"{}");calls.push({acao:"indexar",...p});
      return route.fulfill({status:200,contentType:"application/json",headers:h,
        body:JSON.stringify({gravados:["tipo_literal"],passos_pendentes:[4,5,6,7,8]})});
    }
    return route.fulfill({status:200,contentType:"application/json",headers:h,body:u.pathname.includes("/rest/v1/")?"[]":"{}"});
  });
  await page.goto(base+"/#/ferramentas?sku=CI003696");
  await page.getByRole("heading",{name:"Indexar e enriquecer"}).waitFor({timeout:20000});
  await page.getByText("MOTOR D4CB — PRODUTO SINTÉTICO").waitFor({timeout:10000});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,"sem rolagem lateral "+width);
  await page.getByRole("button",{name:/Consultar produto diretamente/}).click();
  await page.getByText(/Consulta nativa realizada pelo conector/).waitFor();
  await page.getByRole("button",{name:"Indexar este SKU"}).click();
  await page.getByText(/Indexação executada/).waitFor();
  await page.getByLabel("Conteúdo técnico proposto").fill("Descrição técnica — SIMULADA para teste de UI.");
  await page.getByLabel("Fonte ou documento da informação").fill("Manual sintético do fabricante");
  await page.getByRole("button",{name:"Preparar atualização no Bling · sem gravar"}).click();
  await page.getByText(/Proposta de escrita preparada/).waitFor();
  const link=page.getByRole("link",{name:"Abrir proposta para aprovação"});
  assert.ok((await link.getAttribute("href"))?.startsWith("#/central?proposta="),"aprovador abre na Central");
  assert.ok(calls.some(x=>x.acao==="indexar"),"indexação acionada");
  assert.ok(calls.some(x=>x.acao==="consultar_bling"),"consulta real simulada pela API");
  assert.ok(calls.some(x=>x.acao==="preparar_erp"),"proposta versionada enviada");
  assert.equal(writes.some(w=>w.method==="PATCH"||w.url.includes("api.bling.com.br")),false,"nenhum PATCH nem escrita direta");
  assert.deepEqual(erros,[],"sem erro JS");
  await page.screenshot({path:root+"evidencias-chat/ferramentas-mobis-"+width+"-SIMULADO.png",fullPage:false});
  await ctx.close();
  console.log("FERRAMENTAS MOBIS "+width+"px OK: consulta, indexação e proposta sem ERP real");
 }
}finally{await browser?.close();server.kill("SIGTERM");}