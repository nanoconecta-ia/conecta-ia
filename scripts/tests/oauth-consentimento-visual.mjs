// Componente nativo real, RPCs SIMULADAS e toda rede externa bloqueada.
import {createRequire} from 'node:module';
import {writeFile,rm,mkdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const root=new URL('../../',import.meta.url).pathname,painel=root+'painel/';
const require=createRequire(painel+'package.json'),{chromium}=require('playwright');
const fixture=painel+'.oauth-demo.html';
await writeFile(fixture,`<html lang="pt-BR"><meta name="viewport" content="width=device-width, initial-scale=1.0"><p style="text-align:center">DEMONSTRAÇÃO · CONSENTIMENTO SIMULADO</p><div id="root"></div><script type="module">import React from 'react';import {createRoot} from 'react-dom/client';import {AutorizarAgente} from '/src/paginas/AutorizarAgente.tsx';import '/src/styles.css';createRoot(document.getElementById('root')).render(React.createElement(AutorizarAgente,{codigo:'${'c'.repeat(43)}'}));</script></html>`);
const server=spawn(process.execPath,[painel+'node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4182'],{cwd:painel,stdio:'ignore'});
let browser;
try{
 for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:4182/.oauth-demo.html')).ok)break}catch{}await new Promise(ok=>setTimeout(ok,100))}
 browser=await chromium.launch({headless:true});const page=await browser.newPage(),erros=[],calls=[];let falha=false;
 page.on('pageerror',e=>erros.push(e.message));
 await page.route('**/*',async route=>{
  const req=route.request(),u=new URL(req.url());
  if(u.hostname==='127.0.0.1'&&u.pathname==='/src/config.ts')return route.fulfill({contentType:'application/javascript',body:"export const SUPABASE_URL='https://oauth.local.invalid';export const SUPABASE_CHAVE_PUBLICAVEL='publica-sintetica';"});
  if(u.hostname==='127.0.0.1')return route.continue();
  assert.equal(u.hostname,'oauth.local.invalid');assert.equal(req.method(),'POST');
  const body=req.postDataJSON();calls.push({path:u.pathname,body});let data;
  if(u.pathname.endsWith('/oauth_pair_detalhe'))data=falha?null:{nome:'Cliente SIMULADO',redirect_uri:'https://cliente.example/callback',state:'state-sintetico',offline:true,escopos:['produtos:ler','bling:consultar'],duracao_min:60,lojas:[{id:'loja-A',nome:'Empresa A SIMULADA'}]};
  else if(u.pathname.endsWith('/oauth_pair_aprovar')){assert.equal(body.p_loja,'loja-A');assert.deepEqual(body.p_escopos,['bling:consultar']);assert.equal(body.p_duracao,15);assert.equal(body.p_offline,false);data={ok:false,motivo:'reconfirmacao_necessaria'}}
  else throw Error('Endpoint inesperado '+u.pathname);
  return route.fulfill({contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(data)});
 });
 await mkdir(root+'evidencias-estudio',{recursive:true});
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:960});await page.goto('http://127.0.0.1:4182/.oauth-demo.html');
  await page.getByRole('heading',{name:'Cliente SIMULADO'}).waitFor();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.getByLabel('Ver produtos da loja',{exact:false}).uncheck();await page.getByLabel('Permitir renovação',{exact:false}).uncheck();
  await page.screenshot({path:root+`evidencias-estudio/oauth-consentimento-${width}-SIMULADO.png`,fullPage:true});
  await page.getByRole('button',{name:'Autorizar acesso',exact:true}).click();await page.getByRole('button',{name:'Entrar novamente',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Autorizar acesso',exact:true}).isDisabled(),true);assert.match(page.url(),/127\.0\.0\.1/);
 }
 falha=true;await page.reload();await page.getByRole('alert').waitFor();assert.equal(await page.getByRole('button',{name:'Autorizar acesso',exact:true}).count(),0);
 assert.deepEqual(erros,[]);assert.equal(calls.filter(c=>c.path.endsWith('/oauth_pair_aprovar')).length,2);
 console.log('Consentimento nativo em 1440/390px: permissões e renovação reduzíveis, empresa exata e falha de autenticação bloqueiam autorização. SIMULADO.');
}finally{if(browser)await browser.close();server.kill('SIGTERM');await rm(fixture,{force:true})}
