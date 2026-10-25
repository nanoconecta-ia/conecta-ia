// Chat retrátil, blocos retráteis e esfera em ação, no componente REAL. Rede 100% SINTÉTICA; nada sai para produção.
import { createRequire } from 'node:module';
import { writeFile, rm, mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
const root=new URL('../../',import.meta.url).pathname,painel=root+'painel/';
const require=createRequire(painel+'package.json'),{chromium}=require('playwright');
const fixture=painel+'.retratil-demo.html',porta=4186;
const L='aaaaaaaa-0000-0000-0000-000000000001',C='cccccccc-0000-0000-0000-000000000002';
await writeFile(fixture,`<html lang="pt-BR"><meta name="viewport" content="width=device-width, initial-scale=1.0"><div id="root"></div><script type="module">import React from 'react';import {createRoot} from 'react-dom/client';import {Assistente} from '/src/paginas/Assistente.tsx';import '/src/styles.css';import '/src/shell.css';createRoot(document.getElementById('root')).render(React.createElement(Assistente,{loja:{id:'${L}',nome:'Loja DEMO SIMULADA'}}));</script></html>`);
const servidor=spawn(process.execPath,[painel+'node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(porta)],{cwd:painel,stdio:'ignore'});
const LONGA='Achei três registros do kit 833333. '.repeat(30);
let browser;
try{
 for(let i=0;i<100;i++){try{if((await fetch(`http://127.0.0.1:${porta}/.retratil-demo.html`)).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
 browser=await chromium.launch({headless:true});
 for(const [largura,altura] of [[390,844],[1280,800]]){
  const page=await browser.newPage({viewport:{width:largura,height:altura}});const erros=[];page.on('pageerror',e=>erros.push(e.message));let n=0;
  await page.route('**/*',async route=>{const u=new URL(route.request().url());
   if(u.hostname==='127.0.0.1'&&u.pathname==='/src/config.ts')return route.fulfill({contentType:'application/javascript',body:"export const SUPABASE_URL='https://chat.local.invalid';export const SUPABASE_CHAVE_PUBLICAVEL='chave-publica-apenas-sintetica';"});
   if(u.hostname==='127.0.0.1')return route.continue();
   if(u.hostname!=='chat.local.invalid')throw Error('Rede não permitida no teste: '+u.hostname);
   const h={'access-control-allow-origin':'*','access-control-allow-methods':'POST,GET,OPTIONS','access-control-allow-headers':'authorization,apikey,content-type,x-client-info'};
   if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers:h});
   const c=route.request().postDataJSON()??{};let body={};
   if(u.pathname.includes('/rpc/pode_administrar_loja'))body=false;
   else if(c.acao==='provedores')body={verificado:true,provedores:[{id:'gemini',nome:'Gemini',modelo:'gemini-sintetico',estado:'disponivel',principal:true},{id:'claude',nome:'Claude',estado:'nao_configurado'},{id:'compativel_openai',nome:'GPT',estado:'nao_configurado'}]};
   else if(c.acao==='chat_config')body={persistente:true,bling:true,leitura_administrativa:false,retencao_dias:180};
   else if(c.acao==='chat_listar')body={conversas:[]};
   else if(c.acao==='chat_perguntar'){n++;await new Promise(r=>setTimeout(r,n===1?1200:150));
    body={resposta:n===2?LONGA:`Resposta ${n} da Nano.ia.`,conversa_id:C,simulado:true,evidencias:n===2?[{origem:'api_bling',simulado:true,consultado_em:'2026-10-25T00:00:00Z',dados:{nome:'Produto SIMULADO',sku:'SKU-DEMO',preco:10,estoque:1},total_candidatos:3,candidatos:[],fontes:[],conclusao:{ausencia_nos_filtros_pesquisados:false,api_completa:true,apenas_espelho:false,autoriza_criacao:false,aviso:'x'}}]:[]};}
   else return route.abort();
   return route.fulfill({status:200,contentType:'application/json',headers:{...h,'access-control-allow-origin':'*'},body:JSON.stringify(body)});
  });
  await page.goto(`http://127.0.0.1:${porta}/.retratil-demo.html`);
  await page.getByRole('button',{name:/Nova conversa|Enviar/}).first().waitFor();
  await page.getByLabel(/Enviar esta pergunta/).check();
  const campo=page.getByLabel('Pergunte',{exact:true}),enviar=page.getByRole('button',{name:'Enviar',exact:true});
  // 1) esfera em ação: durante a requisição a faixa e a esfera mostram o que está acontecendo; depois voltam ao repouso
  await campo.fill('Consulte o kit 833333');await enviar.click();
  const faixa=page.locator('.faixa-acao');await faixa.waitFor();
  assert.match(await faixa.innerText(),/Consultando/);assert.equal(await page.locator('.esfera').first().getAttribute('data-estado'),'interpretando');
  const aumentou=await page.locator('.esfera').first().evaluate(e=>e.offsetWidth);assert.ok(aumentou>=54,'esfera cresce quando está em ação');
  await page.getByText('Resposta 1 da Nano.ia.').waitFor();await faixa.waitFor({state:'detached'});
  assert.equal(await page.locator('.esfera').first().getAttribute('data-estado'),'ocioso');
  // 2) mais três perguntas: as mensagens antigas viram uma linha, só as 2 últimas ficam abertas
  let esperado=3; // saudação + 1ª pergunta + 1ª resposta
  for(const t of ['segunda','terceira','quarta']){await campo.fill(t);await enviar.click();esperado+=2;await page.waitForFunction(n=>document.querySelectorAll('.bolha, .bolha-linha').length===n,esperado);await page.locator('.faixa-acao').waitFor({state:'detached'});}
  const total=await page.locator('.bolha, .bolha-linha').count();
  assert.equal(await page.locator('.bolha').count(),2,'só as 2 últimas abertas');assert.equal(await page.locator('.bolha-linha').count(),total-2);
  await mkdir(root+'evidencias-chat',{recursive:true});await page.screenshot({path:root+`evidencias-chat/assistente-retratil-recolhido-${largura}.png`});
  // abrir uma antiga à mão, recolher tudo, expandir tudo
  await page.locator('.bolha-linha').first().click();assert.equal(await page.locator('.bolha').count(),3);
  await page.getByRole('button',{name:'Recolher tudo'}).click();assert.equal(await page.locator('.bolha').count(),0);
  await page.getByRole('button',{name:'Expandir tudo'}).click();assert.equal(await page.locator('.bolha-linha').count(),0);
  // 3) resposta longa mostra o começo; evidência recolhida até abrir
  const longa=page.locator('.bolha',{hasText:'Achei três registros'}).first();
  assert.ok((await longa.innerText()).length<LONGA.length,'resposta longa cortada');
  await longa.getByRole('button',{name:'Mostrar mais'}).click();await longa.getByRole('button',{name:'Mostrar menos'}).waitFor();
  const det=longa.locator('details.evid-retratil');assert.equal(await det.evaluate(d=>d.open),false);assert.match(await det.locator('summary').innerText(),/Consulta ao Bling \(API\) · 3 candidatos/);
  await det.locator('summary').click();assert.equal(await det.evaluate(d=>d.open),true);
  // 4) bloco retrátil (atalhos): recolhe e reabre, com o estado lembrado
  const atalhos=page.getByRole('button',{name:/Atalhos/});const exp=await atalhos.getAttribute('aria-expanded');await atalhos.click();assert.notEqual(await atalhos.getAttribute('aria-expanded'),exp);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false,`sem transbordamento horizontal a ${largura}px`);
  assert.deepEqual(erros,[]);
  await mkdir(root+'evidencias-chat',{recursive:true});await page.screenshot({path:root+`evidencias-chat/assistente-retratil-${largura}.png`});
  await page.close();
 }
 console.log('assistente-retratil-visual ok (390px e 1280px: esfera em ação, mensagens recolhidas, mostrar mais, evidência retrátil, atalhos)');
}finally{await browser?.close();servidor.kill('SIGTERM');await rm(fixture,{force:true})}
