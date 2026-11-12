// Componente real; todas as respostas de dados são SINTÉTICAS, sem acesso a produção.
import { createRequire } from 'node:module';
import { writeFile, rm, mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
const root=new URL('../../',import.meta.url).pathname,painel=root+'painel/';
const require=createRequire(painel+'package.json'),{chromium}=require('playwright');
const fixture=painel+'.estudio-demo.html';
const L='aaaaaaaa-0000-0000-0000-000000000001';
await writeFile(fixture,`<html lang="pt-BR"><meta name="viewport" content="width=device-width, initial-scale=1.0"><div style="padding:8px;background:#fff1ca;color:#533900;font:12px sans-serif;text-align:center">DEMONSTRAÇÃO · DADOS SINTÉTICOS · SEM EXECUÇÃO NO ERP</div><div id="root"></div><script type="module">import React from 'react';import {createRoot} from 'react-dom/client';import {EstudioAgente} from '/src/paginas/EstudioAgente.tsx';import '/src/styles.css';createRoot(document.getElementById('root')).render(React.createElement('main',null,React.createElement(EstudioAgente,{loja:{id:'${L}',nome:'Mobis · DEMONSTRAÇÃO',slug:'mobis',perfil_ramo:'autopecas'}})));</script></html>`);
const servidor=spawn(process.execPath,[painel+'node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4181'],{cwd:painel,stdio:'ignore'});
let browser;
try{
 for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:4181/.estudio-demo.html')).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
 browser=await chromium.launch({headless:true});
 const context=await browser.newContext({permissions:['clipboard-read','clipboard-write']});const page=await context.newPage(),erros=[],requests=[];let falharProxima=false;
 page.on('pageerror',e=>erros.push(e.message));
 await page.route('**/*',async route=>{
  const req=route.request(),u=new URL(req.url());
  if(u.hostname==='127.0.0.1'&&u.pathname==='/src/config.ts')return route.fulfill({contentType:'application/javascript',body:"export const SUPABASE_URL='https://estudio.local.invalid';export const SUPABASE_CHAVE_PUBLICAVEL='publica-sintetica';"});
  if(u.hostname==='127.0.0.1')return route.continue();
  if(u.hostname!=='estudio.local.invalid')throw Error('Rede não permitida no teste: '+u.hostname);
  requests.push({path:u.pathname,method:req.method(),loja:u.searchParams.get('loja_id')});
  assert.equal(req.method(),'GET','Estúdio não deve gravar nem chamar IA');
  let body;
  if(u.pathname==='/rest/v1/produtos'){
   assert.equal(u.searchParams.get('loja_id'),'eq.'+L);
   if(falharProxima){falharProxima=false;return route.fulfill({status:500,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({message:'erro sintético'})})}
   body=u.searchParams.get('sku')==='eq.80692'?{id:'produto-sintetico',nome:'Produto de teste — DADOS SIMULADOS',sku:'80692',marca:'Marca de teste',gtin:null,descricao:'Descrição de demonstração. Não são dados reais do Bling.',preco:79.9,estoque:12,sincronizado_em:'2026-10-18T14:00:00Z',publicado:false}:null;
  }else if(u.pathname==='/rest/v1/produto_imagens'){
   assert.equal(u.searchParams.get('loja_id'),'eq.'+L);assert.equal(u.searchParams.get('aprovada'),'eq.true');assert.equal(u.searchParams.get('produto_id'),'eq.produto-sintetico');body=[];
  }else if(u.pathname==='/rest/v1/taxonomia_nos')body=[{id:'no1',pai_id:null,nome:'Classificação DEMO',slug:'demo',ordem:1}];
  else if(u.pathname==='/rest/v1/bling_categoria_taxonomia')body=[];
  else if(u.pathname==='/rest/v1/bling_categorias'){assert.equal(u.searchParams.get('loja_id'),'eq.'+L);body=[];}
  else if(['/rest/v1/montadoras','/rest/v1/modelos','/rest/v1/motores','/rest/v1/produto_aplicacoes'].includes(u.pathname)){body=[];}
  else throw Error('Endpoint inesperado '+u.pathname);
  return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(body)});
 });
 await mkdir(root+'evidencias-estudio',{recursive:true});
 for(const width of [1440,1024,768,390]){
  await page.setViewportSize({width,height:960});await page.goto('http://127.0.0.1:4181/.estudio-demo.html');
  await page.getByRole('heading',{name:'Produto de teste — DADOS SIMULADOS'}).waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Sem overflow '+width);
  // Olho do Nano (E02): só aparece com atividade, vai ao campo, volta à âncora, some; nunca intercepta clique nem sai da tela.
  const olho=page.locator('.olho-nano'),estadoOlho=()=>olho.evaluate(el=>{const r=el.getBoundingClientRect(),c=getComputedStyle(el);return{classe:el.className,visivel:c.visibility==='visible',clique:c.pointerEvents,x:r.x,y:r.y,d:r.right,b:r.bottom,l:r.width}});
  let eo=await estadoOlho();assert.equal(eo.visivel,false,'Olho escondido sem atividade '+width);assert.equal(eo.clique,'none');assert.equal(await olho.getAttribute('aria-hidden'),'true');
  await page.locator('.estudio-agente input').first().click();await page.waitForTimeout(900);eo=await estadoOlho();
  assert.equal(eo.visivel,true,'Olho aparece com atividade '+width);assert.match(eo.classe,/em-movimento/);assert.ok(eo.x>=0&&eo.y>=0&&eo.d<=width+1&&eo.b<=961,'Olho dentro da tela '+width);
  assert.equal(await page.evaluate(()=>{const r=document.querySelector('.olho-nano').getBoundingClientRect();return !!document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('.olho-nano')}),false,'Olho não intercepta clique');
  const lFoco=eo.l;await page.screenshot({path:root+`evidencias-estudio/olho-e02-${width}-SIMULADO.png`});
  await page.waitForTimeout(1400);eo=await estadoOlho();assert.match(eo.classe,/em-casa/,'Olho volta à origem '+width);assert.ok(eo.l>lFoco,'Escala proporcional: menor no foco, inteiro em casa');
  assert.deepEqual(await page.locator('.olho-nano img').evaluate(i=>[i.naturalWidth,i.naturalHeight,Math.round(i.getBoundingClientRect().width)===Math.round(i.getBoundingClientRect().height)]),[184,184,true],'Desenho E02 original, sem deformar');
  if(width===390){await page.waitForTimeout(5200);assert.equal((await estadoOlho()).visivel,false,'Olho se recolhe na inatividade');}
  await page.getByRole('button',{name:'Preparar tarefa',exact:false}).click();
  await page.getByLabel('Tarefa para o agente').waitFor();assert.match(await page.getByLabel('Tarefa para o agente').inputValue(),/SKU 80692/);
  assert.equal(await page.getByRole('button',{name:'Pareamento ainda indisponível'}).isDisabled(),true);
  await page.screenshot({path:root+`evidencias-estudio/lateral-${width}-SIMULADO.png`,fullPage:true});
  // Transferência opcional de miniatura SINTÉTICA para inspeção em workspace sem download de artefatos.
  if(process.env.ESTUDIO_MINIATURAS==='1'&&(width===1440||width===390))console.log(`ESTUDIO_PREVIA_JPEG_${width}=`+(await page.screenshot({type:'jpeg',quality:35})).toString('base64'));
  await page.getByRole('button',{name:'Flutuante',exact:true}).click();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Flutuante sem overflow '+width);
  const box=await page.getByRole('complementary',{name:'Torre do agente'}).boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width+1);assert.ok(box.y>=0&&box.y+box.height<=960+1);
  await page.screenshot({path:root+`evidencias-estudio/flutuante-${width}-SIMULADO.png`,fullPage:true});
  await page.getByRole('button',{name:'Copiar tarefa para o chat'}).click();assert.match(await page.evaluate(()=>navigator.clipboard.readText()),/SKU 80692/);
  await page.keyboard.press('Escape');assert.equal(await page.getByRole('button',{name:'Abrir agente',exact:false}).getAttribute('aria-expanded'),'false');
  await page.getByRole('button',{name:'Browser remoto',exact:false}).click();await page.getByRole('heading',{name:'Sessão de browser ainda não conectada'}).waitFor();
  await page.getByRole('button',{name:'Voltar à área integrada'}).click();
  await page.getByRole('button',{name:'Taxonomia',exact:true}).click();await page.getByRole('button',{name:'Classificação DEMO'}).waitFor();
  await page.getByRole('button',{name:'Imagens',exact:true}).click();await page.getByText('Nenhuma imagem aprovada disponível para este produto.').waitFor();
  await page.getByRole('button',{name:'SEO técnico',exact:true}).click();await page.getByRole('heading',{name:'SEO técnico do produto'}).waitFor();
  await page.emulateMedia({reducedMotion:'reduce'});await page.getByRole('button',{name:'Abrir agente',exact:false}).click();assert.equal(await page.getByRole('complementary',{name:'Torre do agente'}).evaluate(el=>getComputedStyle(el).animationName),'none');await page.keyboard.press('Escape');
  await page.locator('.estudio-agente input').first().click();await page.waitForTimeout(300);assert.match(await page.locator('.olho-nano').getAttribute('class'),/visivel em-casa|em-casa/,'Movimento reduzido: olho aparece parado na origem');assert.doesNotMatch(await page.locator('.olho-nano').getAttribute('class'),/em-movimento/);await page.emulateMedia({reducedMotion:'no-preference'});
  if(width===390){await page.getByRole('button',{name:'Produto',exact:true}).click();falharProxima=true;await page.getByRole('button',{name:'Abrir',exact:true}).click();await page.getByRole('alert').filter({hasText:'Não foi possível consultar o produto desta loja.'}).waitFor();assert.equal(await page.getByRole('button',{name:'Preparar tarefa',exact:false}).isDisabled(),true);await page.getByRole('button',{name:'Abrir',exact:true}).click();await page.getByRole('heading',{name:'Produto de teste — DADOS SIMULADOS'}).waitFor();console.log('ok: falha de consulta desabilita tarefa e o mesmo SKU pode ser consultado novamente');}
  console.log(`ok: ${width}px, torre lateral/flutuante, contexto, clipboard, taxonomia/imagens/SEO, browser pendente, Escape, Olho E02 e movimento reduzido`);
 }
 assert.deepEqual(erros,[]);assert.ok(requests.length>0);assert.ok(requests.every(r=>r.method==='GET'));console.log('ok: somente leituras sintéticas; zero escrita, execução de agente, credencial ou QR falso');
}finally{await browser?.close();servidor.kill('SIGTERM');await rm(fixture,{force:true})}
