// Editor de banner (Konva) no componente REAL, com navegador. Foto SINTÉTICA gerada aqui (engrenagem de 26 dentes desenhada por código; não é peça real).
// Prova: (1) a região da peça no PNG exportado é IDÊNTICA, pixel a pixel, ao original; (2) arrastar texto sobre a peça e ampliar demais bloqueiam e
// desabilitam o download; (3) 'Ajustar para caber inteira' desbloqueia; (4) sem rede, sem escrita fora do navegador. Capturas em docs/evidencias/editor-banner/.
import { createRequire } from 'node:module';
import { writeFile, rm, mkdir, readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { deflateSync, inflateSync } from 'node:zlib';
import assert from 'node:assert/strict';
const root=new URL('../../',import.meta.url).pathname,painel=root+'painel/';
const require=createRequire(painel+'package.json'),{chromium}=require('playwright');
const fixture=painel+'.editor-demo.html',porta=4190,saida=process.env.SAIDA||root+'docs/evidencias/editor-banner/';
await mkdir(saida,{recursive:true});

// ── PNG mínimo (RGBA 8 bits) sem dependências
const crcT=(()=>{const t=[];for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;t[n]=c>>>0}return t})();
const crc=b=>{let c=0xffffffff;for(const x of b)c=crcT[(c^x)&255]^(c>>>8);return (c^0xffffffff)>>>0};
const chunk=(t,d)=>{const l=Buffer.alloc(4);l.writeUInt32BE(d.length);const td=Buffer.concat([Buffer.from(t),d]);const c=Buffer.alloc(4);c.writeUInt32BE(crc(td));return Buffer.concat([l,td,c])};
const png=(w,h,rgba)=>{const raw=Buffer.alloc((w*4+1)*h);for(let y=0;y<h;y++){raw[y*(w*4+1)]=0;rgba.copy(raw,y*(w*4+1)+1,y*w*4,(y+1)*w*4)}const ih=Buffer.alloc(13);ih.writeUInt32BE(w,0);ih.writeUInt32BE(h,4);ih[8]=8;ih[9]=6;return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ih),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))])};
function decodificar(buf){let p=8,w=0,h=0,tipo=6;const idat=[];while(p<buf.length){const l=buf.readUInt32BE(p),t=buf.toString('latin1',p+4,p+8),d=buf.subarray(p+8,p+8+l);if(t==='IHDR'){w=d.readUInt32BE(0);h=d.readUInt32BE(4);tipo=d[9]}if(t==='IDAT')idat.push(d);p+=12+l}
 const bpp=tipo===6?4:3,raw=inflateSync(Buffer.concat(idat)),out=Buffer.alloc(w*h*4),linha=w*bpp;let prev=Buffer.alloc(linha);
 for(let y=0;y<h;y++){const f=raw[y*(linha+1)],cur=Buffer.from(raw.subarray(y*(linha+1)+1,(y+1)*(linha+1)));
  for(let i=0;i<linha;i++){const a=i>=bpp?cur[i-bpp]:0,b=prev[i],c=i>=bpp?prev[i-bpp]:0;let v=cur[i];
   if(f===1)v+=a;else if(f===2)v+=b;else if(f===3)v+=(a+b)>>1;else if(f===4){const pp=a+b-c,pa=Math.abs(pp-a),pb=Math.abs(pp-b),pc=Math.abs(pp-c);v+=(pa<=pb&&pa<=pc)?a:(pb<=pc?b:c)}cur[i]=v&255}
  for(let x=0;x<w;x++){out[(y*w+x)*4]=cur[x*bpp];out[(y*w+x)*4+1]=cur[x*bpp+1];out[(y*w+x)*4+2]=cur[x*bpp+2];out[(y*w+x)*4+3]=bpp===4?cur[x*bpp+3]:255}prev=cur}
 return {w,h,px:out}}
