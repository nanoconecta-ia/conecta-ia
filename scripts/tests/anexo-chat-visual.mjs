// Chat retrátil, blocos retráteis e esfera em ação, no componente REAL. Rede 100% SINTÉTICA; nada sai para produção.
import { createRequire } from 'node:module';
import { writeFile, rm, mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
const root=new URL('../../',import.meta.url).pathname,painel=root+'painel/';
const require=createRequire(painel+'package.json'),{chromium}=require('playwright');
const fixture=painel+'.anexo-demo.html',porta=4187;
const L='aaaaaaaa-0000-0000-0000-000000000001',C='cccccccc-0000-0000-0000-000000000002';
await writeFile(fixture,`<html lang="pt-BR"><meta name="viewport" content="width=device-width, initial-scale=1.0"><div id="root"></div><script type="module">import React from 'react';import {createRoot} from 'react-dom/client';import {Assistente} from '/src/paginas/Assistente.tsx';import '/src/styles.css';import '/src/shell.css';createRoot(document.getElementById('root')).render(React.createElement(Assistente,{loja:{id:'${L}',nome:'Loja DEMO SIMULADA'}}));</script></html>`);
const servidor=spawn(process.execPath,[painel+'node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(porta)],{cwd:painel,stdio:'ignore'});
const corpos=[];const LONGA='Achei três registros do kit 833333. '.repeat(30);
let browser;
try{
 for(let i=0;i<100;i++){try{if((await fetch(`http://127.0.0.1:${porta}/.anexo-demo.html`)).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
 browser=await chromium.launch({headless:true});
 for(const [largura,altura] of [[300,640],[360,740],[390,844],[1280,800]]){
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
   else if(c.acao==='chat_perguntar'){n++;corpos.push(c);await new Promise(r=>setTimeout(r,n===1?1200:150));
    body={resposta:n===2?LONGA:n===4?'**Achei** o kit *833333*:\n\n* **SKU 5112** excluído\n* **SKU 833333** excluído\n\nResposta 4 da Nano.ia.':`Resposta ${n} da Nano.ia.`,conversa_id:C,simulado:true,evidencias:n===2?[{origem:'api_bling',simulado:true,consultado_em:'2026-10-25T00:00:00Z',dados:{nome:'Produto SIMULADO',sku:'SKU-DEMO',preco:10,estoque:1},total_candidatos:3,candidatos:[],fontes:[],conclusao:{ausencia_nos_filtros_pesquisados:false,api_completa:true,apenas_espelho:false,autoriza_criacao:false,aviso:'x'}}]:[]};}
   else return route.abort();
   return route.fulfill({status:200,contentType:'application/json',headers:{...h,'access-control-allow-origin':'*'},body:JSON.stringify(body)});
  });

  corpos.length=0;await page.goto(`http://127.0.0.1:${porta}/.anexo-demo.html`);
  await page.getByRole('button',{name:/Nova conversa|Enviar/}).first().waitFor();
  const clipe=page.getByRole('button',{name:'Anexar imagem ou arquivo'});await clipe.waitFor();
  assert.equal(await clipe.isDisabled(),false,'com provedor escolhido o 📎 fica ativo');
  // consentimento recolhe sozinho depois de autorizado, liberando espaço no compositor
  await page.getByLabel(/Enviar esta pergunta/).check();
  await page.locator('.consentimento').waitFor({state:'hidden'});
  // Atalhos e Privacidade viram duas pílulas na mesma linha; a conversa mantém espaço
  await page.getByRole('button',{name:/Atalhos/}).evaluate(b=>{if(b.getAttribute('aria-expanded')==='true')b.click()});
  {const g=await page.evaluate(()=>{const b=document.querySelector('.barra-extras').getBoundingClientRect(),c=document.querySelector('.abas-centro > .chat').getBoundingClientRect(),p=[...document.querySelectorAll('.barra-extras .retratil-cabecote')].map(e=>Math.round(e.getBoundingClientRect().top));return {bh:b.height,ch:c.height,tops:p}});
   assert.ok(g.bh<=52,'pílulas em uma linha '+JSON.stringify(g));assert.ok(g.ch>=150,'conversa com espaço '+JSON.stringify(g));assert.equal(new Set(g.tops).size,1,'pílulas lado a lado '+JSON.stringify(g));}
  // campo de texto grande, em linha própria; botões embaixo; sem sobreposição
  {const m=await page.evaluate(()=>{const t=document.querySelector('.compositor-campo textarea').getBoundingClientRect(),a=document.querySelector('.compositor-acoes').getBoundingClientRect(),e=document.querySelector('.compositor-enviar').getBoundingClientRect(),w=window.innerWidth;return {tw:t.width,th:t.height,ab:a.top>=t.bottom-1,env:e.right<=w&&e.left>=0,w}});
   assert.ok(m.th>=60,'campo de texto com altura confortável '+JSON.stringify(m));assert.ok(m.tw>=m.w*0.7,'campo de texto largo '+JSON.stringify(m));assert.ok(m.ab,'botões abaixo do campo');assert.ok(m.env,'Enviar visível');}
  // anexa PNG + TXT; tipo não aceito é recusado com aviso
  const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==','base64');
  await page.setInputFiles('input[type=file]',[{name:'foto-peca-com-nome-bem-comprido-para-testar-corte.png',mimeType:'image/png',buffer:PNG},{name:'tabela.csv',mimeType:'text/csv',buffer:Buffer.from('sku;qtd\n5112;3')}]);
  await page.locator('.anexos-lista li').nth(1).waitFor();assert.equal(await page.locator('.anexos-lista li').count(),2);
  await page.setInputFiles('input[type=file]',[{name:'virus.exe',mimeType:'application/x-msdownload',buffer:Buffer.from('MZ')}]);
  await page.getByRole('alert').filter({hasText:'use imagem'}).waitFor();assert.equal(await page.locator('.anexos-lista li').count(),2);
  // remover um anexo
  await page.getByRole('button',{name:/Remover tabela.csv/}).click();assert.equal(await page.locator('.anexos-lista li').count(),1);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false,`sem transbordamento com anexo a ${largura}px`);
  const caixa=await page.locator('.anexos-lista li').first().evaluate(e=>{const r=e.getBoundingClientRect();return [r.left,r.right,window.innerWidth]});assert.ok(caixa[1]<=caixa[2]+0.5&&caixa[0]>=0,'chip de anexo dentro da tela '+JSON.stringify(caixa));
  await mkdir(root+'evidencias-chat',{recursive:true});await page.screenshot({path:root+`evidencias-chat/anexo-chip-${largura}.png`});
  // envia: o corpo leva o anexo em base64 sem o prefixo data:, o balão mostra o nome e a lista esvazia
  await page.getByLabel('Pergunte',{exact:true}).fill('O que é esta peça?');await page.getByLabel('Pergunte',{exact:true}).press('Enter');
  await page.getByText('Resposta 1 da Nano.ia.').waitFor();
  assert.equal(corpos.length,1);assert.equal(corpos[0].anexos.length,1);assert.equal(corpos[0].anexos[0].tipo,'image/png');assert.equal(corpos[0].anexos[0].dados,PNG.toString('base64'));
  assert.ok(await page.locator('.anexos-enviados').first().innerText().then(t=>t.includes('foto-peca')));
  assert.equal(await page.locator('.anexos-lista').count(),0,'lista esvaziada após enviar');
  assert.deepEqual(erros,[]);await page.close();
 }
 console.log('anexo-chat-visual ok (300/360/390/1280px: anexar, recusar tipo, remover, enviar, sem transbordamento)');
}finally{await browser?.close();servidor.kill('SIGTERM');await rm(fixture,{force:true})}
