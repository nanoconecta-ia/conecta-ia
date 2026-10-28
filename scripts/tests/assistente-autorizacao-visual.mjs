// Nano.ia: quando o envio está bloqueado só por falta de autorização, a tela diz o motivo e oferece o botão que resolve. Componente REAL, rede 100% SINTÉTICA.
import { createRequire } from 'node:module';
import { writeFile, rm, mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
const root=new URL('../../',import.meta.url).pathname,painel=root+'painel/';
const require=createRequire(painel+'package.json'),{chromium}=require('playwright');
const fixture=painel+'.autorizacao-demo.html',porta=4199;
const L='aaaaaaaa-0000-0000-0000-000000000001',C='cccccccc-0000-0000-0000-000000000002';
await writeFile(fixture,`<html lang="pt-BR"><meta name="viewport" content="width=device-width, initial-scale=1.0"><div id="root"></div><script type="module">import React from 'react';import {createRoot} from 'react-dom/client';import {Assistente} from '/src/paginas/Assistente.tsx';import '/src/styles.css';import '/src/shell.css';createRoot(document.getElementById('root')).render(React.createElement(Assistente,{loja:{id:'${L}',nome:'Loja DEMO SIMULADA'}}));</script></html>`);
const servidor=spawn(process.execPath,[painel+'node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(porta)],{cwd:painel,stdio:'ignore'});
let browser;
try{
 for(let i=0;i<100;i++){try{if((await fetch(`http://127.0.0.1:${porta}/.autorizacao-demo.html`)).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
 browser=await chromium.launch({headless:true});
 for(const [largura,altura] of [[300,640],[390,844],[360,700],[1280,800]]){
  const page=await browser.newPage({viewport:{width:largura,height:altura}});const erros=[];page.on('pageerror',e=>erros.push(e.message));let perguntas=0;
  await page.addInitScript(()=>{try{localStorage.setItem('conecta:retratil:consentimento','0')}catch{}}); // como no aparelho do proprietário: Privacidade recolhida
  await page.route('**/*',async route=>{const u=new URL(route.request().url());
   if(u.hostname==='127.0.0.1'&&u.pathname==='/src/config.ts')return route.fulfill({contentType:'application/javascript',body:"export const SUPABASE_URL='https://chat.local.invalid';export const SUPABASE_CHAVE_PUBLICAVEL='chave-publica-apenas-sintetica';"});
   if(u.hostname==='127.0.0.1')return route.continue();
   if(u.hostname!=='chat.local.invalid')throw Error('Rede não permitida no teste: '+u.hostname);
   const h={'access-control-allow-origin':'*','access-control-allow-methods':'POST,GET,OPTIONS','access-control-allow-headers':'authorization,apikey,content-type,x-client-info'};
   if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers:h});
   const c=route.request().postDataJSON()??{};let body={};
   if(u.pathname.includes('/rpc/pode_administrar_loja'))body=false;
   else if(c.acao==='provedores')body={verificado:true,provedores:[{id:'gemini',nome:'Gemini',modelo:'gemini-sintetico',estado:'disponivel',principal:true}]};
   else if(c.acao==='chat_config')body={persistente:true,bling:true,leitura_administrativa:false,retencao_dias:180};
   else if(c.acao==='chat_listar')body={conversas:[]};
   else if(c.acao==='chat_perguntar'){perguntas++;assert.equal(c.consentimento_ia,true,'a pergunta só sai com consentimento');body={resposta:'Resposta da Nano.ia.',conversa_id:C,simulado:true,evidencias:[]};}
   else return route.abort();
   return route.fulfill({status:200,contentType:'application/json',headers:{...h},body:JSON.stringify(body)});
  });
  await page.goto(`http://127.0.0.1:${porta}/.autorizacao-demo.html`);
  const aviso=page.locator('.aviso-envio');await aviso.waitFor();
  const r=`${largura}x${altura}`;
  assert.match(await aviso.innerText(),/ainda não pode responder[\s\S]*autorização[\s\S]*Gemini/,`${r}: aviso diz o motivo e para quem vai`);
  const enviar=page.getByRole('button',{name:'Enviar',exact:true});
  assert.equal(await enviar.isDisabled(),true,`${r}: sem autorização, Enviar fica desabilitado`);
  await page.getByLabel('Pergunte',{exact:true}).fill('Oi');
  await mkdir(root+'evidencias-chat',{recursive:true});await page.screenshot({path:root+`evidencias-chat/assistente-autorizacao-${largura}.png`});
  assert.equal(perguntas,0,`${r}: nada enviado antes da autorização`);
  const btn=aviso.getByRole('button',{name:'Autorizar e continuar'});const b=await btn.boundingBox();assert.ok(b.height>=44,`${r}: botão com alvo >= 44px`);
  await btn.click();
  await aviso.waitFor({state:'detached'});
  assert.equal(await enviar.isEnabled(),true,`${r}: autorizado, Enviar habilita`);
  await enviar.click();await page.getByText('Resposta da Nano.ia.').waitFor();
  assert.equal(perguntas,1,`${r}: a pergunta saiu uma vez, depois da autorização`);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),`${r}: sem rolagem horizontal`);
  assert.deepEqual(erros,[]);
  await page.close();
 }
 console.log('assistente-autorizacao-visual ok (390, 360 e 1280px: aviso com o motivo, nada enviado antes de autorizar, botão resolve, pergunta sai com consentimento)');
}finally{await browser?.close();servidor.kill('SIGTERM');await rm(fixture,{force:true})}
