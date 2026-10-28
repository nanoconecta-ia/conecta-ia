// Versão do painel visível e aviso de versão nova: o aparelho sabe dizer qual versão roda e avisa (com botão) quando há outra publicada. Sessão e rede 100% SINTÉTICAS.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const root=new URL('../../',import.meta.url).pathname,painel=root+'painel/';
const require=createRequire(painel+'package.json'),{chromium}=require('playwright');
const porta=4200,base=`http://127.0.0.1:${porta}`,REF='dsfzhsrudriqkumtlqwj';
const MINHA='aaaaaaa1111111',NOVA='bbbbbbb2222222';
const servidor=spawn(process.execPath,[painel+'node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(porta)],{cwd:painel,stdio:'ignore',env:{...process.env,GITHUB_SHA:MINHA}});
let browser;const falhas=[];const ver=(c,m)=>{if(!c)falhas.push(m)};
try{
 for(let i=0;i<100;i++){try{if((await fetch(base+'/')).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
 browser=await chromium.launch({headless:true});
 await mkdir(root+'evidencias-chat',{recursive:true});
 for(const [remota,w,h] of [[NOVA,390,844],[NOVA,360,640],[MINHA,390,844],[NOVA,1280,800]]){
  const r=`${w}x${h} remota=${remota.slice(0,7)}`;
  const ctx=await browser.newContext({viewport:{width:w,height:h}}),page=await ctx.newPage(),erros=[];
  page.on('pageerror',e=>erros.push(e.message));
  const sessao={access_token:'s.s.s',refresh_token:'s',token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user:{id:'11111111-1111-1111-1111-111111111111',aud:'authenticated',role:'authenticated',email:'demo@exemplo.invalid',app_metadata:{},user_metadata:{},created_at:'2026-01-01T00:00:00Z'}};
  await page.addInitScript(([k,v])=>localStorage.setItem(k,v),[`sb-${REF}-auth-token`,JSON.stringify(sessao)]);
  await page.route('**/*',async route=>{const u=new URL(route.request().url());
   if(u.hostname==='127.0.0.1'&&u.pathname.endsWith('/version.json'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({commit:remota.slice(0,7),construido:'2026-10-28T11:44:00.000Z'})});
   if(u.hostname==='127.0.0.1')return route.continue();
   if(!u.hostname.endsWith('supabase.co'))throw Error('Rede não permitida no teste: '+u.hostname);
   const hd={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'};
   if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers:hd});
   if(u.pathname.endsWith('/rest/v1/lojas'))return route.fulfill({status:200,contentType:'application/json',headers:hd,body:JSON.stringify([{id:'aaaaaaaa-0000-0000-0000-000000000001',nome:'Loja DEMO',slug:'loja-demo',modo_venda:'whatsapp',ambiente:'teste',perfil_ramo:null}])});
   if(u.pathname.endsWith('/auth/v1/user'))return route.fulfill({status:200,contentType:'application/json',headers:hd,body:JSON.stringify(sessao.user)});
   if(u.pathname.endsWith('/functions/v1/assistente'))return route.fulfill({status:200,contentType:'application/json',headers:hd,body:JSON.stringify({verificado:true,provedores:[],conversas:[],registros:[]})});
   return route.fulfill({status:200,contentType:'application/json',headers:hd,body:u.pathname.includes('/rest/v1/')?'[]':'{}'})});
  await page.goto(`${base}/#/`);
  const barra=page.getByRole('status',{name:'Estado do painel'});await barra.waitFor();
  ver(new RegExp(`v${MINHA.slice(0,7)}`).test(await barra.innerText()),`${r}: a barra mostra a versão em uso (v${MINHA.slice(0,7)})`);
  const aviso=page.locator('.aviso-versao');
  if(remota===MINHA){await page.waitForTimeout(800);ver(await aviso.count()===0,`${r}: versão igual não avisa`)}
  else{
   await aviso.waitFor();const t=await aviso.innerText();
   ver(t.includes(NOVA.slice(0,7))&&t.includes(MINHA.slice(0,7)),`${r}: aviso diz a versão nova e a em uso (${t.replace(/\n/g,' ')})`);
   const b=await aviso.getByRole('button',{name:'Atualizar agora'}).boundingBox();ver(b&&b.height>=44&&b.x>=0&&b.x+b.width<=w,`${r}: botão Atualizar à vista e com alvo >= 44px`);
   await page.screenshot({path:root+`evidencias-chat/versao-aviso-${w}x${h}.png`});
   const recarregou=page.waitForNavigation({timeout:5000}).then(()=>true,()=>false);
   await aviso.getByRole('button',{name:'Atualizar agora'}).click();ver(await recarregou,`${r}: Atualizar agora recarrega a página`);
  }
  ver(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),`${r}: sem rolagem horizontal`);
  ver(erros.length===0,`${r}: sem erro de página (${erros.join(';')})`);
  await ctx.close();
 }
}finally{await browser?.close();servidor.kill()}
assert.equal(falhas.length,0,'\n'+falhas.join('\n'));
console.log('versao-visual: OK');
