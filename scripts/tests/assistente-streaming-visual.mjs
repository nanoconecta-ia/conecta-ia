// B2b (#166): chat canônico (Assistente) com streaming e cartão de proposta. Componente REAL, rede 100% SINTÉTICA.
// Servidor anuncia `streaming: true` -> a pergunta sai com stream: true e o resultado final (não o texto parcial) vira a resposta;
// a proposta devolvida pelo turno aparece como cartão lido do banco. Sem `resultado`, a prévia some e o erro é mostrado.
import { createRequire } from 'node:module';
import { writeFile, rm, mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
const root=new URL('../../',import.meta.url).pathname,painel=root+'painel/';
const require=createRequire(painel+'package.json'),{chromium}=require('playwright');
const fixture=painel+'.streaming-demo.html',porta=4203;
const L='aaaaaaaa-0000-4000-8000-000000000001',C='cccccccc-0000-4000-8000-000000000002',P='eeeeeeee-0000-4000-8000-000000000003';
await writeFile(fixture,`<html lang="pt-BR"><meta name="viewport" content="width=device-width, initial-scale=1.0"><div id="root"></div><script type="module">import React from 'react';import {createRoot} from 'react-dom/client';import {Assistente} from '/src/paginas/Assistente.tsx';import '/src/styles.css';import '/src/shell.css';createRoot(document.getElementById('root')).render(React.createElement(Assistente,{loja:{id:'${L}',nome:'Loja DEMO SIMULADA'}}));</script></html>`);
const servidor=spawn(process.execPath,[painel+'node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(porta)],{cwd:painel,stdio:'ignore'});
const sse=(eventos)=>eventos.map(([e,d])=>`event: ${e}\ndata: ${JSON.stringify(d)}\n\n`).join('');
let browser;
try{
 for(let i=0;i<100;i++){try{if((await fetch(`http://127.0.0.1:${porta}/.streaming-demo.html`)).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
 browser=await chromium.launch({headless:true});
 for(const [largura,altura,semResultado] of [[390,844,false],[1280,800,false],[390,844,true]]){
  const page=await browser.newPage({viewport:{width:largura,height:altura}});const erros=[];page.on('pageerror',e=>erros.push(e.message));const pedidos=[];
  await page.addInitScript(()=>{try{localStorage.setItem('sb-chat-auth-token',JSON.stringify({access_token:'jwt-sintetico',refresh_token:'r',token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user:{id:'u-sintetico',aud:'authenticated',role:'authenticated'}}))}catch{}});
  await page.route('**/*',async route=>{const u=new URL(route.request().url());
   if(u.hostname==='127.0.0.1'&&u.pathname==='/src/config.ts')return route.fulfill({contentType:'application/javascript',body:"export const SUPABASE_URL='https://chat.local.invalid';export const SUPABASE_CHAVE_PUBLICAVEL='chave-publica-apenas-sintetica';"});
   if(u.hostname==='127.0.0.1')return route.continue();
   if(u.hostname!=='chat.local.invalid')throw Error('Rede não permitida no teste: '+u.hostname);
   const h={'access-control-allow-origin':'*','access-control-allow-methods':'POST,GET,OPTIONS','access-control-allow-headers':'authorization,apikey,content-type,x-client-info,accept,accept-profile,prefer'};
   if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers:h});
   const json=(b)=>route.fulfill({status:200,contentType:'application/json',headers:h,body:JSON.stringify(b)});
   if(u.pathname.includes('/rpc/pode_administrar_loja'))return json(false);
   if(u.pathname.endsWith('/rest/v1/agente_propostas'))return json({id:P,loja_id:L,titulo:'Trocar a categoria do SKU CI000016',estado:'pendente',risco:'MEDIUM',versao:1,hash:'a1b2c3d4e5f60718',expira_em:new Date(Date.now()+86400000).toISOString(),agente:'Nano.ia',modelo:null,criado_em:new Date().toISOString()});
   if(u.pathname.includes('/rest/v1/'))return json([]);
   const c=route.request().postDataJSON()??{};
   if(c.acao==='provedores')return json({verificado:true,provedores:[{id:'gemini',nome:'Gemini',modelo:'gemini-sintetico',estado:'disponivel',principal:true}]});
   if(c.acao==='chat_config')return json({streaming:true,persistente:true,bling:true,leitura_administrativa:false,retencao_dias:180});
   if(c.acao==='chat_listar')return json({conversas:[]});
   if(c.acao==='chat_perguntar'){
    pedidos.push({stream:c.stream,auth:route.request().headers()['authorization'],accept:route.request().headers()['accept']});
    const ev=[['texto',{delta:'Faltam GTIN '}],['texto',{delta:'e descrição.'}]];
    if(!semResultado)ev.push(['resultado',{status:200,corpo:{resposta:'Faltam GTIN e descrição. Preparei a troca de categoria para você aprovar.',conversa_id:C,simulado:true,evidencias:[],propostas:[{id:P,titulo:'Trocar a categoria do SKU CI000016'}]}}]);
    return route.fulfill({status:200,headers:{...h,'content-type':'text/event-stream; charset=utf-8'},body:sse(ev)});
   }
   return route.abort();
  });
  await page.goto(`http://127.0.0.1:${porta}/.streaming-demo.html`);
  const r=`${largura}x${altura}${semResultado?' sem resultado':''}`;
  const aviso=page.locator('.aviso-envio');await aviso.waitFor();await aviso.getByRole('button',{name:'Autorizar e continuar'}).click();await aviso.waitFor({state:'detached'});
  await page.getByLabel('Pergunte',{exact:true}).fill('O que falta no SKU CI000016?');
  await page.getByRole('button',{name:'Enviar',exact:true}).click();
  if(!semResultado){
   await page.getByText('Preparei a troca de categoria para você aprovar.').waitFor();
   const card=page.getByRole('article',{name:'Proposta: Trocar a categoria do SKU CI000016'});await card.waitFor();
   assert.equal(await page.getByText('Faltam GTIN e descrição.',{exact:true}).count(),0,`${r}: a prévia parcial não fica duplicada ao lado da resposta final`);
   assert.equal(await card.getByText('Abrir na Central de Inteligência').count(),0,`${r}: Central oculta -> cartão sem link para ela`);
  } else {
   await page.getByText(/A conexão caiu antes do fim da resposta/).first().waitFor();
   assert.equal(await page.getByText('Faltam GTIN e descrição.',{exact:true}).count(),0,`${r}: sem resultado, o texto parcial nunca vira resposta`);
  }
  assert.equal(pedidos.length,1,`${r}: uma pergunta`);
  assert.equal(pedidos[0].stream,true,`${r}: stream: true`);
  assert.equal(pedidos[0].auth,'Bearer jwt-sintetico',`${r}: token do usuário`);
  assert.match(pedidos[0].accept,/text\/event-stream/,`${r}: Accept SSE`);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),`${r}: sem rolagem horizontal`);
  await mkdir(root+'evidencias-issue-166',{recursive:true});await page.screenshot({path:root+`evidencias-issue-166/b2b-streaming-${largura}${semResultado?'-sem-resultado':''}.png`});
  assert.deepEqual(erros,[]);
  await page.close();
 }
 console.log('assistente-streaming-visual ok (390/1280px: stream com token, resposta final + cartão de proposta lido do banco, sem link para a Central; sem resultado a prévia não vira resposta)');
}finally{await browser?.close();servidor.kill('SIGTERM');await rm(fixture,{force:true})}
