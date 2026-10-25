// O painel precisa ser instalável no celular: manifesto válido, ícones existentes, service worker ativo e o Chrome sem erros de instalação.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
const root=new URL('../../',import.meta.url).pathname,painel=root+'painel/';
const require=createRequire(painel+'package.json'),{chromium}=require('playwright');
const porta=4186,base=`http://127.0.0.1:${porta}`;
const servidor=spawn(process.execPath,[painel+'node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port',String(porta),'--strictPort'],{cwd:painel,stdio:'ignore'});
let browser;
try{
 for(let i=0;i<100;i++){try{if((await fetch(base+'/')).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
 const m=await (await fetch(base+'/manifest.webmanifest')).json();
 for(const k of ['name','short_name','start_url','scope','display','background_color','theme_color'])assert.ok(m[k],'manifesto sem '+k);
 assert.equal(m.display,'standalone');
 const tam=new Set(m.icons.map(i=>i.sizes));assert.ok(tam.has('192x192')&&tam.has('512x512'),'ícones 192 e 512');
 assert.ok(m.icons.some(i=>i.purpose==='maskable'),'ícone maskable');
 for(const i of m.icons){const r=await fetch(new URL(i.src,base+'/manifest.webmanifest'));assert.equal(r.status,200,'ícone '+i.src);assert.equal(r.headers.get('content-type'),'image/png');}
 assert.equal((await fetch(base+'/sw.js')).status,200,'service worker');
 browser=await chromium.launch();
 const ctx=await browser.newContext({viewport:{width:390,height:844}});const page=await ctx.newPage();
 await page.goto(base+'/');
 assert.ok(await page.locator('link[rel=manifest]').count(),'link do manifesto no HTML');
 await page.evaluate(()=>navigator.serviceWorker.ready);
 const cdp=await ctx.newCDPSession(page);
 const { installabilityErrors }=await cdp.send('Page.getInstallabilityErrors');
 assert.deepEqual(installabilityErrors,[],'o Chrome ainda aponta erros de instalação: '+JSON.stringify(installabilityErrors));
 console.log('pwa-instalavel ok (manifesto, ícones 192/512/maskable, service worker e Chrome sem erros de instalação)');
}finally{await browser?.close();servidor.kill()}
