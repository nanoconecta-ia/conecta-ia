// Chat em TELA CHEIA: o chat ocupa tudo entre o cabeçalho e a barra de status, sem largura máxima nem margens. App inteiro, sessão e rede 100% SINTÉTICAS.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
const root=new URL('../../',import.meta.url).pathname,painel=root+'painel/';
const require=createRequire(painel+'package.json'),{chromium}=require('playwright');
const porta=4192,base=`http://127.0.0.1:${porta}`;
const REF='dsfzhsrudriqkumtlqwj',saida=process.env.SAIDA||root+'docs/evidencias/chat-tela-cheia/';await (await import('node:fs/promises')).mkdir(saida,{recursive:true});
const servidor=spawn(process.execPath,[painel+'node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(porta)],{cwd:painel,stdio:'ignore'});
let browser;
try{
 for(let i=0;i<100;i++){try{if((await fetch(base+'/')).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
 browser=await chromium.launch({headless:true});
 for(const [largura,altura] of [[390,844],[1280,800],[1440,900],[1920,1080]]){
  const context=await browser.newContext({viewport:{width:largura,height:altura}});
  const page=await context.newPage(),erros=[];
  page.on('pageerror',e=>erros.push(e.message));
  const sessao={access_token:'sintetico.sintetico.sintetico',refresh_token:'sintetico',token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user:{id:'11111111-1111-1111-1111-111111111111',aud:'authenticated',role:'authenticated',email:'demo@exemplo.invalid',app_metadata:{},user_metadata:{},created_at:'2026-01-01T00:00:00Z'}};
  await page.addInitScript(([k,v])=>localStorage.setItem(k,v),[`sb-${REF}-auth-token`,JSON.stringify(sessao)]);
  await page.route('**/*',async route=>{
   const u=new URL(route.request().url());
   if(u.hostname==='127.0.0.1')return route.continue();
   if(!u.hostname.endsWith('supabase.co')){throw Error('Rede não permitida no teste: '+u.hostname)}
   const h={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'};
   if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers:h});
   if(u.pathname.endsWith('/rest/v1/lojas'))return route.fulfill({status:200,contentType:'application/json',headers:h,body:JSON.stringify([{id:'aaaaaaaa-0000-0000-0000-000000000001',nome:'Loja DEMO',slug:'loja-demo',modo_venda:'whatsapp',ambiente:'teste',perfil_ramo:null}])});
   if(u.pathname.endsWith('/functions/v1/assistente')){const acao=JSON.parse(route.request().postData()||'{}').acao;return route.fulfill({status:200,contentType:'application/json',headers:h,body:JSON.stringify(acao==='provedores'?{verificado:true,provedores:[]}:acao==='chat_config'?{persistente:false,bling:false,leitura_administrativa:false,retencao_dias:180}:{conversas:[],registros:[]})})}
   if(u.pathname.endsWith('/auth/v1/user'))return route.fulfill({status:200,contentType:'application/json',headers:h,body:JSON.stringify(sessao.user)});
   return route.fulfill({status:200,contentType:'application/json',headers:h,body:u.pathname.includes('/rest/v1/')?'[]':'{}'});
  });
  await page.goto(`${base}/#/assistente`);
  const caixa=page.locator('.abas-caixa');await caixa.waitFor();
  await page.waitForFunction(()=>getComputedStyle(document.documentElement).getPropertyValue('--cab-altura').trim()!=='');
  const c=await caixa.boundingBox(),topo=await page.locator('.topo').boundingBox(),barra=await page.locator('.barra-status').boundingBox();
  const tol=3;
  assert.ok(Math.abs(c.y-(topo.y+topo.height))<=tol,`${largura}px: o chat começa logo abaixo do cabeçalho (${c.y} vs ${topo.y+topo.height})`);
  assert.ok(Math.abs((c.y+c.height)-barra.y)<=tol,`${largura}px: o chat termina logo acima da barra de status (${c.y+c.height} vs ${barra.y})`);
  const menu=await page.locator('.menu').first().boundingBox().catch(()=>null);
  const usado=c.width/(largura-(menu&&menu.width<largura*0.6&&menu.x<5?menu.width:0));
  assert.ok(usado>=0.97,`${largura}px: o chat usa ${Math.round(usado*100)}% da largura livre`);
  if(largura>=1440)assert.ok(c.width>1100,`${largura}px: sem o teto de 1100px (${Math.round(c.width)}px)`);
  const centro=await page.locator('.abas-centro').boundingBox();
  assert.ok(centro.height>=altura*0.6,`${largura}px: a conversa tem altura útil (${Math.round(centro.height)} de ${altura})`);
  assert.ok((c.y+c.height)-(centro.y+centro.height)<=14,`${largura}px: a conversa vai até o rodapé do chat, sem faixa vazia (${Math.round((c.y+c.height)-(centro.y+centro.height))}px)`);
  const compos=await page.locator('.chat-compositor').boundingBox();
  assert.ok(compos.y+compos.height<=barra.y+tol&&compos.y>=topo.y,`${largura}px: o compositor fica à vista, acima da barra de status`);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true,`sem rolagem horizontal a ${largura}px`);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollHeight<=window.innerHeight+2),true,`${largura}px: a página não rola; só a conversa rola`);
  await page.screenshot({path:`${saida}chat-tela-cheia-${largura}.png`});
  assert.deepEqual(erros,[]);
  await context.close();
 }
 console.log('chat-tela-cheia-visual ok (390, 1280, 1440 e 1920px: chat entre o cabeçalho e a barra de status, sem teto de largura, compositor à vista)');
}finally{await browser?.close();servidor.kill()}
