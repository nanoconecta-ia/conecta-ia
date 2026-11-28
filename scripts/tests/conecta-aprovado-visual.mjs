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
  // O Pages redireciona para o domínio próprio da loja (CNAME): mesmo build estático, não é rede externa.
  if(u.origin===new URL(base).origin||u.hostname==='www.mobisautopecas.com.br')return route.continue();
  assert.ok(u.hostname.endsWith('supabase.co'),'Rede não autorizada: '+u.hostname);
  if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
  let body=[],count=null;
  if(u.pathname==='/auth/v1/user')body=sessao.user;
  else if(u.pathname.endsWith('/functions/v1/assistente')){
   const a=JSON.parse(req.postData()||'{}').acao;
   assert.ok(['provedores','chat_config','chat_conversas','chat_listar','chat_mensagens'].includes(a),'Nenhuma execução automática: '+a);
   body=a==='provedores'?{verificado:true,provedores:[]}:a==='chat_config'?{persistente:false,bling:false,leitura_administrativa:false,retencao_dias:180}:{conversas:[],registros:[]};
  }else if(u.pathname.endsWith('/functions/v1/loja-publica')){
   const pedido=JSON.parse(req.postData()||'{}');
   assert.equal(pedido.slug,'mobis','prévia somente da loja Mobis selecionada');
   body={loja:{nome:loja.nome,slug:loja.slug,ambiente:'teste',whatsapp:null},
    produtos:[],total:0,pagina:1,por_pagina:24,banners:[],veiculos:[],categorias:[],
    layout:{blocos:['banner','montadoras','taxonomia','catalogo','empresa'],intervalo_segundos:6},paleta:null};
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
async function verificarMAPrivado(page,area){
 const shell=page.locator('[data-conecta-layout="aprovado-v2"][data-ma-display="prismatic"]');
 await shell.waitFor();
 assert.equal(await shell.count(),1,'shell MA Display único');
 assert.equal(await shell.getAttribute('data-area'),area,'área operacional correta');
 assert.match(await shell.evaluate(el=>getComputedStyle(el).getPropertyValue('--ma-film-brush').trim()),/repeating-linear-gradient/,'película MA Display presente');
 assert.match(await shell.locator('.ap-loja-marca img').getAttribute('src')||'',/mobis-mstyle-v3-sem-slogan/,'logotipo oficial Mobis preservado');
 assert.equal(await page.locator('.topo-premium,.layout-premium,.menu-premium,.estudio-agente,.dock-agente,.balao-genesis').count(),0,'interfaces legadas ausentes');
 assert.equal(await page.locator('[data-mobis-site="v3"]').count(),0,'painel privado não monta vitrine pública');
}
try{
 if(servidor)for(let i=0;i<100;i++){try{if((await fetch(base)).ok)break}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({headless:true});await mkdir(root+'evidencias-conecta-aprovado',{recursive:true});
 for(const width of [360,390,412,1280]){
  const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'});await preparar(context);
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'#/');await page.locator('[data-inicio-layout="aprovado-v2"]').waitFor();await page.getByText('2 produtos no espelho',{exact:true}).waitFor();
  const mapa=page.locator('[data-mapa-operacional="1.0.0"]');await mapa.waitFor();
  const painel=page.locator('[data-conecta-layout="aprovado-v2"]');
  assert.ok(await painel.locator('[data-ativo-estado="ma-display"]').count()>0,'biblioteca universal MA Display ativa no painel Mobis');
  assert.equal(await painel.locator('[data-ativo-estado="atlas-historico"]').count(),0,'Mobis não renderiza atlas anterior');
  assert.equal(await painel.locator('.ap-ativo').evaluateAll(els=>els.filter(el=>getComputedStyle(el).backgroundImage.includes('atlas-modelo-aprovado')).length),0,'atlas não é pintado no painel Mobis');

  assert.equal(await mapa.locator('[data-raiz-operacional]').count(),12,'as 12 raízes canônicas estão presentes');
  assert.equal(await mapa.locator('[data-raiz-operacional] [data-ma-icone^="raiz."]').count(),12,'cada raiz usa ícone da biblioteca universal MA');
  assert.equal(await mapa.locator('a').count(),4,'somente atalhos existentes');
  assert.equal(await mapa.locator('[data-raiz-operacional="erp"] a').getAttribute('href'),'#/catalogo-espelho');
  assert.equal(await mapa.locator('[data-raiz-operacional="supplier"] a').count(),0,'não oferece integração não homologada');
  assert.equal(await mapa.locator('.ap-ativo,img').count(),0,'mapa não reutiliza atlas ou imagem genérica');
  assert.equal(await mapa.locator('[data-raiz-operacional="erp"] strong').textContent(),'2','contagem do espelho autenticado simulado');
  assert.equal(await mapa.locator('[data-raiz-operacional="auditor"] strong').count(),0,'sem nota fictícia de auditoria');
  await mapa.locator('[data-raiz-chip="engineering"]').click();
  assert.equal(await mapa.locator('[data-raiz-operacional="engineering"]').getAttribute('data-raiz-relacao'),'ativo');
  assert.equal(await mapa.locator('[data-raiz-operacional="lifecycle"]').getAttribute('data-raiz-relacao'),'origem');
  assert.equal(await mapa.locator('[data-raiz-operacional="taxonomy"]').getAttribute('data-raiz-relacao'),'impacto');
  await mapa.locator('[data-raiz-chip="engineering"]').click();
  await mapa.locator('[data-raiz-operacional="erp"] summary').click();
  await mapa.getByText('identidade_unica — não medido',{exact:true}).waitFor();
  await mapa.locator('[data-raiz-operacional="erp"] summary').click();
  assert.equal(await page.locator('[data-conecta-layout="aprovado-v2"]').count(),1);assert.equal(await page.locator('.topo-premium,.layout-premium,.menu-premium').count(),0,'shell anterior removido');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'início sem overflow '+width);
  await page.screenshot({path:root+`evidencias-conecta-aprovado/inicio-${width}-SIMULADO.png`});
  if(width<781){await page.getByRole('button',{name:'Abrir navegação',exact:true}).click();await page.getByRole('link',{name:'Estúdio do Nano',exact:true}).click();}
  else await page.getByRole('link',{name:'Estúdio do Nano',exact:true}).click();
  await page.locator('[data-nano-layout="aprovado-v2"]').waitFor();await verificarMAPrivado(page,'nano');
  await page.reload();await page.locator('[data-nano-layout="aprovado-v2"]').waitFor();await verificarMAPrivado(page,'nano');const campo=page.getByRole('textbox',{name:'Pergunte',exact:true});await campo.waitFor();
  assert.equal(await page.locator('.estudio-agente,.dock-agente,.balao-genesis').count(),0,'interfaces anteriores não são montadas');assert.equal(await page.locator('.ap-tower').count(),0,'a Torre duplicada não é montada');assert.equal(await page.locator('.ap-work-tabs button').count(),5,'apenas uma navegação de artefatos permanece');if(width<781){assert.equal(await page.locator('.ap-mobile-panes button').count(),3,'Conversa, Trabalho e Ações disponíveis no topo mobile');assert.equal(await page.locator('.ap-chat-panel').evaluate(el=>Math.round(el.getBoundingClientRect().right)),width,'chat usa largura total após remover Torre');}await page.getByRole('button',{name:/Ações do Nano/}).click();await page.getByRole('navigation',{name:'Ações do Nano'}).getByRole('button',{name:'Atualizar dados do espelho'}).waitFor();await page.getByRole('button',{name:/Ações do Nano/}).click();
  await page.evaluate(()=>document.documentElement.setAttribute('data-cor','azul'));assert.equal(await page.locator('.ap-eyebrow').first().evaluate(el=>getComputedStyle(el).color),'rgb(6, 104, 201)','o perfil de cor escolhido chega à interface aprovada '+width);await page.evaluate(()=>document.documentElement.removeAttribute('data-cor'));
  assert.equal(await campo.isVisible(),true,'conversa visível '+width);
  await campo.click();assert.equal(await page.locator('.ap-nano-workspace .olho-nano').count(),0,'Olho flutuante não cobre os controles do chat');
  assert.equal(await page.locator('.ap-chat-panel .agente .nano-robo').count(),0,'o chat não repete o avatar do cabeçalho do sistema');
  assert.equal(await page.locator('.ap-chat-panel .agente-titulo h1').count(),0,'o nome Nano.ia não se repete no cabeçalho do chat');
  await page.locator('.ap-chat-panel .nano-agente-estado').waitFor();assert.ok((await page.locator('.ap-chat-panel .nano-agente-estado').innerText()).length>0,'estado operacional permanece visível');
  if(width>=781){  await page.getByRole('button',{name:'Ajustar chat',exact:true}).click();await page.getByRole('slider',{name:'Altura da conversa'}).focus();await page.keyboard.press('End');
  await page.getByRole('button',{name:'Ajustar chat',exact:true}).click();}
  // celular: o chat ocupa a tela inteira (altura fixa); o ajuste de altura só existe no desktop
  if(width<781)await page.getByRole('button',{name:'Área de trabalho',exact:true}).click();
  await page.locator('.ap-work-tabs button').nth(1).click();await page.getByRole('heading',{name:'Produtos do espelho.',exact:true}).waitFor();
  await page.getByText('Produto sintético para teste',{exact:true}).waitFor({state:'visible'});
  await page.locator('.ap-work-tabs button').nth(2).click();await page.getByText('Nenhuma imagem aprovada disponível.',{exact:true}).waitFor();
  if(width===390){
   await page.locator('.ap-work-tabs button').nth(3).click();
   await page.getByRole('button',{name:'Conferir catálogo público'}).click();
   await page.getByText(/API pública respondeu normalmente/).waitFor();
   assert.equal(await page.locator('.ap-web-preview').count(),1,'prévia Web permanece integrada no Nano');
   await page.getByRole('button',{name:'Atualizar prévia'}).click();
   assert.equal(await page.locator('.ap-web-preview').count(),1,'recarrega a prévia sem duplicar browser');
   assert.equal(await page.getByText(/API pública respondeu normalmente/).count(),0,'atualização limpa o relatório anterior');
  }
  await page.locator('.ap-work-tabs button').nth(0).click();
  if(width<781)await page.getByRole('button',{name:'Conversa',exact:true}).click();
  await campo.fill('ajuda');await campo.press('Enter');await page.waitForFunction(()=>document.querySelectorAll('.ap-chat-panel .bolha,.ap-chat-panel .bolha-linha').length>=3);
  assert.equal(await campo.inputValue(),'');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'Nano sem overflow '+width);
  await page.screenshot({path:root+`evidencias-conecta-aprovado/nano-${width}-SIMULADO.png`});
  await page.goto(base+'#/catalogo-aplicacao');await page.locator('[data-catalogo-layout="aprovado-v2"]').waitFor();await page.getByText('Produto sintético para teste',{exact:true}).waitFor();
  await verificarMAPrivado(page,'painel');
  await page.reload();await page.locator('[data-catalogo-layout="aprovado-v2"]').waitFor();await page.getByText('Produto sintético para teste',{exact:true}).waitFor();await verificarMAPrivado(page,'painel');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'catálogo sem overflow '+width);
  await page.screenshot({path:root+`evidencias-conecta-aprovado/catalogo-${width}-SIMULADO.png`});
  assert.deepEqual(errors,[],'sem erros JavaScript');resultado.push({width,interface:'aprovado-v2',origem:remoto?'publicada':'local',dados:'SIMULADOS',errors});await context.close();console.log('CONECTA/NANO APROVADO '+width+'px OK');
 }
 const context=await browser.newContext({viewport:{width:390,height:900},serviceWorkers:'block'});await preparar(context,false);const page=await context.newPage();await page.goto(base+'#/');await page.locator('[data-acesso-layout="aprovado-v2"]').waitFor();assert.equal(await page.locator('.entrada-portal').count(),0);await page.screenshot({path:root+'evidencias-conecta-aprovado/entrada-390-SIMULADO.png'});await context.close();
}catch(e){if(browser)for(const [i,c] of browser.contexts().entries())for(const [j,p]of c.pages().entries()){await p.screenshot({path:root+`evidencias-conecta-aprovado/falha-${i}-${j}-SIMULADO.png`,fullPage:true}).catch(()=>{});await writeFile(root+`evidencias-conecta-aprovado/falha-${i}-${j}.txt`,await p.locator('body').innerText().catch(()=>''));}throw e;}finally{await browser?.close();servidor?.kill('SIGTERM');await writeFile(root+'evidencias-conecta-aprovado/resultado.json',JSON.stringify(resultado,null,2));}
