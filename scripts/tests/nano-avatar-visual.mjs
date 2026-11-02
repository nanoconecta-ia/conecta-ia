// Avatar RoboNano único do Nano.IA: 12 estados + falando, tema claro/escuro, 360/768/1440, com prefers-reduced-motion. Componente REAL (RoboNano),
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
await writeFile(fixture,`<html lang="pt-BR"><meta name="viewport" content="width=device-width, initial-scale=1.0"><div id="root"></div><script type="module">import React from 'react';import {createRoot} from 'react-dom/client';import './src/styles.css';import './src/shell.css';import {RoboNano} from './src/componentes/RoboNano.tsx';import {ROTULO_ESTADO} from './src/lib/estadoAgente.ts';import {aplicarOrbe,lerOrbe} from './src/lib/orbe.ts';aplicarOrbe(lerOrbe(null));
const E=${JSON.stringify(ESTADOS)};const h=React.createElement;
createRoot(document.getElementById('root')).render(h('main',{style:{padding:16,background:'var(--fundo)',color:'var(--texto)'}},
 h('h1',{style:{fontSize:'1.1rem'}},'Nano.IA — avatar RoboNano'),
 h('div',{style:{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:18}},E.map(e=>h('figure',{key:e,style:{margin:0,display:'grid',justifyItems:'center',gap:10,padding:'18px 6px',border:'1px solid var(--borda)',borderRadius:12}},
  h('div',{style:{display:'flex',gap:18,alignItems:'center',minHeight:96}},h(RoboNano,{estado:e,tamanho:40}),h(RoboNano,{estado:e,tamanho:56}),h(RoboNano,{estado:e,tamanho:96})),
  h('figcaption',{style:{fontSize:'.85rem'}},e==='falando'?'Falando':ROTULO_ESTADO[e]))))));</script></html>`);
const servidor=spawn(process.execPath,[painel+'node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(porta)],{cwd:painel,stdio:'ignore'});
let browser;
try{
 for(let i=0;i<100;i++){try{if((await fetch(`http://127.0.0.1:${porta}/.avatar-demo.html`)).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
 browser=await chromium.launch({headless:true});
 for(const tema of ['claro','escuro'])for(const largura of [360,768,1440]){
  const ctx=await browser.newContext({viewport:{width:largura,height:largura===1440?900:1100},colorScheme:tema==='escuro'?'dark':'light'});
  const page=await ctx.newPage(),erros=[];page.on('pageerror',e=>erros.push(e.message));
  await page.goto(`http://127.0.0.1:${porta}/.avatar-demo.html`);await page.waitForSelector('.nano-robo');
  await page.evaluate(t=>{document.documentElement.dataset.tema=t},tema);
  assert.equal(await page.locator('.nano-robo').count(),ESTADOS.length*3,'um RoboNano por tamanho e estado');
  assert.equal(await page.locator('.orbe').count(),0,'nenhuma esfera orbital');
  for(const e of ESTADOS)assert.equal(await page.locator(`.nano-robo[data-estado="${e}"]`).count(),3,`estado ${e} preservado`);
  const ov=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth);assert.equal(ov,false,'sem rolagem horizontal em '+largura);
  await page.screenshot({path:`${saida}estados-${tema}-${largura}.png`,fullPage:true});
  assert.deepEqual(erros,[]);await ctx.close();
 }
 // Acessibilidade: o avatar permanece presente também com movimento reduzido.
 const rmCtx=await browser.newContext({viewport:{width:768,height:900},reducedMotion:'reduce'}),p2=await rmCtx.newPage();
 await p2.goto(`http://127.0.0.1:${porta}/.avatar-demo.html`);await p2.waitForSelector('.nano-robo');
 assert.equal(await p2.locator('.nano-robo').count(),ESTADOS.length*3);
 assert.equal(await p2.locator('.orbe').count(),0);
 await p2.screenshot({path:`${saida}reduced-motion-768.png`,fullPage:true});
 await rmCtx.close();
 console.log('OK: RoboNano em 12 estados + falando, claro/escuro, 360/768/1440, sem esfera orbital');
}finally{await browser?.close();servidor.kill();await rm(fixture,{force:true})}
