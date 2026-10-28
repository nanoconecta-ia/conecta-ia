// Temas e contraste (PC e Android): os 4 temas fixos sem texto abaixo do mínimo WCAG (4,5:1; 3:1 em texto grande), borda de campo >= 3:1,
// seletor de aparência operável por teclado e visível no celular, escolha lembrada. Sessão e rede 100% SINTÉTICAS.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
const root=new URL('../../',import.meta.url).pathname,painel=root+'painel/';
const require=createRequire(painel+'package.json'),{chromium}=require('playwright');
const porta=4193,base=`http://127.0.0.1:${porta}`,REF='dsfzhsrudriqkumtlqwj';
const servidor=spawn(process.execPath,[painel+'node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(porta)],{cwd:painel,stdio:'ignore'});
// roda DENTRO da página: texto renderizado x fundo efetivo (cores sólidas; fundo com imagem/degradê é ignorado)
const AUDITORIA=()=>{
  const num=(s)=>{let m=s.match(/rgba?\(([^)]+)\)/);if(m){const p=m[1].split(/[ ,\/]+/).filter(Boolean).map(Number);return {r:p[0],g:p[1],b:p[2],a:p[3]??1}}m=s.match(/color\(srgb ([^)]+)\)/);if(m){const p=m[1].split(/[ \/]+/).filter(Boolean).map(Number);return {r:p[0]*255,g:p[1]*255,b:p[2]*255,a:p[3]??1}}return null};
  const lum=({r,g,b})=>{const f=v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)};return .2126*f(r)+.7152*f(g)+.0722*f(b)};
  const rat=(a,b)=>{const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
  const mix=(f,b)=>({r:f.r*f.a+b.r*(1-f.a),g:f.g*f.a+b.g*(1-f.a),b:f.b*f.a+b.b*(1-f.a),a:1});
  const bgDe=(el)=>{const camadas=[];for(let e=el;e;e=e.parentElement){const cs=getComputedStyle(e);if(cs.backgroundImage&&cs.backgroundImage!=='none')return null;const c=num(cs.backgroundColor);if(c&&c.a>0){camadas.push(c);if(c.a>=.99)break}}let b={r:255,g:255,b:255,a:1};for(const c of camadas.reverse())b=mix(c,b);return b};
  const falhas=[];let n=0;
  for(const el of document.body.querySelectorAll('*')){
    if(!el.offsetParent&&getComputedStyle(el).position!=='fixed')continue;
    if(![...el.childNodes].some(x=>x.nodeType===3&&x.textContent.trim().length>0))continue;
    const cs=getComputedStyle(el);if(cs.visibility==='hidden'||cs.opacity==='0')continue;
    const fg=num(cs.color),bg=bgDe(el);if(!fg||!bg)continue;n++;
    const r=rat(mix(fg,bg),bg),px=parseFloat(cs.fontSize),grande=px>=24||(px>=18.66&&parseInt(cs.fontWeight)>=700),min=grande?3:4.5;
    if(r<min)falhas.push(`${el.tagName.toLowerCase()}.${String(el.className).trim().split(/\s+/)[0]} "${el.textContent.trim().slice(0,24)}" ${r.toFixed(2)}:1`);
  }
  return {n,falhas};
};
const BORDA_CAMPO=()=>{
  const num=(s)=>{let m=s.match(/rgba?\(([^)]+)\)/);if(m){const p=m[1].split(/[ ,\/]+/).filter(Boolean).map(Number);return {r:p[0],g:p[1],b:p[2]}}m=s.match(/color\(srgb ([^)]+)\)/);if(m){const p=m[1].split(/[ \/]+/).filter(Boolean).map(Number);return {r:p[0]*255,g:p[1]*255,b:p[2]*255}}return null};
  const lum=({r,g,b})=>{const f=v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)};return .2126*f(r)+.7152*f(g)+.0722*f(b)};
  const rat=(a,b)=>{const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
  const out=[];
  for(const el of document.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=file]),textarea,select')){
    if(!el.offsetParent)continue;const cs=getComputedStyle(el);let fundo=null;for(let e=el.parentElement;e&&!fundo;e=e.parentElement){const c=num(getComputedStyle(e).backgroundColor);if(c&&!/ 0\)|\/ 0\)/.test(getComputedStyle(e).backgroundColor)&&getComputedStyle(e).backgroundColor!=='rgba(0, 0, 0, 0)')fundo=c}
    const b=num(cs.borderTopColor);if(b&&fundo)out.push(+rat(b,fundo).toFixed(2));
  }
  return out;
};
const rotas=['#/integracoes','#/assistente','#/design'];
let browser;
try{
 for(let i=0;i<100;i++){try{if((await fetch(base+'/')).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
 browser=await chromium.launch({headless:true});
 const sessao={access_token:'sintetico.sintetico.sintetico',refresh_token:'sintetico',token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user:{id:'11111111-1111-1111-1111-111111111111',aud:'authenticated',role:'authenticated',email:'demo@exemplo.invalid',app_metadata:{},user_metadata:{},created_at:'2026-01-01T00:00:00Z'}};
 const novoContexto=async(w,h,tema)=>{
  const ctx=await browser.newContext({viewport:{width:w,height:h}});const page=await ctx.newPage();const erros=[];page.on('pageerror',e=>erros.push(e.message));
  await page.addInitScript(([k,v,t])=>{localStorage.setItem(k,v);if(t)localStorage.setItem('conecta:tema',t)},[`sb-${REF}-auth-token`,JSON.stringify(sessao),tema]);
  await page.route('**/*',async route=>{const u=new URL(route.request().url());if(u.hostname==='127.0.0.1')return route.continue();
   if(!u.hostname.endsWith('supabase.co'))throw Error('Rede não permitida no teste: '+u.hostname);
   const hd={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'};
   if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers:hd});
   if(u.pathname.endsWith('/rest/v1/lojas'))return route.fulfill({status:200,contentType:'application/json',headers:hd,body:JSON.stringify([{id:'aaaaaaaa-0000-0000-0000-000000000001',nome:'Loja DEMO',slug:'loja-demo',modo_venda:'whatsapp',ambiente:'teste',perfil_ramo:null}])});
   if(u.pathname.endsWith('/functions/v1/assistente')){const a=JSON.parse(route.request().postData()||'{}').acao;return route.fulfill({status:200,contentType:'application/json',headers:hd,body:JSON.stringify(a==='provedores'?{verificado:true,provedores:[]}:a==='chat_config'?{persistente:false,bling:false,leitura_administrativa:false,retencao_dias:180}:{conversas:[],registros:[]})})}
   if(u.pathname.endsWith('/auth/v1/user'))return route.fulfill({status:200,contentType:'application/json',headers:hd,body:JSON.stringify(sessao.user)});
   return route.fulfill({status:200,contentType:'application/json',headers:hd,body:u.pathname.includes('/rest/v1/')?'[]':'{}'})});
  return {ctx,page,erros};
 };
 const problemas=[];
 for(const tema of ['claro','escuro','noturno','contraste'])for(const [w,h,nome] of [[1440,900,'PC'],[390,844,'Android']]){
  const {ctx,page,erros}=await novoContexto(w,h,tema);
  for(const r of rotas){
   await page.goto(base+'/'+r);await page.waitForTimeout(700);
   assert.equal(await page.evaluate(()=>document.documentElement.dataset.tema),tema);
   if(r==='#/design'){await page.getByRole('button',{name:/^Aparência:/}).click();await page.waitForTimeout(150)} // com a lista de aparência aberta
   const a=await page.evaluate(AUDITORIA);
   if(r==='#/design')await page.keyboard.press('Escape');
   if(a.falhas.length)problemas.push(`${tema}/${nome}/${r}: ${a.falhas.length} texto(s) abaixo do mínimo: ${a.falhas.slice(0,3).join('; ')}`);
   if(r==='#/integracoes'){const bs=await page.evaluate(BORDA_CAMPO);if(!bs.length)problemas.push(`${tema}/${nome}: nenhum campo encontrado para medir a borda`);else if(Math.min(...bs)<3)problemas.push(`${tema}/${nome}: borda de campo ${Math.min(...bs)}:1 (< 3:1)`);}
   if(!(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)))problemas.push(`${tema}/${nome}/${r}: rolagem horizontal`);
  }
  if(erros.length)problemas.push(`${tema}/${nome}: erros de página ${erros[0]}`);
  await ctx.close();
 }
 assert.deepEqual(problemas,[],'contraste/tema:\n'+problemas.join('\n'));
 // seletor de aparência: visível no celular, por teclado, escolha lembrada
 for(const [w,h,nome] of [[1440,900,'PC'],[390,844,'Android']]){
  const {ctx,page,erros}=await novoContexto(w,h,null);
  await page.goto(base+'/#/design');
  const gat=page.getByRole('button',{name:/^Aparência:/});await gat.waitFor();
  const gb=await gat.boundingBox();assert.ok(gb.width>=44&&gb.height>=44&&gb.x>=0&&gb.x+gb.width<=w,`${nome}: botão de aparência visível e tocável`);
  await gat.focus();await page.keyboard.press('Enter');
  const grupo=page.getByRole('radiogroup',{name:'Aparência'});await grupo.waitFor();
  assert.equal(await grupo.getByRole('radio').count(),5,`${nome}: 5 opções`);
  const pb=await grupo.boundingBox();assert.ok(pb.x>=0&&pb.x+pb.width<=w+0.5&&pb.y+pb.height<=h,`${nome}: lista dentro da tela ${JSON.stringify(pb)}`);
  assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('role')),'radio','foco vai para a opção atual');
  await page.keyboard.press('End');assert.match(await page.evaluate(()=>document.activeElement.textContent),/Alto contraste/);
  await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(()=>document.documentElement.dataset.tema),'contraste');
  assert.equal(await page.evaluate(()=>localStorage.getItem('conecta:tema')),'contraste');
  assert.equal(await grupo.count(),0,'fecha ao escolher');assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('aria-haspopup')),'true','foco volta ao botão');
  await page.reload();await page.waitForTimeout(400);assert.equal(await page.evaluate(()=>document.documentElement.dataset.tema),'contraste','escolha lembrada');
  await page.getByRole('button',{name:/^Aparência:/}).click();await page.keyboard.press('Escape');assert.equal(await page.getByRole('radiogroup').count(),0,'Esc fecha');
  await page.getByRole('button',{name:/^Aparência:/}).click();await page.getByRole('radio',{name:/Automático/}).click();
  assert.equal(await page.evaluate(()=>document.documentElement.hasAttribute('data-tema')),false,'automático não escreve atributo');
  assert.deepEqual(erros,[]);await ctx.close();
 }
 console.log('temas-visual ok (4 temas x PC e Android x 3 telas: texto >= WCAG AA, borda de campo >= 3:1; seletor por teclado, visível no celular e lembrado)');
}finally{await browser?.close();servidor.kill()}
