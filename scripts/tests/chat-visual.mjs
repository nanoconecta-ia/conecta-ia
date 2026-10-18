// Exercita o componente real em 390px. Todas as respostas externas são SINTÉTICAS.
import { createRequire } from 'node:module';
import { writeFile, rm, mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
const root=new URL('../../',import.meta.url).pathname,painel=root+'painel/';
const require=createRequire(painel+'package.json'),{chromium}=require('playwright');
const fixture=painel+'.chat-demo.html';
const L='aaaaaaaa-0000-0000-0000-000000000001',C='cccccccc-0000-0000-0000-000000000001';
await writeFile(fixture,`<html lang="pt-BR"><meta name="viewport" content="width=device-width, initial-scale=1.0"><div id="root"></div><script type="module">import React from 'react';import {createRoot} from 'react-dom/client';import {Assistente} from '/src/paginas/Assistente.tsx';import '/src/styles.css';createRoot(document.getElementById('root')).render(React.createElement(Assistente,{loja:{id:'${L}',nome:'Loja DEMO SIMULADA'}}));</script></html>`);
const servidor=spawn(process.execPath,[painel+'node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4179'],{cwd:painel,env:{...process.env,VITE_SUPABASE_URL:'https://chat.local.invalid',VITE_SUPABASE_CHAVE_PUBLICAVEL:'chave-publica-apenas-sintetica'},stdio:'ignore'});
let browser;
try{
 for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:4179/.chat-demo.html')).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
 browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:390,height:844}});const erros=[];page.on('pageerror',e=>erros.push(e.message));let chamadas=0;
 await page.route('**/*',async route=>{const u=new URL(route.request().url());if(u.hostname==='127.0.0.1'&&u.pathname==='/src/config.ts')return route.fulfill({contentType:'application/javascript',body:"export const SUPABASE_URL='https://chat.local.invalid';export const SUPABASE_CHAVE_PUBLICAVEL='chave-publica-apenas-sintetica';"});if(u.hostname==='127.0.0.1')return route.continue();if(u.hostname!=='chat.local.invalid')return route.abort();
  if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-methods':'POST,GET,OPTIONS','access-control-allow-headers':'authorization,apikey,content-type,x-client-info'}});
  const c=route.request().postDataJSON()??{};let body={};
  if(u.pathname.includes('/rpc/pode_administrar_loja'))body=false;
  else if(c.acao==='provedores')body={verificado:true,provedores:[{id:'compativel_openai',nome:'GPT',modelo:'gpt-sintetico',estado:'disponivel',principal:true},{id:'gemini',nome:'Gemini',estado:'nao_configurado'},{id:'claude',nome:'Claude',estado:'indisponivel'}]};
  else if(c.acao==='chat_config')body={persistente:true,bling:true,leitura_administrativa:false,retencao_dias:180};
  else if(c.acao==='chat_listar')body={conversas:[]};
  else if(c.acao==='chat_perguntar'){chamadas++;assert.ok(c.consentimento_ia);assert.ok(c.idempotency_key);body={resposta:'Produto de demonstração. Dados SIMULADOS.',conversa_id:C,simulado:true,evidencias:[{origem:'api_bling',simulado:true,consultado_em:'2026-10-18T00:00:00Z',dados:{nome:'Produto SIMULADO',sku:'SKU-DEMO',preco:34.5,estoque:7}}]};}
  else return route.abort();
  return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(body)});
 });
 await page.goto('http://127.0.0.1:4179/.chat-demo.html');
 try { await page.getByRole('button',{name:'Nova conversa',exact:true}).waitFor(); } catch (e) { console.error('Diagnóstico de fixture SIMULADA:',JSON.stringify({erros,html:(await page.locator('body').innerText()).slice(0,3000)})); throw e; }
 const enviar=page.getByRole('button',{name:'Enviar',exact:true});assert.equal(await enviar.isDisabled(),true);
 await page.getByLabel(/Enviar esta pergunta/).check();await page.getByLabel('Pergunte',{exact:true}).fill('Consulte SKU-DEMO');await enviar.click();
 await page.getByText('API Bling consultada',{exact:false}).waitFor();assert.equal(chamadas,1);assert.ok(await page.getByText('SIMULADO · API Bling consultada').isVisible());
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false,'Sem transbordamento horizontal em 390px');assert.deepEqual(erros,[]);
 await mkdir(root+'evidencias-chat',{recursive:true});await page.screenshot({path:root+'evidencias-chat/chat-390-simulado.png',fullPage:true});
 console.log('ok: componente real, viewport 390px, consentimento, histórico privado e cartão de origem SIMULADA, sem rede real');
}finally{await browser?.close();servidor.kill('SIGTERM');await rm(fixture,{force:true})}
