// Painel lateral do Nano.ia no CELULAR (em pé, deitado e com texto grande 140/170%): nada fora da tela, cabeçalho sem sobreposição, caixa de texto e Enviar visíveis, sem esfera nem sobreposição. Sessão e rede 100% SINTÉTICAS.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const root=new URL('../../',import.meta.url).pathname,painel=root+'painel/';
const require=createRequire(painel+'package.json'),{chromium}=require('playwright');
const porta=4191,base=`http://127.0.0.1:${porta}`;
const REF='dsfzhsrudriqkumtlqwj';
const servidor=spawn(process.execPath,[painel+'node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(porta)],{cwd:painel,stdio:'ignore'});
let browser;const todas=[];
try{
 for(let i=0;i<100;i++){try{if((await fetch(base+'/')).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
 browser=await chromium.launch({headless:true});
 for(const [largura,altura,escala] of [[390,844],[360,740],[780,360],[844,390],[640,360],[360,700,140],[360,700,170],[360,640,170]]){
  const context=await browser.newContext({viewport:{width:largura,height:altura}});
  const page=await context.newPage(),erros=[],falhas=[];const ver=(c,m)=>{if(!c)falhas.push(m)};
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
 
  await page.goto(`${base}/#/integracoes`);
  if(escala)await page.addStyleTag({content:`html{font-size:${escala}% !important}`}); // texto grande do aparelho
  assert.equal(await page.locator('.balao-genesis').count(),0,'nenhuma esfera sobre a página');
  const acionador=largura<760
    ? page.locator('.workspace-mobile-tabs').getByRole('button',{name:'Nano.IA',exact:true})
    : page.getByRole('button',{name:'Abrir painel Nano.IA'});
  await acionador.waitFor();await acionador.click();
  const dock=page.locator('#dock-agente');await dock.waitFor({state:'visible'});await page.waitForTimeout(500);
  const rotulo=`${largura}x${altura}${escala?`@${escala}%`:''}`;
  // visível de verdade = dentro de todo ancestral que corta (overflow hidden/clip); rolar a página é permitido, ser cortado não
  const cortado=(loc)=>loc.evaluate((el)=>{const r=el.getBoundingClientRect();for(let a=el.parentElement;a&&a!==document.documentElement;a=a.parentElement){const o=getComputedStyle(a);if(o.overflowY==='hidden'||o.overflowY==='clip'){const b=a.getBoundingClientRect();if(r.top<b.top-1||r.bottom>b.bottom+1)return true}}return false});
  const dentro=(r)=>r.x>=-0.5&&r.y>=-0.5&&r.x+r.width<=largura+0.5&&r.y+r.height<=altura+0.5;
  const d=await dock.boundingBox();
  ver(dentro(d),`${rotulo}: a janela do Nano.ia cabe inteira na tela (${JSON.stringify(d)})`);
  // toda a barra de cima precisa estar à vista e ser tocável (fechar, ampliar...)
  for(const b of await dock.locator('.dock-topo button').all()){const r=await b.boundingBox();ver(r&&dentro(r),`${rotulo}: botão da barra de cima à vista (${await b.getAttribute('aria-label')})`);}
  ver((await page.locator('.balao-genesis,.esfera').count())===0,`${rotulo}: nenhuma esfera sobreposta ao chat`);
  // fixar à esquerda/direita só existe onde funciona (>= 1100 px)
  ver((await dock.getByRole('button',{name:/Fixar à (esquerda|direita)/}).count())===0,`${rotulo}: sem botões de fixar onde não funcionam`);
  // trilho: todas as abas tocáveis e à vista
  for(const t of await dock.locator('.dock-trilho .dock-aba').all()){const r=await t.boundingBox();ver(r&&dentro(r),`${rotulo}: aba do trilho à vista (${(await t.innerText()).trim()})`);}
  // cabeçalho do chat: título sem sobrepor os botões vizinhos
  const caixas=await page.evaluate(()=>{const h=document.querySelector('#dock-agente .agente');if(!h)return null;const r=(e)=>{const b=e.getBoundingClientRect();return {x:b.x,y:b.y,w:b.width,h:b.height}};return {titulo:r(h.querySelector('.agente-titulo h1')),botoes:[...h.querySelectorAll('button')].map(r)}});
  ver(caixas,`${rotulo}: cabeçalho do chat existe`);
  for(const b of caixas.botoes){const x=Math.max(0,Math.min(caixas.titulo.x+caixas.titulo.w,b.x+b.w)-Math.max(caixas.titulo.x,b.x)),y=Math.max(0,Math.min(caixas.titulo.y+caixas.titulo.h,b.y+b.h)-Math.max(caixas.titulo.y,b.y));ver(x*y<1,`${rotulo}: título "Nano.ia" não fica sob um botão (${Math.round(x*y)} px²)`);}
  // caixa de texto e Enviar à vista dentro do painel (rolando só o painel, não a página)
  const campo=dock.getByLabel('Pergunte',{exact:true}),enviar=dock.getByRole('button',{name:'Enviar',exact:true});
  const rc=await campo.boundingBox(),re=await enviar.boundingBox(),dd=await dock.boundingBox();
  ver(!(await cortado(campo))&&!(await cortado(enviar))&&dentro(rc)&&dentro(re),`${rotulo}: caixa de texto e Enviar à vista dentro do painel (${Math.round(re.y+re.height)} de ${altura})`);
  ver(rc.height>=40&&re.height>=36,`${rotulo}: caixa e botão com tamanho utilizável (${Math.round(rc.height)}/${Math.round(re.height)})`);
  // a versão do painel aparece no topo do Nano.ia (a barra de baixo fica escondida atrás da janela no celular)
  ver(/^v([0-9a-f]{7}|local)$/.test((await dock.locator('.dock-topo .dock-versao').innerText()).trim()),`${rotulo}: versão visível no topo do Nano.ia`);
  // título legível mesmo com texto grande: não vira "N." (sem reticências) e Enviar à vista dentro do painel
  const tit=await dock.locator('.agente-titulo h1').evaluate(e=>({c:e.clientWidth,s:e.scrollWidth}));ver(tit.s<=tit.c+1,`${rotulo}: título "Nano.ia" inteiro, sem reticências (${tit.s}/${tit.c})`);
  ver(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),`${rotulo}: sem rolagem horizontal`);
  await mkdir(root+'evidencias-chat',{recursive:true});await page.screenshot({path:root+`evidencias-chat/painel-celular-${rotulo}.png`});
  // tela Assistente (sem painel): caixa e Enviar precisam estar inteiros na tela, sem depender de rolar
  await page.goto(`${base}/#/assistente`);await page.getByLabel('Pergunte',{exact:true}).waitFor();await page.waitForTimeout(400);
  const ca=await page.getByLabel('Pergunte',{exact:true}).boundingBox(),ea=await page.getByRole('button',{name:'Enviar',exact:true}).boundingBox();
  ver(ca&&ea&&!(await cortado(page.getByLabel('Pergunte',{exact:true})))&&!(await cortado(page.getByRole('button',{name:'Enviar',exact:true}))),`${rotulo}: tela Assistente sem caixa/Enviar cortados pelo cartão`);
  await page.screenshot({path:root+`evidencias-chat/painel-celular-assistente-${rotulo}.png`});

  assert.deepEqual(erros,[]);
  todas.push(...falhas);
  await context.close();
 }
 assert.deepEqual(todas,[],'problemas de layout no celular:\n'+todas.join('\n'));
 console.log('painel-lateral-mobile-visual ok (390x844, 360x740, 780x360, 844x390, 640x360 e 360x700/640 com texto a 140% e 170%: painel inteiro à vista, sem sobreposição, Enviar visível, sem esfera flutuante)');
}finally{await browser?.close();servidor.kill()}
