// Geração real de pixels no navegador, sem chamar APIs/ERP. Foto sintética e cópia nova 1200x1200.
import { createRequire } from "node:module";
import { writeFile, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
const root=new URL("../../",import.meta.url).pathname, painel=root+"painel/";
const require=createRequire(painel+"package.json"),{chromium}=require("playwright");
const fixture=painel+".foto-branca-demo.html",porta=4196,base="http://127.0.0.1:"+porta;
await writeFile(fixture,`<!doctype html><html lang="pt-BR"><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script type="module">import React,{useState} from 'react';import {createRoot} from 'react-dom/client';import {PreviaBranca} from '/src/componentes/PreviaBranca.tsx';import '/src/styles.css';import '/src/shell.css';function App(){const [f,setF]=useState(null);return React.createElement('main',null,React.createElement('input',{type:'file',accept:'image/png',onChange:e=>setF(e.target.files[0])}),f&&React.createElement(PreviaBranca,{arquivo:f}))}createRoot(document.querySelector('#root')).render(React.createElement(App));</script></html>`);
const servidor=spawn(process.execPath,[painel+"node_modules/vite/bin/vite.js","--host","127.0.0.1","--port",String(porta)],{cwd:painel,stdio:"ignore"});let browser;
try{
 for(let i=0;i<80;i++){try{if((await fetch(base+"/.foto-branca-demo.html")).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
 browser=await chromium.launch({headless:true});
 for(const largura of [390,1280]){
   const page=await browser.newPage({viewport:{width:largura,height:830}});
   page.on("request",req=>{ if(new URL(req.url()).hostname!=="127.0.0.1")throw Error("Rede externa não permitida");});
   await page.goto(base+"/.foto-branca-demo.html");
   const png=await page.evaluate(async()=>{
     const c=document.createElement("canvas");c.width=320;c.height=160;
     const x=c.getContext("2d");x.fillStyle="#dc143c";x.fillRect(0,0,320,160);
     const b=await new Promise(r=>c.toBlob(r,"image/png"));return Array.from(new Uint8Array(await b.arrayBuffer()));
   });
   await page.locator('input[type=file]').setInputFiles({name:"CI000016-demo.png",mimeType:"image/png",buffer:Buffer.from(png)});
   await page.getByRole("link",{name:"Baixar somente a cópia com fundo branco"}).waitFor();
   const info=await page.evaluate(async()=>{
     const link=document.querySelector(".vf-baixar");
     const blob=await (await fetch(link.href)).blob();const img=await createImageBitmap(blob);
     const c=document.createElement("canvas");c.width=img.width;c.height=img.height;const x=c.getContext("2d");x.drawImage(img,0,0);
     const px=(a,b)=>[...x.getImageData(a,b,1,1).data].slice(0,3);
     const foto=document.querySelector('.vf-foto-bloco img');
     return {lado:img.width,altura:img.height,branco:px(0,0),centro:px(600,600),nome:link.download,
       original:foto?.getAttribute('src'),quantidade:document.querySelectorAll(".vf-foto-bloco").length};
   });
   assert.equal(info.lado,1200);assert.equal(info.altura,1200);
   assert.ok(info.branco.every(x=>x>=250),"margem branca no pixel 0,0");
   assert.ok(info.centro[0]>160&&info.centro[1]<80,"peça vermelha no centro, sem perda");
   assert.equal(info.nome,"CI000016-demo-fundo-branco-1200x1200.jpg");
   assert.equal(info.quantidade,2);
   assert.ok(info.original.startsWith("blob:"),"original continua em object URL local");
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false,"sem overflow no mobile");
   await page.close();
 }
 console.log("fundo-branco-visual ok: pixels reais 1200x1200, cantos brancos, original intacto, mobile/desktop");
}finally{await browser?.close();servidor.kill("SIGTERM");await rm(fixture,{force:true})}
