// Nano Visual Fidelity (Imagens e SEO): foto só no navegador, comparação no mesmo recorte, 3 checagens obrigatórias, banner sem texto sobre a foto,
// configuração por aparelho e layout sem estouro em celular/desktop. Sessão, rede e FOTO 100% SINTÉTICAS (desenhadas num canvas).
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const root=new URL('../../',import.meta.url).pathname,painel=root+'painel/';
const require=createRequire(painel+'package.json'),{chromium}=require('playwright');
const porta=4197,base=`http://127.0.0.1:${porta}`,REF='dsfzhsrudriqkumtlqwj';
const servidor=spawn(process.execPath,[painel+'node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(porta)],{cwd:painel,stdio:'ignore'});
let browser;const falhas=[];const ver=(c,m)=>{if(!c)falhas.push(m)};
try{
 for(let i=0;i<100;i++){try{if((await fetch(base+'/')).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
 browser=await chromium.launch({headless:true});
 await mkdir(root+'evidencias-chat',{recursive:true});
 for(const [w,h] of [[1280,800],[390,844],[360,740],[844,390]]){
  const r=`${w}x${h}`;
  const ctx=await browser.newContext({viewport:{width:w,height:h}}),page=await ctx.newPage(),erros=[],envios=[];
  page.on('pageerror',e=>erros.push(e.message));
  const sessao={access_token:'s.s.s',refresh_token:'s',token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user:{id:'11111111-1111-1111-1111-111111111111',aud:'authenticated',role:'authenticated',email:'demo@exemplo.invalid',app_metadata:{},user_metadata:{},created_at:'2026-01-01T00:00:00Z'}};
  await page.addInitScript(([k,v])=>localStorage.setItem(k,v),[`sb-${REF}-auth-token`,JSON.stringify(sessao)]);
  await page.route('**/*',async route=>{
   const u=new URL(route.request().url());
   if(u.hostname==='127.0.0.1'||u.protocol==='blob:')return route.continue();
   if(!u.hostname.endsWith('supabase.co'))throw Error('Rede não permitida no teste: '+u.hostname);
   if(['POST','PUT','PATCH'].includes(route.request().method())&&u.pathname.includes('/storage/'))envios.push(u.pathname);
   const hd={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'};
   if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers:hd});
   if(u.pathname.endsWith('/rest/v1/lojas'))return route.fulfill({status:200,contentType:'application/json',headers:hd,body:JSON.stringify([{id:'aaaaaaaa-0000-0000-0000-000000000001',nome:'Loja DEMO',slug:'loja-demo',modo_venda:'whatsapp',ambiente:'teste',perfil_ramo:null}])});
   if(u.pathname.endsWith('/functions/v1/assistente')){const a=JSON.parse(route.request().postData()||'{}').acao;return route.fulfill({status:200,contentType:'application/json',headers:hd,body:JSON.stringify(a==='provedores'?{verificado:true,provedores:[]}:a==='chat_config'?{persistente:false,bling:false,leitura_administrativa:false,retencao_dias:180}:{conversas:[],registros:[]})})}
   if(u.pathname.endsWith('/auth/v1/user'))return route.fulfill({status:200,contentType:'application/json',headers:hd,body:JSON.stringify(sessao.user)});
   return route.fulfill({status:200,contentType:'application/json',headers:hd,body:u.pathname.includes('/rest/v1/')?'[]':'{}'});
  });
  await page.goto(`${base}/#/imagens`);
  await page.getByRole('heading',{name:/Nano Visual Fidelity/}).waitFor();
  // foto sintética: peça cinza com furos e uma inscrição, desenhada no navegador
  const b64=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=1200;c.height=900;const x=c.getContext('2d');x.fillStyle='#8a8d91';x.fillRect(0,0,1200,900);x.fillStyle='#3c3f43';for(const [a,b] of [[300,300],[900,300],[300,600],[900,600]]){x.beginPath();x.arc(a,b,55,0,7);x.fill()}x.fillStyle='#e8e8e8';x.font='64px sans-serif';x.fillText('SINTETICA 0001',330,470);return c.toDataURL('image/png').split(',')[1]});
  const buffer=Buffer.from(b64,'base64');
  // tipo inválido é recusado
  await page.locator('input[type=file]').setInputFiles({name:'x.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF')});
  ver(await page.getByRole('alert').filter({hasText:'JPG'}).count()===1,`${r}: PDF recusado com aviso`);
  await page.locator('input[type=file]').setInputFiles({name:'peca-sintetica.png',mimeType:'image/png',buffer});
  const comp=page.getByRole('region',{name:/Original × melhorada/}).or(page.locator('section[aria-labelledby="fid-comp"]'));await comp.waitFor();
  const sha=await comp.locator('.fid-sha').innerText();
  ver(/SHA-256 [0-9a-f]{64}/.test(sha),`${r}: SHA-256 do original exibido (${sha.slice(0,60)})`);
  // mesmo recorte nos dois lados, original sem filtro, melhorada com filtro de luz
  const quadros=comp.locator('.fid-quadro');
  const est=async(i)=>quadros.nth(i).evaluate(e=>{const s=getComputedStyle(e);return {size:s.backgroundSize,pos:s.backgroundPosition,filter:s.filter}});
  let a=await est(0),b2=await est(1);
  ver(a.size===b2.size&&a.pos===b2.pos,`${r}: mesmo recorte nos dois lados`);
  ver(a.filter==='none'&&b2.filter!=='none',`${r}: original sem filtro; melhorada com filtro`);
  await comp.locator('input[type=range]').fill('3');
  a=await est(0);b2=await est(1);ver(a.size===b2.size&&parseFloat(a.size)===300,`${r}: zoom 3x vale para os dois (${a.size})`);
  // clique muda o ponto de interesse nos dois
  {const bb=await quadros.nth(0).boundingBox();await quadros.nth(0).click({position:{x:bb.width*0.25,y:bb.height*0.25}})}
  a=await est(0);b2=await est(1);ver(a.pos===b2.pos&&Math.abs(parseFloat(a.pos)-25)<2,`${r}: ponto de interesse igual nos dois (${a.pos})`);
  // aprovação só com as 3 checagens
  const aprovar=comp.getByRole('button',{name:'Aprovar uso interno'});
  ver(await aprovar.isDisabled(),`${r}: aprovar bloqueado sem checagens`);
  const caixas=comp.getByRole('checkbox');ver(await caixas.count()===3,`${r}: 3 checagens`);
  await caixas.nth(0).check();await caixas.nth(1).check();ver(await aprovar.isDisabled(),`${r}: aprovar segue bloqueado com 2 de 3`);
  for(const c of await caixas.all()){const l=await c.locator('xpath=ancestor::label').boundingBox();ver(l.height>=44,`${r}: checagem com alvo >= 44px (${Math.round(l.height)})`)}
  await caixas.nth(2).check();ver(await aprovar.isEnabled(),`${r}: aprovar libera com 3 de 3`);
  await aprovar.click();ver(/não publica|Aprovada para uso interno/.test(await comp.getByRole('status').innerText()),`${r}: aprovação diz que não publica`);
  // banner: 3 formatos, tudo dentro da tela, nenhum texto sobre a foto
  const ban=page.locator('section[aria-labelledby="fid-banner"]');await ban.waitFor();
  await ban.getByLabel('Nome da peça no banner').fill('Bomba d’água');
  for(const f of await ban.locator('figure.fid-banner').all()){
   const bx=await f.boundingBox();ver(bx.x>=-0.5&&bx.x+bx.width<=w+0.5,`${r}: banner ${await f.getAttribute('data-formato')} dentro da tela`);
   const t=await f.locator('.fid-banner-texto').boundingBox(),ft=await f.locator('.fid-banner-foto').boundingBox();
   const cruza=Math.max(0,Math.min(t.x+t.width,ft.x+ft.width)-Math.max(t.x,ft.x))*Math.max(0,Math.min(t.y+t.height,ft.y+ft.height)-Math.max(t.y,ft.y));
   ver(cruza<2,`${r}: texto do banner não cobre a foto (${Math.round(cruza)} px²)`);
   ver((await f.locator('.fid-banner-foto').innerText()).trim()==='',`${r}: nenhum texto dentro da foto`);
  }
  ver(!/R\$|\d{3,}/.test((await ban.innerText()).replace(/SHA.*/,'')),`${r}: banner sem preço nem código`);
  // desligar esconde a ferramenta; indisponíveis ficam bloqueados; config vale no aparelho (recarregar mantém)
  const conf=page.locator('section[aria-labelledby="fid-config"]');
  ver(await conf.getByRole('radio',{name:/Automático restrito/}).isDisabled(),`${r}: automático restrito indisponível`);
  ver(await conf.getByRole('checkbox',{name:/veículos compatíveis/}).isDisabled(),`${r}: veículos compatíveis indisponível (sem documentação)`);
  await conf.getByRole('radio',{name:/Desligado/}).check();
  ver(await page.locator('section[aria-labelledby="fid-comp"]').count()===0&&await page.locator('section[aria-labelledby="fid-banner"]').count()===0,`${r}: desligado esconde comparador e banner`);
  await page.reload();await page.getByRole('heading',{name:/Nano Visual Fidelity/}).waitFor();
  ver(await page.locator('section[aria-labelledby="fid-config"]').getByRole('radio',{name:/Desligado/}).isChecked(),`${r}: modo lembrado neste aparelho`);
  await page.locator('section[aria-labelledby="fid-config"]').getByRole('button',{name:'Restaurar padrão'}).click();
  ver(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),`${r}: sem rolagem horizontal`);
  ver(envios.length===0,`${r}: foto não foi enviada (${envios.join(',')})`);
  ver(erros.length===0,`${r}: sem erro de página (${erros.join(';')})`);
  // captura de evidência com a foto carregada
  await page.locator('input[type=file]').setInputFiles({name:'peca-sintetica.png',mimeType:'image/png',buffer});await comp.waitFor();
  await page.screenshot({path:root+`evidencias-chat/fidelidade-${r}.png`,fullPage:true});
  await ctx.close();
 }
}finally{await browser?.close();servidor.kill()}
assert.equal(falhas.length,0,'\n'+falhas.join('\n'));
console.log('fidelidade-visual: OK');
