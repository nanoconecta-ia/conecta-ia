// Mapa mental com a taxonomia REAL (snapshot de 79 categorias, só metadado): ícone por categoria, nós legíveis em claro/escuro, PC e celular. Componentes reais, sem rede.
import { createRequire } from 'node:module';
import { writeFile, rm, mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
const root=new URL('../../',import.meta.url).pathname,painel=root+'painel/';
const require=createRequire(painel+'package.json'),{chromium}=require('playwright');
const fixture=painel+'.mapa-icones.html',porta=4195,saida=process.env.SAIDA||root+'docs/evidencias/mapa-taxonomia-icones/';
const {TAXONOMIA_AUTOPECAS}=await import(painel+'src/lib/taxonomiaAutopecas.fixture.ts');const linhas=TAXONOMIA_AUTOPECAS.map(r=>[...r]);
await mkdir(saida,{recursive:true});
await writeFile(fixture,`<html lang="pt-BR"><meta name="viewport" content="width=device-width, initial-scale=1.0"><div id="root"></div><script type="module">import React from 'react';import {createRoot} from 'react-dom/client';import './src/styles.css';import './src/shell.css';
import {SpriteIcones} from './src/componentes/SpriteIcones.tsx';import {MapaMental} from './src/componentes/MapaMental.tsx';import {PontosPensando} from './src/componentes/PontosPensando.tsx';import {mapaDoCatalogo} from './src/lib/mapaPagina.ts';import {publicar} from './src/lib/contextoPagina.ts';
const L=${JSON.stringify(linhas)};const id=s=>'id-'+s;
const porNo=L.map(([s,n,p])=>({id:id(s),pai_id:p?id(p):null,nome:n,slug:s,produtos:3}));
const mapa=mapaDoCatalogo({total:240,publicados:120,inativos:4,semCategoria:2,semLugarNaTaxonomia:3,incompletos:5,faltando:{},porNo});
const h=React.createElement;
function Dots({rota}){publicar(rota,'t',{id:'catalogo',rotulo:'Catálogo'});return h('div',{style:{display:'flex',gap:8,alignItems:'center',padding:8}},h('span',null,rota+': '),h(PontosPensando))}
createRoot(document.getElementById('root')).render(h('main',{style:{padding:12,background:'var(--fundo)',color:'var(--texto)'}},h(SpriteIcones),
 h('div',{id:'pontos'},h(Dots,{rota:'/catalogo'})),h('div',{id:'mapa',style:{overflow:'auto',maxHeight:'85vh',border:'1px solid var(--borda)'}},h(MapaMental,{raiz:mapa,titulo:'Catálogo'}))));</script></html>`);
const servidor=spawn(process.execPath,[painel+'node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(porta)],{cwd:painel,stdio:'ignore'});
let browser;
try{
 for(let i=0;i<100;i++){try{if((await fetch(`http://127.0.0.1:${porta}/.mapa-icones.html`)).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
 browser=await chromium.launch({headless:true});
 for(const tema of ['claro','escuro'])for(const [w,hh] of [[1440,900],[390,844]]){
  const ctx=await browser.newContext({viewport:{width:w,height:hh}});const page=await ctx.newPage();const erros=[];page.on('pageerror',e=>erros.push(e.message));
  await page.addInitScript(t=>localStorage.setItem('conecta:tema',t),tema);
  await page.goto(`http://127.0.0.1:${porta}/.mapa-icones.html`);await page.waitForSelector('.mapa-no');
  await page.getByRole('button',{name:'Expandir tudo'}).click();await page.waitForTimeout(400);
  const r=await page.evaluate(()=>{const nos=[...document.querySelectorAll('.mapa-no')];const sem=nos.filter(n=>n.querySelector('.mapa-peca')).length;
   const vazios=[...document.querySelectorAll('.mapa-peca use')].filter(u=>!document.querySelector(u.getAttribute('href'))).map(u=>u.getAttribute('href'));
   const cort=nos.filter(n=>{const t=n.querySelector('.mapa-rotulo');return t&&t.textContent.endsWith('…')}).map(n=>n.querySelector('.mapa-rotulo').textContent);
   const sobre=nos.filter(n=>{const t=n.querySelector('.mapa-rotulo'),v=n.querySelector('.mapa-valor');if(!t||!v)return false;return t.getBBox().x+t.getBBox().width>v.getBBox().x-v.getBBox().width});
   return {nos:nos.length,comIcone:sem,vazios,cortados:cort.length,amostraCortados:cort.slice(0,6),sobrepostos:sobre.length}});
  console.log(tema,w,JSON.stringify(r));
  assert.deepEqual(r.vazios,[],'todo ícone referenciado existe no sprite');
  assert.equal(r.comIcone,80,'as 78 categorias com slug + taxonomia + agrupadores recebem ícone');assert.equal(r.sobrepostos,0,'rótulo não invade o valor');
  assert.ok(r.cortados<=20,`poucos rótulos cortados (${r.cortados}); o nome inteiro fica no tooltip`);
  const preenchido=await page.evaluate(()=>{const c=getComputedStyle(document.querySelector('.mapa-no rect')).fill;return c});assert.notEqual(preenchido,'rgb(0, 0, 0)','nó do mapa não pode ficar preto');
  assert.deepEqual(erros,[]);
  await page.locator('#mapa').screenshot({path:`${saida}mapa-${tema}-${w}.png`});await page.locator('#pontos').screenshot({path:`${saida}pontos-${tema}-${w}.png`});
  await ctx.close();
 }
}finally{await browser?.close();servidor.kill();await rm(fixture,{force:true})}
