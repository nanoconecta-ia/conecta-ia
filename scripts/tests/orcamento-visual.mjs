// Orçamento por WhatsApp na página pública do produto, a 390px. Rede 100% interceptada e SINTÉTICA; nada sai para produção.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
const root=new URL('../../',import.meta.url).pathname,painel=root+'painel/';
const require=createRequire(painel+'package.json'),{chromium}=require('playwright');
const porta=4183,base=`http://127.0.0.1:${porta}`;
const servidor=spawn(process.execPath,[painel+'node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(porta)],{cwd:painel,stdio:'ignore'});
let browser;
try{
 for(let i=0;i<100;i++){try{if((await fetch(base+'/')).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
 browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:390,height:844}}),erros=[],externas=[];
 page.on('pageerror',e=>erros.push(e.message));
 await page.route('**/*',async route=>{
  const u=new URL(route.request().url());
  if(u.hostname==='127.0.0.1')return route.continue();
  if(u.pathname.endsWith('/functions/v1/loja-publica'))return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*'},
   body:JSON.stringify({produtos:[{nome:'Bomba de óleo — DEMO',sku:'DEMO-001',preco:100,marca:null,descricao:null,imagem:null,whatsapp:'https://wa.me/5511999998888?text=Ol%C3%A1'}],ficha:{veiculos:[]}})});
  externas.push(u.href);return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*'},body:'{}'});
 });
 await page.goto(`${base}/#/p/loja-demo/DEMO-001`);
 await page.getByRole('button',{name:'Adicionar ao orçamento'}).click();
 await page.getByRole('button',{name:'Mais uma unidade'}).click();
 const link=page.getByRole('link',{name:'Pedir orçamento no WhatsApp'});await link.waitFor();
 const href=await link.getAttribute('href');
 assert.match(href,/^https:\/\/wa\.me\/5511999998888\?text=/);
 const texto=decodeURIComponent(href.split('?text=')[1]);
 assert.match(texto,/1\. 2x Bomba de óleo — DEMO \(cód\. DEMO-001\)/);assert.match(texto,/Total de referência: R\$\s?200,00/);assert.match(texto,/confirmação de preço e estoque/);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true,'sem rolagem horizontal a 390px');
 await page.reload();await page.getByRole('link',{name:'Pedir orçamento no WhatsApp'}).waitFor(); // persistiu no navegador
 await page.getByRole('button',{name:'Remover Bomba de óleo — DEMO'}).click();
 assert.equal(await page.getByRole('link',{name:'Pedir orçamento no WhatsApp'}).count(),0);
 assert.deepEqual(erros,[]);
 console.log('orcamento-visual ok (390px, sem rolagem horizontal, mensagem e persistência verificadas)');
}finally{await browser?.close();servidor.kill()}
