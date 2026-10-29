// Visão Geral: renderização responsiva, isolamento por loja e nenhuma escrita no Bling.
// Sessão e todas as respostas externas são sintéticas; nenhum dado vai à produção.
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import assert from "node:assert/strict";

const root = new URL("../../", import.meta.url).pathname, painel = root + "painel/";
const require = createRequire(painel + "package.json"), { chromium } = require("playwright");
const port = 4208, base = `http://127.0.0.1:${port}`, ref = "dsfzhsrudriqkumtlqwj";
const lojaId = "aaaaaaaa-0000-0000-0000-000000000001";
const server = spawn(process.execPath, [painel + "node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", String(port)], { cwd: painel, stdio: "ignore" });
let browser;
try {
  for (let i=0;i<100;i++) { try { if ((await fetch(base+"/")).ok) break; } catch {} await new Promise(r=>setTimeout(r,100)); }
  browser = await chromium.launch({ headless: true });
  await mkdir(root + "evidencias-chat", { recursive: true });
  for (const [width, height] of [[300,640],[390,844],[1280,800]]) {
    const ctx = await browser.newContext({ viewport: { width, height } });
    const page = await ctx.newPage();
    const errors = [], calls = [];
    let notices = [{ id:"bbbbbbbb-0000-0000-0000-000000000002", titulo:"Verificação pendente", corpo:"Conferir dado antes de publicar.", severidade:"atencao", fonte_url:"javascript:alert(1)", lida_em:null }];
    page.on("pageerror", err => errors.push(err.message));
    const session = { access_token:"s.s.s", refresh_token:"s", token_type:"bearer", expires_in:3600, expires_at:Math.floor(Date.now()/1000)+3600, user:{ id:"11111111-1111-1111-1111-111111111111", aud:"authenticated", role:"authenticated", email:"demo@exemplo.invalid", app_metadata:{}, user_metadata:{}, created_at:"2026-01-01T00:00:00Z" } };
    await page.addInitScript(([k,v])=>localStorage.setItem(k,v), [`sb-${ref}-auth-token`, JSON.stringify(session)]);
    await page.route("**/*", async route => {
      const req = route.request(), u = new URL(req.url());
      if (u.hostname === "127.0.0.1") return route.continue();
      assert.ok(u.hostname.endsWith("supabase.co"), "Rede externa não autorizada no teste: " + u.hostname);
      const headers = { "access-control-allow-origin":"*", "access-control-allow-headers":"*", "access-control-allow-methods":"*", "content-range":"0-0/12" };
      if (req.method()==="OPTIONS") return route.fulfill({ status:204, headers });
      if (u.pathname.endsWith("/auth/v1/user")) return route.fulfill({ status:200, headers, contentType:"application/json", body:JSON.stringify(session.user) });
      if (u.pathname.endsWith("/rest/v1/lojas")) return route.fulfill({ status:200, headers, contentType:"application/json", body:JSON.stringify([{ id:lojaId, nome:"Mobis DEMO", slug:"mobis-demo", ambiente:"teste", modo_venda:"whatsapp", perfil_ramo:"autopecas" }]) });
      if (u.pathname.endsWith("/rest/v1/notificacoes")) {
        calls.push({ method:req.method(), scope:u.searchParams.get("loja_id"), id:u.searchParams.get("id") });
        assert.equal(u.searchParams.get("loja_id"), "eq." + lojaId, "notificação sem escopo da loja");
        if (req.method()==="PATCH") { notices=[]; return route.fulfill({ status:204, headers }); }
        return route.fulfill({ status:200, headers, contentType:"application/json", body:JSON.stringify(notices) });
      }
      if (u.pathname.endsWith("/rest/v1/bling_conexoes")) return route.fulfill({ status:200, headers, contentType:"application/json", body:JSON.stringify({status:"conectada"}) });
      if (u.pathname.endsWith("/rest/v1/produtos") || u.pathname.endsWith("/rest/v1/produto_enriquecimento"))
        return route.fulfill({status:200,headers,contentType:"application/json",body:"[]"});
      if (u.pathname.endsWith("/functions/v1/assistente")) { const a=JSON.parse(req.postData()||"{}").acao; return route.fulfill({status:200,headers,contentType:"application/json",body:JSON.stringify(a==="provedores"?{verificado:true,provedores:[]}:a==="chat_config"?{persistente:false,bling:false,leitura_administrativa:false,retencao_dias:180}:{conversas:[],registros:[]})}); }
      return route.fulfill({status:200,headers,contentType:"application/json",body:u.pathname.includes("/rest/v1/")?"[]":"{}"});
    });
    await page.goto(base + "/#/");
    await page.getByRole("heading", { name:/Sua loja, sob controle/ }).waitFor();
    await page.getByText("Verificação pendente").waitFor();
    await page.locator(".visao-kpi-conexao .visao-status").getByText("Conectado", { exact:true }).waitFor();
    assert.equal(await page.getByRole("link", { name:"Ver referência" }).count(),0,"URL javascript bloqueada");
    assert.equal(await page.locator(".visao-acesso").count(),6,"seis módulos reais disponíveis");
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`sem rolagem horizontal em ${width}px`);
    await page.screenshot({path:root+`evidencias-chat/visao-geral-${width}.png`,fullPage:true});
    await page.getByRole("button", {name:"Marcar resolvido"}).click();
    await page.getByText("Sem avisos pendentes").waitFor();
    assert.ok(calls.some(c=>c.method==="PATCH" && c.id === "eq.bbbbbbbb-0000-0000-0000-000000000002"),"atualização id+loja");
    assert.deepEqual(errors,[],"sem erros JS");
    await ctx.close();
    console.log(`Visão Geral ${width}px: indicadores, alertas por loja, nenhum overflow, URL segura e aprovação inalterada`);
  }
} finally { await browser?.close(); server.kill(); }