// Engrenagem sintética de 26 dentes, 600x600, com furo central e um "furo de fixação" assimétrico (assim espelhar ou girar mudaria os pixels).
function engrenagem(N=600){const px=Buffer.alloc(N*N*4);for(let y=0;y<N;y++)for(let x=0;x<N;x++){const dx=x-N/2+.5,dy=y-N/2+.5,r=Math.hypot(dx,dy),ang=Math.atan2(dy,dx);const dente=(Math.cos(ang*26)>0)?255:215;const raio=Math.cos(ang*26)>0?280:250;let cor=[0,0,0,0];
  if(r<=raio&&r>=60){cor=[70+(dente-215)*2%120,80,95,255]}if(Math.hypot(dx-120,dy+40)<22)cor=[0,0,0,0];if(Math.hypot(dx,dy)<60)cor=[0,0,0,0];
  const i=(y*N+x)*4;px[i]=cor[0];px[i+1]=cor[1];px[i+2]=cor[2];px[i+3]=cor[3]}return png(N,N,px)}
const FOTO=engrenagem(),ORIG=decodificar(FOTO);
await writeFile(fixture,`<html lang="pt-BR"><meta name="viewport" content="width=device-width, initial-scale=1.0"><div id="root"></div><script type="module">import React from 'react';import {createRoot} from 'react-dom/client';import {Imagens} from '/src/paginas/Imagens.tsx';import '/src/styles.css';import '/src/shell.css';createRoot(document.getElementById('root')).render(React.createElement('main',{style:{padding:12}},React.createElement(Imagens,{loja:{id:'aaaaaaaa-0000-0000-0000-000000000001',nome:'Loja Teste'}})));</script></html>`);
const servidor=spawn(process.execPath,[painel+'node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(porta)],{cwd:painel,stdio:'ignore'});
let browser;
try{
 for(let i=0;i<100;i++){try{if((await fetch(`http://127.0.0.1:${porta}/.editor-demo.html`)).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
 browser=await chromium.launch({headless:true});
 for(const [rotulo,largura,altura] of [['desktop',1280,1000],['celular',390,900]]){
  const ctx=await browser.newContext({viewport:{width:largura,height:altura},acceptDownloads:true}),page=await ctx.newPage(),erros=[],externas=[];
  page.on('pageerror',e=>erros.push(e.message));
  await page.route('**/*',r=>{const u=new URL(r.request().url());if(u.hostname!=='127.0.0.1'){externas.push(u.hostname);return r.abort()}return r.continue()});
  await page.goto(`http://127.0.0.1:${porta}/.editor-demo.html`);
  await page.locator('input[type=file]').setInputFiles({name:'engrenagem-sintetica.png',mimeType:'image/png',buffer:FOTO});
  await page.getByLabel('SKU do cadastro').fill('FIX-001');
  const palco=page.locator('.eb-palco canvas').first();await palco.waitFor();
  await page.getByText('Composição válida').waitFor();
  assert.equal(await page.getByRole('alert').filter({hasText:'Bloqueado'}).count(),0,'estado inicial sem bloqueios');
  const medir=async()=>{await page.locator('.eb-palco').scrollIntoViewIfNeeded();const c=await page.locator('.eb-palco').boundingBox();return {c,k:c.width/1200}};
  await page.screenshot({path:`${saida}editor-inicial-${rotulo}.png`,fullPage:true});

  // 1) Prévia exportada: a região da peça é idêntica ao original, pixel a pixel (escala 100 %, posição inteira)
  const [dl]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Baixar prévia (rascunho)'}).click()]);
  const arq=saida+`previa-${rotulo}.png`;await dl.saveAs(arq);const exp=decodificar(await readFile(arq));
  assert.equal(exp.w,1200);assert.equal(exp.h,1200);
  let difs=0,comparados=0;const ox=300,oy=324;
  for(let y=0;y<600;y++)for(let x=0;x<600;x++){const a=(y*600+x)*4,b=((oy+y)*1200+(ox+x))*4;if(ORIG.px[a+3]===0)continue;comparados++;for(let c=0;c<3;c++)if(Math.abs(ORIG.px[a+c]-exp.px[b+c])>1)difs++}
  assert.ok(comparados>100000,'comparou os pixels opacos da peça');
  assert.equal(difs,0,`pixels da peça diferentes do original: ${difs}`);

  // 2) Arrastar o título para cima da peça: bloqueia e desabilita o download
  let {c:caixa,k}=await medir();let xi=caixa.x+600*k,yTitulo=caixa.y+124*k,yPeca=caixa.y+620*k;
  await page.mouse.move(xi,yTitulo);await page.mouse.down();await page.mouse.move(xi,(yTitulo+yPeca)/2,{steps:6});await page.mouse.move(xi,yPeca,{steps:6});await page.mouse.up();
  await page.getByRole('alert').filter({hasText:'Bloqueado'}).waitFor();
  assert.match(await page.getByRole('alert').first().innerText(),/cobrindo a peça/);
  assert.equal(await page.getByRole('button',{name:'Baixar prévia (rascunho)'}).isDisabled(),true,'sem download enquanto bloqueado');
  await page.screenshot({path:`${saida}bloqueio-texto-sobre-peca-${rotulo}.png`,fullPage:true});
  await page.getByLabel('Título (nome como no cadastro)').fill('Bomba'); // editar o texto não resolve a posição
  assert.equal(await page.getByRole('button',{name:'Baixar prévia (rascunho)'}).isDisabled(),true);

  // 3) Texto com preço ou dado técnico sem origem
  ({c:caixa,k}=await medir());xi=caixa.x+600*k;yTitulo=caixa.y+124*k;yPeca=caixa.y+620*k;
  await page.mouse.move(xi,yPeca);await page.mouse.down();await page.mouse.move(xi,yTitulo,{steps:12});await page.mouse.up();
  await page.getByLabel('Título (nome como no cadastro)').fill('26 dentes R$ 99,90');
  await page.getByRole('alert').filter({hasText:'Bloqueado'}).waitFor();
  assert.match(await page.getByRole('alert').first().innerText(),/dado técnico|preço/i);
  await page.getByLabel('Título (nome como no cadastro)').fill('Bomba de óleo');

  // 4) Ampliar demais: a peça sai da área segura; 'Ajustar para caber inteira' resolve
  await page.getByLabel('Tamanho da peça, proporcional').fill('300');
  await page.getByRole('alert').filter({hasText:'Bloqueado'}).waitFor();
  assert.match(await page.getByRole('alert').first().innerText(),/não cabe inteira/);
  await page.screenshot({path:`${saida}bloqueio-peca-grande-${rotulo}.png`,fullPage:true});
  await page.getByRole('button',{name:'Ajustar para caber inteira'}).click();
  await page.getByText('Composição válida').waitFor();

  // 5) Aprovação local: sem provas não aprova; com tudo, libera o PNG final; editar depois invalida
  await page.locator('summary',{hasText:'Aprovar para baixar'}).click();
  assert.equal(await page.getByRole('button',{name:'Aprovar esta versão'}).isDisabled(),true);
  assert.equal(await page.getByRole('button',{name:'Baixar PNG final'}).isDisabled(),true);
  await page.getByLabel('Código do fabricante').fill('FAB-123');await page.getByLabel('Evidência (URL ou documento)').fill('catalogo-fabricante.pdf p.12');await page.getByLabel('Data da evidência').fill('2026-11-01');
  await page.getByLabel(/Confirmo que esta foto é desta peça/).check();await page.getByLabel(/Tenho o direito de usar esta foto/).check();
  for(const c of ['Furos, bordas e proporções iguais ao original','Conectores e encaixes iguais','Inscrições, marcas e gravações legíveis e iguais'])await page.locator('.editor-banner').getByLabel(c).check();
  await page.getByRole('button',{name:'Aprovar esta versão'}).click();
  await page.getByRole('button',{name:'Versão aprovada'}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Baixar PNG final'}).isDisabled(),false);
  await page.screenshot({path:`${saida}aprovado-${rotulo}.png`,fullPage:true});
  await page.getByRole('button',{name:'Mover a peça para a direita'}).click();
  await page.getByRole('button',{name:'Aprovar esta versão'}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Baixar PNG final'}).isDisabled(),true,'editar depois de aprovar invalida a aprovação');

  // 6) Rascunho local só guarda a composição (sem bytes de imagem) e nada vai para a rede
  const guardado=await page.evaluate(()=>Object.entries(localStorage).filter(([k])=>k.startsWith('conecta:banner-rascunho')).map(([,v])=>v).join(''));
  assert.ok(guardado.includes('"sha256"')&&!/data:image|base64|blob:/.test(guardado),'rascunho sem bytes de imagem');
  assert.deepEqual(externas,[],'nenhuma chamada de rede externa');assert.deepEqual(erros,[]);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true,'sem rolagem horizontal em '+rotulo);
  await ctx.close();
 }
 console.log('editor-banner-visual ok (peça idêntica pixel a pixel, bloqueios, aprovação local, desktop e celular)');
}finally{await browser?.close();servidor.kill();await rm(fixture,{force:true})}
