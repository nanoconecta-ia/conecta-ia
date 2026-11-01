// Perfis de cor: o painel e a esfera do Nano.IA seguem o MESMO perfil. App, sessão e rede 100% SINTÉTICOS.
// Para cada perfil e cada tema: o atributo data-cor vale, --marca e --orbe-a vêm do perfil e a esfera pintada tem matiz próximo ao do acento.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
const root=new URL('../../',import.meta.url).pathname,painel=root+'painel/';
const require=createRequire(painel+'package.json'),{chromium}=require('playwright');
const {PERFIS,PADRAO,gerar}=await import(painel+'src/lib/perfisCorGerador.ts');
const porta=4193,base=`http://127.0.0.1:${porta}`;
const REF='dsfzhsrudriqkumtlqwj',saida=process.env.SAIDA||root+'docs/evidencias/perfis-cor/';await (await import('node:fs/promises')).mkdir(saida,{recursive:true});
const servidor=spawn(process.execPath,[painel+'node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(porta)],{cwd:painel,stdio:'ignore'});
const matiz=([r,g,b])=>{r/=255;g/=255;b/=255;const m=Math.max(r,g,b),n=Math.min(r,g,b),d=m-n;if(!d)return null;let h=m===r?((g-b)/d)%6:m===g?(b-r)/d+2:(r-g)/d+4;return (h*60+360)%360};
const dif=(a,b)=>{const d=Math.abs(a-b)%360;return d>180?360-d:d};
let browser;
try{
 for(let i=0;i<100;i++){try{if((await fetch(base+'/')).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
 browser=await chromium.launch({headless:true});
 const sessao={access_token:'sintetico.sintetico.sintetico',refresh_token:'sintetico',token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user:{id:'11111111-1111-1111-1111-111111111111',aud:'authenticated',role:'authenticated',email:'demo@exemplo.invalid',app_metadata:{},user_metadata:{},created_at:'2026-01-01T00:00:00Z'}};
 for(const tema of ['claro','escuro']){
  for(const p of PERFIS){
   const context=await browser.newContext({viewport:{width:1280,height:800}});
   const page=await context.newPage(),erros=[];
   page.on('pageerror',e=>erros.push(e.message));
   await page.addInitScript(([k,v,t,c])=>{localStorage.setItem(k,v);localStorage.setItem('conecta:tema',t);localStorage.setItem('conecta:cor',c)},[`sb-${REF}-auth-token`,JSON.stringify(sessao),tema,p.id]);
   await page.route('**/*',async route=>{
    const u=new URL(route.request().url());
    if(u.hostname==='127.0.0.1')return route.continue();
    if(!u.hostname.endsWith('supabase.co'))throw Error('Rede não permitida no teste: '+u.hostname);
    const h={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'};
    if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers:h});
    if(u.pathname.endsWith('/rest/v1/lojas'))return route.fulfill({status:200,contentType:'application/json',headers:h,body:JSON.stringify([{id:'aaaaaaaa-0000-0000-0000-000000000001',nome:'Loja DEMO',slug:'loja-demo',modo_venda:'whatsapp',ambiente:'teste',perfil_ramo:null}])});
    if(u.pathname.endsWith('/functions/v1/assistente')){const acao=JSON.parse(route.request().postData()||'{}').acao;return route.fulfill({status:200,contentType:'application/json',headers:h,body:JSON.stringify(acao==='provedores'?{verificado:true,provedores:[]}:acao==='chat_config'?{persistente:false,bling:false,leitura_administrativa:false,retencao_dias:180}:{conversas:[],registros:[]})})}
    if(u.pathname.endsWith('/auth/v1/user'))return route.fulfill({status:200,contentType:'application/json',headers:h,body:JSON.stringify(sessao.user)});
    return route.fulfill({status:200,contentType:'application/json',headers:h,body:u.pathname.includes('/rest/v1/')?'[]':'{}'});
   });
   await page.goto(`${base}/#/assistente`);
   const orbe=page.locator('.orbe').first();await orbe.waitFor();await page.waitForTimeout(500);
   const dc=await page.evaluate(()=>document.documentElement.getAttribute('data-cor'));
   assert.equal(dc,p.id===PADRAO?null:p.id,`${p.id}: data-cor`);
   const v=await page.evaluate(()=>{const s=getComputedStyle(document.documentElement);return {marca:s.getPropertyValue('--marca').trim().toUpperCase(),a:s.getPropertyValue('--orbe-a').trim().toUpperCase()}});
   const g=gerar(p),esperadoMarca=(tema==='escuro'?g.escuro:g.claro)['--marca'].toUpperCase();
   if(p.id!==PADRAO)assert.equal(v.marca,esperadoMarca,`${p.id}/${tema}: --marca do perfil`);else assert.match(v.marca,/^#[0-9A-F]{6}$/,"padrão: --marca do styles.css");
   assert.equal(v.a,g.orbe['--orbe-a'].toUpperCase(),`${p.id}/${tema}: --orbe-a do perfil`);
   // A esfera pintada: matiz dominante dos pixels saturados próximo ao do acento (neutros não têm matiz: só conferem que a esfera não ficou colorida).
   const png=await orbe.screenshot({omitBackground:false});
   const px=await page.evaluate(async b64=>{const img=new Image();img.src='data:image/png;base64,'+b64;await img.decode();const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const x=c.getContext('2d');x.drawImage(img,0,0);const d=x.getImageData(0,0,c.width,c.height).data;const o=[];for(let i=0;i<d.length;i+=4)o.push([d[i],d[i+1],d[i+2]]);return o},png.toString('base64'));
   const sat=px.filter(([r,g,b])=>Math.max(r,g,b)>90&&(Math.max(r,g,b)-Math.min(r,g,b))/Math.max(r,g,b)>0.35);
   if(p.neutro){assert.ok(sat.length<px.length*0.05,`${p.id}/${tema}: esfera neutra não pode ter cor viva (${sat.length}/${px.length})`)}
   else{
    assert.ok(sat.length>px.length*0.02,`${p.id}/${tema}: esfera tem cor (${sat.length}/${px.length})`);
    const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
    const hm=matiz(rgb(g.orbe['--orbe-a'])),hb=matiz(rgb(g.orbe['--orbe-b']));
    const medias=sat.map(matiz).filter(h=>h!==null);
    const perto=medias.filter(h=>dif(h,hm)<=45||dif(h,hb)<=45).length/medias.length;
    assert.ok(perto>=0.8,`${p.id}/${tema}: ${Math.round(perto*100)}% dos pixels vivos da esfera estão no matiz do perfil (mín. 80%)`);
   }
   assert.deepEqual(erros,[],`${p.id}: erros de página`);
   if(tema==='claro'&&['terracota','verde','cinza','branco'].includes(p.id))await page.screenshot({path:`${saida}${p.id}-${tema}.png`});
   await context.close();
  }
 }
 console.log(`ok: ${PERFIS.length} perfis x 2 temas: painel e esfera seguem o mesmo perfil`);
}finally{await browser?.close();servidor.kill()}
