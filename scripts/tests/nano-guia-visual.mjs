// Nano.IA integrado: chat expansível, navegação natural entre módulos e avaliação de layout. Sessão e rede sintéticas.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const root=new URL('../../',import.meta.url).pathname,painel=root+'painel/';
const require=createRequire(painel+'package.json'),{chromium}=require('playwright');
const porta=4187,base=`http://127.0.0.1:${porta}`;
const REF='dsfzhsrudriqkumtlqwj';
const servidor=spawn(process.execPath,[painel+'node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(porta)],{cwd:painel,stdio:'ignore'});
let browser;
try{
 for(let i=0;i<100;i++){try{if((await fetch(base+'/')).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
 browser=await chromium.launch({headless:true});
 for(const [largura,altura] of [[300,640],[360,740],[390,844],[1280,800]]){
  const context=await browser.newContext({viewport:{width:largura,height:altura}});
  const page=await context.newPage(),erros=[];
  page.on('pageerror',e=>erros.push(e.message));
  const sessao={access_token:'sintetico.sintetico.sintetico',refresh_token:'sintetico',token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user:{id:'11111111-1111-1111-1111-111111111111',aud:'authenticated',role:'authenticated',email:'demo@exemplo.invalid',app_metadata:{},user_metadata:{},created_at:'2026-01-01T00:00:00Z'}};
  await page.addInitScript(([k,v])=>localStorage.setItem(k,v),[`sb-${REF}-auth-token`,JSON.stringify(sessao)]);
  await page.route('**/*',async route=>{
   const u=new URL(route.request().url());
   if(u.hostname==='127.0.0.1')return route.continue();
   if(!u.hostname.endsWith('supabase.co')){throw Error('Rede não permitida no teste: '+u.hostname)}
   const h={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'};
   if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers:h});
   if(u.pathname.endsWith('/rest/v1/lojas'))return route.fulfill({status:200,contentType:'application/json',headers:h,body:JSON.stringify([{id:'aaaaaaaa-0000-0000-0000-000000000001',nome:'Loja DEMO',slug:'loja-demo',modo_venda:'whatsapp',ambiente:'teste',perfil_ramo:null}])});
   if(u.pathname.endsWith('/functions/v1/assistente')){const acao=JSON.parse(route.request().postData()||'{}').acao;return route.fulfill({status:200,contentType:'application/json',headers:h,body:JSON.stringify(acao==='provedores'?{verificado:true,provedores:[]}:acao==='chat_config'?{persistente:false,bling:false,leitura_administrativa:false,retencao_dias:180}:{conversas:[],registros:[]})})}
   if(u.pathname.endsWith('/auth/v1/user'))return route.fulfill({status:200,contentType:'application/json',headers:h,body:JSON.stringify(sessao.user)});
   return route.fulfill({status:200,contentType:'application/json',headers:h,body:u.pathname.includes('/rest/v1/')?'[]':'{}'});
  });
 
  await page.goto(`${base}/#/catalogo`);
  assert.equal(await page.locator('.balao-genesis,.esfera').count(),0,'interface sem esfera');
  const acionar = largura < 760
    ? page.locator('.workspace-mobile-tabs').getByRole('button',{name:'Nano.IA',exact:true})
    : page.getByRole('button',{name:'Abrir painel Nano.IA'});
  await acionar.waitFor();await acionar.click();
  const dock=page.locator('#dock-agente');await dock.waitFor({state:'visible'});
  const d=await dock.boundingBox();
  if(largura>600){assert.ok(d.height>=600,'janela espaçosa no notebook');
   await dock.getByRole('button',{name:'Ampliar a janela do Nano.ia'}).click();await page.waitForTimeout(450);assert.ok((await dock.boundingBox()).width>=900,'ampliada');await dock.getByRole('button',{name:'Reduzir a janela do Nano.ia'}).click();}
  else{assert.ok(d.width>=largura-16&&d.height>=altura*0.8,`janela quase cheia no smartphone (${Math.round(d.width)}x${Math.round(d.height)})`);}
  const campo=dock.getByLabel('Pergunte',{exact:true}),enviar=dock.getByRole('button',{name:'Enviar',exact:true});
  // linguagem natural: abre as telas em sequência, sem enviar nada ao servidor de IA
  await campo.fill('Abre a taxonomia, depois a fila de aprovação e em seguida imagens');await enviar.click();
  await page.waitForFunction(()=>location.hash==='#/taxonomia');
  assert.equal(await page.locator('.balao-genesis').count(),0,'sem esfera ao navegar por módulos');
  await page.waitForFunction(()=>location.hash==='#/fila');await page.waitForFunction(()=>location.hash==='#/imagens');
  await dock.getByText(/Pronto: abri Taxonomia, depois Fila de aprovação, depois Imagens e SEO/).waitFor();
  assert.ok((await dock.innerText()).includes('Quer que eu avalie o layout'));
  // avaliação do layout da tela atual
  await campo.fill('avalie o layout desta tela');await enviar.click();
  await dock.getByText(/Layout de ".*" a \d+ px/).waitFor();
  await campo.fill('o que você sabe fazer?');await enviar.click();await dock.getByText(/Telas disponíveis para você/).waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true,'sem rolagem horizontal');
  const passaDaBorda=await page.evaluate(()=>{const d=document.querySelector('#dock-agente').getBoundingClientRect();return [...document.querySelectorAll('#dock-agente *')].filter(e=>!e.closest('.aba')&&e.getBoundingClientRect().width>0&&(e.getBoundingClientRect().right>d.right+1||e.getBoundingClientRect().left<d.left-1)).map(e=>e.tagName+'.'+e.className)});
  assert.deepEqual(passaDaBorda,[],`nada na janela do agente passa da borda a ${largura}px`);
  await mkdir(root+'evidencias-chat',{recursive:true});await page.screenshot({path:root+`evidencias-chat/nano-guia-${largura}.png`});
  assert.deepEqual(erros,[]);
  await context.close();
 }
 console.log('nano-guia-visual ok (300, 360, 390 e 1280px: janela integrada sem esfera, navegação em sequência por linguagem natural, avaliação de layout)');
}finally{await browser?.close();servidor.kill()}
