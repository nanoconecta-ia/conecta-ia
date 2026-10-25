// Vitrine: guia "como encontrar sua peça", passos numerados e filtros ativos (chips). Rede 100% interceptada e SINTÉTICA.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
const root=new URL('../../',import.meta.url).pathname,painel=root+'painel/';
const require=createRequire(painel+'package.json'),{chromium}=require('playwright');
const porta=4185,base=`http://127.0.0.1:${porta}`;
const servidor=spawn(process.execPath,[painel+'node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(porta)],{cwd:painel,stdio:'ignore'});
const prod=n=>({nome:`Peça DEMO ${n}`,sku:`DEMO-00${n}`,preco:100+n,em_estoque:true,marca:null,descricao:null,imagem:null,whatsapp:null,atualizado_em:'2026-10-24T12:00:00Z'});
let browser;
try{
 for(let i=0;i<100;i++){try{if((await fetch(base+'/')).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
 browser=await chromium.launch({headless:true});
 for(const [w,h] of [[390,844],[1280,800]]){
  const page=await browser.newPage({viewport:{width:w,height:h}}),erros=[],corpos=[];
  page.on('pageerror',e=>erros.push(e.message));
  await page.route('**/*',async r=>{
   const u=new URL(r.request().url());
   if(u.hostname==='127.0.0.1')return r.continue();
   if(!u.pathname.endsWith('/functions/v1/loja-publica')&&r.request().method()!=='OPTIONS')throw Error('Rede não permitida no teste: '+u.href);
   const hd={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*','content-type':'application/json'};
   if(r.request().method()==='OPTIONS')return r.fulfill({status:204,headers:hd});
   const c=JSON.parse(r.request().postData()||'{}');corpos.push(c);
   const todos=[1,2,3,4].map(prod);const ps=c.tipo||c.categoria?todos.slice(0,2):todos;
   return r.fulfill({status:200,headers:hd,body:JSON.stringify({loja:{nome:'Loja DEMO',slug:'loja-demo',modo_venda:'whatsapp'},tema:{variaveis:{},logo_url:null,icone_url:null},produtos:ps,total:ps.length,pagina:1,por_pagina:24,
    veiculos:[{modelo:'HR',motor:'2.5',de:2010,ate:2020}],tipos:[{tipo:'furgao',total:3}],categorias:[{nome:'Motor',slug:'motor',total:5}]})});
  });
  await page.goto(`${base}/#/loja/loja-demo`);
  await page.getByRole('navigation',{name:'Como encontrar sua peça'}).waitFor();
  assert.equal(await page.getByText('4 peças encontradas no catálogo').count(),1,'contagem sem filtro');
  for(const t of ['1 Qual é o tipo do seu veículo?','2 Busca por veículo','3 Qual peça você procura?'])assert.ok(await page.getByRole('heading',{name:new RegExp(t,'i')}).count()>0,'passo: '+t);
  await page.getByRole('button',{name:/Furgão fechado/}).click();
  await page.getByRole('button',{name:'Remover filtro Tipo: Furgão fechado'}).waitFor();
  assert.ok(await page.getByText('2 peças encontradas com os filtros escolhidos').count()>0,'contagem com filtro');
  assert.equal(corpos.at(-1).tipo,'furgao','o filtro foi enviado ao servidor');
  await page.getByRole('button',{name:'Remover filtro Tipo: Furgão fechado'}).click();
  await page.getByText('4 peças encontradas no catálogo').waitFor();
  await page.getByRole('button',{name:/^Motor/}).click();await page.getByRole('button',{name:/Remover filtro Peça: Motor/}).waitFor();
  await page.getByRole('button',{name:'Limpar tudo'}).click();await page.getByText('4 peças encontradas no catálogo').waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true,`sem rolagem horizontal a ${w}px`);
  assert.deepEqual(erros,[]);await page.close();
 }
 console.log('loja-filtros-visual ok (390px e 1280px: guia, passos, chips, contagem e limpar)');
}finally{await browser?.close();servidor.kill()}
