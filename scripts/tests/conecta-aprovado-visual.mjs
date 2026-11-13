// App real, sessão e respostas SINTÉTICAS. Nunca acessa o backend de produção.
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const root=new URL('../../',import.meta.url).pathname,painel=root+'painel/';
const require=createRequire(painel+'package.json'),{chromium}=require('playwright');
const remoto=process.env.WORKSPACE_BASE_URL,base=remoto??'http://127.0.0.1:4255/';
const servidor=remoto?null:spawn(process.execPath,[painel+'node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4255'],{cwd:painel,stdio:'ignore'});
const L='aaaaaaaa-0000-0000-0000-000000000001',REF='dsfzhsrudriqkumtlqwj';
const sessao={access_token:'sintetico.sintetico.sintetico',refresh_token:'sintetico',token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user:{id:'11111111-1111-1111-1111-111111111111',aud:'authenticated',role:'authenticated',email:'teste@exemplo.invalid',app_metadata:{},user_metadata:{},created_at:'2026-01-01T00:00:00Z'}};
const loja={id:L,nome:'Mobis · DEMONSTRAÇÃO SINTÉTICA',slug:'mobis',perfil_ramo:'autopecas',ambiente:'teste',modo_venda:'whatsapp'};
const produtos=[{id:'p1',sku:'TESTE-01',nome:'Produto sintético para teste',marca:'Fabricante sintético',taxonomia_no_id:'n1',publicado:false},{id:'p2',sku:'TESTE-02',nome:'Outro produto sintético',marca:null,taxonomia_no_id:null,publicado:false}];
const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*','access-control-expose-headers':'content-range'};
let browser;const resultado=[];
async function preparar(context,autenticado=true){
 if(autenticado)await context.addInitScript(([k,v])=>localStorage.setItem(k,v),[`sb-${REF}-auth-token`,JSON.stringify(sessao)]);
 await context.route('**/*',async route=>{
  const req=route.request(),u=new URL(req.url());
  if(u.origin===new URL(base).origin)return route.continue();
  assert.ok(u.hostname.endsWith('supabase.co'),'Rede não autorizada: '+u.hostname);
  if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
  let body=[],count=null;
  if(u.pathname==='/auth/v1/user')body=sessao.user;
  else if(u.pathname.endsWith('/functions/v1/assistente')){
   const a=JSON.parse(req.postData()||'{}').acao;
   assert.ok(['provedores','chat_config','chat_conversas','chat_listar','chat_mensagens'].includes(a),'Nenhuma execução automática: '+a);
   body=a==='provedores'?{verificado:true,provedores:[]}:a==='chat_config'?{persistente:false,bling:false,leitura_administrativa:false,retencao_dias:180}:{conversas:[],registros:[]};
  }else if(u.pathname.endsWith('/rest/v1/lojas'))body=[loja];
  else if(u.pathname.endsWith('/rest/v1/produtos')){
   assert.equal(u.searchParams.get('loja_id'),'eq.'+L);body=req.method()==='HEAD'?[]:produtos;count=u.searchParams.get('publicado')?0:2;
  }else if(u.pathname.endsWith('/rest/v1/produto_aplicacoes')){
   assert.equal(u.searchParams.get('loja_id'),'eq.'+L);count=1;body=req.method()==='HEAD'?[]:[{produto_id:'p1',status:'aprovado',modelo:'HR',motorizacao:'D4CB',ano_inicial:2013,ano_final:2022}];
  }else if(u.pathname.endsWith('/rest/v1/aprovacoes')){assert.equal(u.searchParams.get('loja_id'),'eq.'+L);count=0;}
  else if(u.pathname.endsWith('/rest/v1/taxonomia_nos'))body=[{id:'n1',nome:'Motor',pai_id:null,slug:'motor',ordem:1}];
  else if(u.pathname.endsWith('/rest/v1/produto_imagens')){assert.equal(u.searchParams.get('loja_id'),'eq.'+L);assert.equal(u.searchParams.get('aprovada'),'eq.true');}
  else if(req.method()!=='GET'&&req.method()!=='HEAD')assert.ok(u.pathname.includes('/rest/v1/rpc/'),'Escrita inesperada '+u.pathname);
  return route.fulfill({status:200,contentType:'application/json',headers:{...headers,...(count===null?{}:{'content-range':`0-${Math.max(0,count-1)}/${count}`})},body:req.method()==='HEAD'?'':JSON.stringify(body)});
 });
}
try{
 if(servidor)for(let i=0;i<100;i++){try{if((await fetch(base)).ok)break}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({headless:true});await mkdir(root+'evidencias-conecta-aprovado',{recursive:true});
 for(const width of [360,390,412,1280]){
  const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'});await preparar(context);
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'#/');await page.locator('[data-inicio-layout="aprovado-v2"]').waitFor();await page.getByText('2 produtos no espelho',{exact:true}).waitFor();
  assert.equal(await page.locator('[data-conecta-layout="aprovado-v2"]').count(),1);assert.equal(await page.locator('.topo-premium,.layout-premium,.menu-premium').count(),0,'shell anterior removido');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'início sem overflow '+width);
  await page.screenshot({path:root+`evidencias-conecta-aprovado/inicio-${width}-SIMULADO.png`});
  if(width<781){await page.getByRole('button',{name:'Abrir navegação',exact:true}).click();await page.getByRole('link',{name:'Estúdio do Nano',exact:true}).click();}
  else await page.getByRole('link',{name:'Estúdio do Nano',exact:true}).click();
  await page.locator('[data-nano-layout="aprovado-v2"]').waitFor();const campo=page.getByRole('textbox',{name:'Pergunte',exact:true});await campo.waitFor();
  assert.equal(await page.locator('.estudio-agente,.dock-agente,.balao-genesis').count(),0,'interfaces anteriores não são montadas');assert.equal(await page.locator('.ap-tower button').count(),6);
  assert.equal(await campo.isVisible(),true,'conversa visível '+width);
  await campo.click();await page.waitForFunction(()=>getComputedStyle(document.querySelector('.olho-nano')).visibility==='visible');
  assert.equal(await page.locator('.olho-nano').getAttribute('aria-hidden'),'true');assert.equal(await page.locator('.olho-nano').evaluate(el=>getComputedStyle(el).pointerEvents),'none');
  await page.getByRole('button',{name:'Ajustar chat',exact:true}).click();await page.getByRole('slider',{name:'Altura da conversa'}).focus();await page.keyboard.press('End');
  await page.getByRole('button',{name:'Ajustar chat',exact:true}).click();
  await page.getByRole('button',{name:'Abrir Tabelas',exact:true}).click();await page.getByRole('heading',{name:'Produtos do espelho.',exact:true}).waitFor();
  assert.equal(await page.getByText('Produto sintético para teste',{exact:true}).isVisible(),true);
  await page.getByRole('button',{name:'Abrir Imagens',exact:true}).click();await page.getByText('Nenhuma imagem aprovada disponível.',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Abrir Gráficos',exact:true}).click();
  if(width<781)await page.getByRole('button',{name:'Conversa',exact:true}).click();
  await campo.fill('ajuda');await campo.press('Enter');await page.waitForFunction(()=>document.querySelectorAll('.ap-chat-panel .bolha,.ap-chat-panel .bolha-linha').length>=3);
  assert.equal(await campo.inputValue(),'');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'Nano sem overflow '+width);
  await page.screenshot({path:root+`evidencias-conecta-aprovado/nano-${width}-SIMULADO.png`});
  await page.goto(base+'#/catalogo-aplicacao');await page.locator('[data-catalogo-layout="aprovado-v2"]').waitFor();await page.getByText('Produto sintético para teste',{exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'catálogo sem overflow '+width);
  await page.screenshot({path:root+`evidencias-conecta-aprovado/catalogo-${width}-SIMULADO.png`});
  assert.deepEqual(errors,[],'sem erros JavaScript');resultado.push({width,interface:'aprovado-v2',origem:remoto?'publicada':'local',dados:'SIMULADOS',errors});await context.close();console.log('CONECTA/NANO APROVADO '+width+'px OK');
 }
 const context=await browser.newContext({viewport:{width:390,height:900},serviceWorkers:'block'});await preparar(context,false);const page=await context.newPage();await page.goto(base+'#/');await page.locator('[data-acesso-layout="aprovado-v2"]').waitFor();assert.equal(await page.locator('.entrada-portal').count(),0);await page.screenshot({path:root+'evidencias-conecta-aprovado/entrada-390-SIMULADO.png'});await context.close();
}catch(e){if(browser)for(const [i,c] of browser.contexts().entries())for(const [j,p]of c.pages().entries()){await p.screenshot({path:root+`evidencias-conecta-aprovado/falha-${i}-${j}-SIMULADO.png`,fullPage:true}).catch(()=>{});await writeFile(root+`evidencias-conecta-aprovado/falha-${i}-${j}.txt`,await p.locator('body').innerText().catch(()=>''));}throw e;}finally{await browser?.close();servidor?.kill('SIGTERM');await writeFile(root+'evidencias-conecta-aprovado/resultado.json',JSON.stringify(resultado,null,2));}
