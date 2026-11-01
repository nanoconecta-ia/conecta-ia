// Conversa do começo ao fim (ir ao começo / ir ao fim) e 'Apagar as conversas desta sessão', no componente REAL. Rede 100% SINTÉTICA; nada sai para produção.
import { createRequire } from 'node:module';
import { writeFile, rm, mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
const root=new URL('../../',import.meta.url).pathname,painel=root+'painel/';
const require=createRequire(painel+'package.json'),{chromium}=require('playwright');
const saida=process.env.SAIDA||root+'docs/evidencias/chat-tela-cheia/',fixture=painel+'.conversa-demo.html',porta=4194;
const L='aaaaaaaa-0000-0000-0000-000000000001',C='cccccccc-0000-0000-0000-000000000002';
await writeFile(fixture,`<html lang="pt-BR"><meta name="viewport" content="width=device-width, initial-scale=1.0"><div id="root"></div><script type="module">import React from 'react';import {createRoot} from 'react-dom/client';import {Assistente} from '/src/paginas/Assistente.tsx';import {LogoConecta} from '/src/componentes/LogoConecta.tsx';import {useEstadoNano} from '/src/lib/nanoEstado.ts';function Cab(){const e=useEstadoNano('${L}');return React.createElement('div',{id:'cab-nano','data-estado':e},React.createElement(LogoConecta,{estado:e}))}import '/src/styles.css';import '/src/shell.css';createRoot(document.getElementById('root')).render(React.createElement(React.Fragment,null,React.createElement(Cab),React.createElement(Assistente,{loja:{id:'${L}',nome:'Loja DEMO SIMULADA'}})));</script></html>`);
await mkdir(saida,{recursive:true});
const servidor=spawn(process.execPath,[painel+'node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(porta)],{cwd:painel,stdio:'ignore'});
const LONGA='Achei três registros do kit 833333. '.repeat(30);
let browser;
try{
 for(let i=0;i<100;i++){try{if((await fetch(`http://127.0.0.1:${porta}/.conversa-demo.html`)).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
 browser=await chromium.launch({headless:true});
 for(const [largura,altura] of [[390,844],[1280,800]]){
  const page=await browser.newPage({viewport:{width:largura,height:altura}});const erros=[];page.on('pageerror',e=>erros.push(e.message));
  const apagadas=[];let criadas=0;const lista=[{id:'antiga-1',titulo:'Conversa antiga (de antes desta sessão)',atualizada_em:'2026-10-01T00:00:00Z'}];
  const LONGO=Array.from({length:14},(_,k)=>`Linha ${k+1} da resposta, com texto para ocupar espaço na conversa.`).join('\n\n');
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
   else if(c.acao==='chat_listar')body={conversas:lista};
   else if(c.acao==='chat_perguntar'){await new Promise(r=>setTimeout(r,80));let id=c.conversa_id;if(!id){id=`nova-${++criadas}`;lista.unshift({id,titulo:`Conversa ${id}`,atualizada_em:'2026-11-01T12:00:00Z'})}
    body={resposta:LONGO,conversa_id:id,simulado:true,evidencias:[]};}
   else if(c.acao==='chat_excluir'){apagadas.push(c.conversa_id);const k=lista.findIndex(x=>x.id===c.conversa_id);if(k>=0)lista.splice(k,1);body={excluida:true}}
   else return route.abort();
   return route.fulfill({status:200,contentType:'application/json',headers:{...h,'access-control-allow-origin':'*'},body:JSON.stringify(body)});
  });
  page.on('dialog',d=>void d.accept());
  await page.goto(`http://127.0.0.1:${porta}/.conversa-demo.html`);
  await page.getByRole('button',{name:/Nova conversa|Enviar/}).first().waitFor();
  await page.getByRole('button',{name:'Autorizar e continuar'}).click();
  const campo=page.getByLabel('Pergunte',{exact:true}),enviar=page.getByRole('button',{name:'Enviar',exact:true});
  assert.equal(await page.getByRole('button',{name:'Ir ao começo da conversa'}).count(),0,'sem ferramentas de rolagem com a conversa curta');
  for(let k=1;k<=4;k++){await campo.fill(`Pergunta número ${k}`);await enviar.click();await page.getByText('Linha 14 da resposta').nth(k-1).waitFor()}
  // a conversa inteira rola; começo e fim estão a um toque
  const chat=page.locator('.abas-centro > .chat');
  const info=()=>chat.evaluate(e=>({t:e.scrollTop,c:e.clientHeight,h:e.scrollHeight}));
  const antes=await info();assert.ok(antes.h>antes.c,`a conversa é maior que a janela (${antes.h} > ${antes.c})`);
  await page.getByRole('button',{name:'Ir ao começo da conversa'}).click();await page.waitForFunction(()=>document.querySelector('.abas-centro > .chat').scrollTop<=1);
  assert.match(await chat.innerText(),/Pergunta número 1/,'a primeira pergunta está na conversa');
  await page.getByRole('button',{name:'Ir ao fim da conversa'}).click();await page.waitForFunction(()=>{const e=document.querySelector('.abas-centro > .chat');return e.scrollTop+e.clientHeight>=e.scrollHeight-2});
  const fim=await info();assert.ok(fim.t+fim.c>=fim.h-2,'chegou ao fim');
  for(const nome of ['Ir ao começo da conversa','Ir ao fim da conversa']){const b=await page.getByRole('button',{name:nome}).boundingBox();assert.ok(b.width>=34&&b.height>=34,`botão '${nome}' com alvo de toque (${Math.round(b.width)}x${Math.round(b.height)})`)}
  await page.screenshot({path:`${saida}conversa-completa-${largura}.png`});
  // apagar as conversas desta sessão: só a criada agora, nunca a antiga
  await page.getByRole('button',{name:'Abrir menu do Nano.IA'}).click();
  const apagar=page.getByRole('button',{name:'Apagar as conversas desta sessão'});await apagar.waitFor();
  assert.ok((await page.getByText('Conversa antiga (de antes desta sessão)').count())>0,'a conversa antiga aparece na lista');
  await apagar.click();
  await page.waitForFunction(()=>!document.body.innerText.includes('Conversa nova-1'));
  assert.deepEqual(apagadas,['nova-1'],'só a conversa criada nesta sessão foi apagada');
  assert.ok((await page.getByText('Conversa antiga (de antes desta sessão)').count())>0,'a conversa antiga continua na lista');
  assert.equal(await page.getByRole('button',{name:'Apagar as conversas desta sessão'}).count(),0,'sem conversas da sessão, o botão some');
  assert.doesNotMatch(await chat.innerText(),/Pergunta número 1/,'a conversa aberta foi limpa');
  await page.screenshot({path:`${saida}sessao-apagada-${largura}.png`});
  assert.deepEqual(erros,[]);await page.close();
 }
 console.log('chat-conversa-completa-visual ok (começo e fim da conversa, e apagar só as conversas desta sessão; 390 e 1280px)');
}finally{await browser?.close();servidor.kill();await rm(fixture,{force:true})}
