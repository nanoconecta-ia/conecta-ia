// Vitrine: respostas 429/413/500 do servidor mostram mensagem amigável e "Tentar de novo" (nunca tela em branco). Rede 100% interceptada e SINTÉTICA.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
const root=new URL('../../',import.meta.url).pathname,painel=root+'painel/';
const require=createRequire(painel+'package.json'),{chromium}=require('playwright');
const porta=4186,base=`http://127.0.0.1:${porta}`;
const servidor=spawn(process.execPath,[painel+'node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(porta)],{cwd:painel,stdio:'ignore'});
const prod=n=>({nome:`Peça DEMO ${n}`,sku:`DEMO-00${n}`,preco:100+n,em_estoque:true,marca:null,descricao:null,imagem:null,whatsapp:null,atualizado_em:'2026-10-24T12:00:00Z'});
const hd={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*','content-type':'application/json'};
let browser;
try{
 for(let i=0;i<100;i++){try{if((await fetch(base+'/')).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
 browser=await chromium.launch({headless:true});
 for(const [w,h] of [[390,844],[1280,800]])for(const [status,texto] of [[429,/Muitas consultas seguidas/],[413,/Muitas consultas seguidas/],[500,/Não foi possível carregar o catálogo/]]){
  const page=await browser.newPage({viewport:{width:w,height:h}}),erros=[];let falhar=true;
  page.on('pageerror',e=>erros.push(e.message));
  await page.route('**/*',async r=>{
   const u=new URL(r.request().url());
   if(u.hostname==='127.0.0.1')return r.continue();
   if(!u.pathname.endsWith('/functions/v1/loja-publica')&&r.request().method()!=='OPTIONS')throw Error('Rede não permitida no teste: '+u.href);
   if(r.request().method()==='OPTIONS')return r.fulfill({status:204,headers:hd});
   if(falhar)return r.fulfill({status,headers:{...hd,'retry-after':'30'},body:JSON.stringify({erro:'x'})});
   const ps=[1,2].map(prod);
   return r.fulfill({status:200,headers:hd,body:JSON.stringify({loja:{nome:'Loja DEMO',slug:'loja-demo',modo_venda:'whatsapp'},tema:{variaveis:{},logo_url:null,icone_url:null},produtos:ps,total:2,pagina:1,por_pagina:24,veiculos:[],tipos:[],categorias:[]})});
  });
  await page.goto(`${base}/#/loja/loja-demo`);
  await page.getByRole('alert').getByText(texto).waitFor();
  assert.ok(await page.getByRole('button',{name:'Tentar de novo'}).isVisible(),`botão com ${status}`);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true,`sem rolagem horizontal a ${w}px (${status})`);
  falhar=false;await page.getByRole('button',{name:'Tentar de novo'}).click();
  await page.getByText('Peça DEMO 1').first().waitFor();
  assert.deepEqual(erros,[],`sem erro de página com ${status}`);await page.close();
 }
 console.log('loja-limite-visual ok (429, 413 e 500 em 390px e 1280px: mensagem, nova tentativa e recuperação)');
}finally{await browser?.close();servidor.kill()}
