// Avatar orbital único do Nano.IA: 12 estados + falando, tema claro/escuro, 360/768/1440, com prefers-reduced-motion. Componente REAL (Orbe),
// sem rede. Gera as capturas em docs/evidencias/nano-avatar/ (ou no diretório de SAIDA). Falha se algum estado perder cor/rótulo ou se o repouso não ficar parado em reduced-motion.
import { createRequire } from 'node:module';
import { writeFile, rm, mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
const root=new URL('../../',import.meta.url).pathname,painel=root+'painel/';
const require=createRequire(painel+'package.json'),{chromium}=require('playwright');
const fixture=painel+'.avatar-demo.html',porta=4188,saida=process.env.SAIDA||root+'docs/evidencias/nano-avatar/';
const ESTADOS=['ocioso','escutando','interpretando','pesquisando_fontes','consultando_ferramentas','preparando_proposta','aguardando_aprovacao','executando','sincronizando_bling','concluido','erro','bloqueado','falando'];
await mkdir(saida,{recursive:true});
await writeFile(fixture,`<html lang="pt-BR"><meta name="viewport" content="width=device-width, initial-scale=1.0"><div id="root"></div><script type="module">import React from 'react';import {createRoot} from 'react-dom/client';import './src/styles.css';import './src/shell.css';import {Orbe} from './src/componentes/Esfera.tsx';import {ROTULO_ESTADO} from './src/lib/estadoAgente.ts';
const E=${JSON.stringify(ESTADOS)};const h=React.createElement;
createRoot(document.getElementById('root')).render(h('main',{style:{padding:16,background:'var(--fundo)',color:'var(--texto)'}},
 h('h1',{style:{fontSize:'1.1rem'}},'Nano.IA — avatar orbital'),
 h('div',{style:{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:18}},E.map(e=>h('figure',{key:e,style:{margin:0,display:'grid',justifyItems:'center',gap:10,padding:'18px 6px',border:'1px solid var(--borda)',borderRadius:12}},
  h('div',{style:{display:'flex',gap:18,alignItems:'center',minHeight:96}},h(Orbe,{estado:e,tamanho:40}),h(Orbe,{estado:e,tamanho:56}),h(Orbe,{estado:e,tamanho:96})),
  h('figcaption',{style:{fontSize:'.85rem'}},e==='falando'?'Falando':ROTULO_ESTADO[e]))))));</script></html>`);
const servidor=spawn(process.execPath,[painel+'node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(porta)],{cwd:painel,stdio:'ignore'});
let browser;
try{
 for(let i=0;i<100;i++){try{if((await fetch(`http://127.0.0.1:${porta}/.avatar-demo.html`)).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
 browser=await chromium.launch({headless:true});
 for(const tema of ['claro','escuro'])for(const largura of [360,768,1440]){
  const ctx=await browser.newContext({viewport:{width:largura,height:largura===1440?900:1100},colorScheme:tema==='escuro'?'dark':'light'});
  const page=await ctx.newPage(),erros=[];page.on('pageerror',e=>erros.push(e.message));
  await page.goto(`http://127.0.0.1:${porta}/.avatar-demo.html`);await page.waitForSelector('.orbe');
  await page.evaluate(t=>{document.documentElement.dataset.tema=t},tema);
  const n=await page.locator('.orbe').count();assert.equal(n,ESTADOS.length*3);
  const cores=await page.$$eval('.orbe-nucleo',els=>els.map(e=>getComputedStyle(e).boxShadow));
  assert.ok(cores.every(c=>c&&c!=='none'),'todo estado tem brilho próprio');
  const ov=await page.evaluate(()=>{const W=window.innerWidth;return [...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>W+1&&!e.closest('.orbe')).map(e=>e.tagName+'.'+e.className).slice(0,5)});assert.deepEqual(ov,[],'sem rolagem horizontal em '+largura);
  await page.screenshot({path:`${saida}estados-${tema}-${largura}.png`,fullPage:true});
  assert.deepEqual(erros,[]);await ctx.close();
 }
 // movimento: ocioso quase parado, ativo anima, estado terminal parado; reduced-motion zera tudo
 const ctx=await browser.newContext({viewport:{width:768,height:900}}),page=await ctx.newPage();
 await page.goto(`http://127.0.0.1:${porta}/.avatar-demo.html`);await page.waitForSelector('.orbe');
 const play=async e=>page.$eval(`.orbe[data-estado="${e}"] .orbe-anel`,el=>getComputedStyle(el).animationPlayState);
 assert.equal(await play('interpretando'),'running');assert.equal(await play('aguardando_aprovacao'),'paused');assert.equal(await play('concluido'),'paused');assert.equal(await play('erro'),'paused');assert.equal(await play('bloqueado'),'paused');
 const rmCtx=await browser.newContext({viewport:{width:768,height:900},reducedMotion:'reduce'}),p2=await rmCtx.newPage();
 await p2.goto(`http://127.0.0.1:${porta}/.avatar-demo.html`);await p2.waitForSelector('.orbe');
 const nomes=await p2.$$eval('.orbe-anel,.orbe-nucleo',els=>els.map(e=>getComputedStyle(e).animationName));
 assert.ok(nomes.every(x=>x==='none'),'reduced-motion: nada anima');
 await p2.screenshot({path:`${saida}reduced-motion-768.png`,fullPage:true});
 console.log('OK: avatar orbital em 12 estados + falando, claro/escuro, 360/768/1440, reduced-motion');
}finally{await browser?.close();servidor.kill();await rm(fixture,{force:true})}
