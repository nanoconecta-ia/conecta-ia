// Balão flutuante do Gênesis em qualquer tela do painel (390px e desktop). Sessão e rede 100% SINTÉTICAS; nada sai para produção.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
const root=new URL('../../',import.meta.url).pathname,painel=root+'painel/';
const require=createRequire(painel+'package.json'),{chromium}=require('playwright');
const porta=4184,base=`http://127.0.0.1:${porta}`;
const REF='dsfzhsrudriqkumtlqwj';
const servidor=spawn(process.execPath,[painel+'node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(porta)],{cwd:painel,stdio:'ignore'});
let browser;
try{
 for(let i=0;i<100;i++){try{if((await fetch(base+'/')).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
 browser=await chromium.launch({headless:true});
 for(const [largura,altura] of [[390,844],[1280,800]]){
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
  await page.goto(`${base}/#/catalogo`);
  const balao=page.getByRole('button',{name:'Abrir o Gênesis'});await balao.waitFor();
  const caixa=await balao.boundingBox();
  assert.ok(caixa.x+caixa.width<=largura&&caixa.y+caixa.height<=altura,`balão dentro da tela a ${largura}px`);
  await balao.click();
  const dock=page.locator('#dock-agente');await dock.waitFor({state:'visible'});
  const d=await dock.boundingBox();
  assert.ok(d.x>=0&&d.x+d.width<=largura&&d.y>=0&&d.y+d.height<=altura,`janela do Gênesis cabe a ${largura}px`);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true,'sem rolagem horizontal');
  await page.getByRole('button',{name:'Fechar o Gênesis'}).first().click();
  await dock.waitFor({state:'hidden'});
  await balao.click();await page.keyboard.press('Escape');await dock.waitFor({state:'hidden'});
  assert.deepEqual(erros,[]);
  await context.close();
 }
 console.log('balao-genesis-visual ok (390px e 1280px: balão, janela, fechar e Esc)');
}finally{await browser?.close();servidor.kill()}
