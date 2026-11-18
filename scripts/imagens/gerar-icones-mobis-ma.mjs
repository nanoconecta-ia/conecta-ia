/** Gerador offline dos ícones MA para favicon, iOS e PWA.
 * Sem serviços, fontes, libs ou fotos externas. Executado antes do build Vite.
 * A geometria é uma reconstrução vetorial do guia da marca; conferir com arquivo-mestre.
 */
import { deflateSync } from "node:zlib";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";

const destino=resolve(dirname(fileURLToPath(import.meta.url)),"../../painel/public");
const polyBranco=[[16,72],[30,28],[38,20],[51,20],[61,33],[49,47],[43,35],[40,34],[29,72]];
const polyVermelho=[[39,72],[62,19],[81,19],[67,72],[54,72],[65,42],[51,72]];
const limitar=(n,a,b)=>Math.max(a,Math.min(b,n));
function pontoPoligono(x,y,p){
 let dentro=false;
 for(let i=0,j=p.length-1;i<p.length;j=i++){
  const [xi,yi]=p[i],[xj,yj]=p[j];
  if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)dentro=!dentro;
 }
 return dentro;
}
function arredondado(x,y,x0,y0,x1,y1,r){
 if(x<x0||x>=x1||y<y0||y>=y1)return false;
 const cx=limitar(x,x0+r,x1-r),cy=limitar(y,y0+r,y1-r);
 return (x-cx)**2+(y-cy)**2<=r*r;
}
function cor(u,v,mascara=false){
 let x=u,y=v;
 if(mascara){
  // Fundo sangrado e símbolo dentro da zona segura (~80%).
  x=(u-48)/0.79+48;y=(v-48)/0.79+48;
 }
 let rgba=[0,0,0,0];
 if(mascara)rgba=[31,35,39,255];
 if(!arredondado(x,y,1,1,95,95,20))return rgba;
 rgba=[180+Math.round(55*(1-y/96)),183+Math.round(51*(1-y/96)),187+Math.round(50*(1-y/96)),255];
 if(arredondado(x,y,5,5,91,91,17))rgba=[13,15,18,255];
 if(arredondado(x,y,8,8,88,88,15)&&!arredondado(x,y,9.7,9.7,86.3,86.3,13.3))rgba=[194,199,203,255];
 if(pontoPoligono(x,y,polyBranco)){
  const t=limitar((y-20)/52,0,1);
  rgba=[Math.round(255-45*t),Math.round(255-39*t),Math.round(255-35*t),255];
 }
 if(pontoPoligono(x,y,polyVermelho)){
  const t=limitar((x+y-60)/80,0,1);
  rgba=[Math.round(255-29*t),Math.round(52-28*t),Math.round(55-29*t),255];
 }
 return rgba;
}
const tabela=Array.from({length:256},(_,n)=>{
 let v=n;for(let i=0;i<8;i++)v=v&1?0xedb88320^(v>>>1):v>>>1;return v>>>0;
});
function bloco(tipo,data){
 const head=Buffer.from(tipo,"ascii"),len=Buffer.alloc(4),crc=Buffer.alloc(4);
 len.writeUInt32BE(data.length);let v=0xffffffff;
 for(const c of Buffer.concat([head,data]))v=tabela[(v^c)&255]^(v>>>8);
 crc.writeUInt32BE((v^0xffffffff)>>>0);
 return Buffer.concat([len,head,data,crc]);
}
function gerarPNG(tamanho,mascara=false){
 const lado=tamanho*4+1,raw=Buffer.alloc(lado*tamanho);
 for(let y=0;y<tamanho;y++){
  const base=y*lado;raw[base]=0;
  for(let x=0;x<tamanho;x++){
   let a=0,r=0,g=0,b=0;
   // Antisserrilhado por supersampling 2x2.
   for(let sy=0;sy<2;sy++)for(let sx=0;sx<2;sx++){
    const u=(x+(sx+0.5)/2)*96/tamanho,v=(y+(sy+0.5)/2)*96/tamanho;
    const c=cor(u,v,mascara),peso=c[3]/255;a+=c[3];r+=c[0]*peso;g+=c[1]*peso;b+=c[2]*peso;
   }
   const pos=base+1+x*4,op=a/4;
   raw[pos]=op?Math.round(r/(a/255)):0;
   raw[pos+1]=op?Math.round(g/(a/255)):0;
   raw[pos+2]=op?Math.round(b/(a/255)):0;
   raw[pos+3]=Math.round(op);
  }
 }
 const ihdr=Buffer.alloc(13);
 ihdr.writeUInt32BE(tamanho,0);ihdr.writeUInt32BE(tamanho,4);
 ihdr[8]=8;ihdr[9]=6;
 return Buffer.concat([Buffer.from("89504e470d0a1a0a","hex"),bloco("IHDR",ihdr),
   bloco("IDAT",deflateSync(raw,{level:9})),bloco("IEND",Buffer.alloc(0))]);
}
function gerarICO(pngs){
 const header=Buffer.alloc(6+pngs.length*16),partes=[header];
 header.writeUInt16LE(1,2);header.writeUInt16LE(pngs.length,4);
 let offset=header.length;
 pngs.forEach(([tam,png],i)=>{
  const o=6+i*16;
  header[o]=tam===256?0:tam;header[o+1]=tam===256?0:tam;header[o+2]=0;header[o+3]=0;
  header.writeUInt16LE(1,o+4);header.writeUInt16LE(32,o+6);
  header.writeUInt32LE(png.length,o+8);header.writeUInt32LE(offset,o+12);
  offset+=png.length;partes.push(png);
 });
 return Buffer.concat(partes);
}
await mkdir(resolve(destino,"icones"),{recursive:true});
const arquivos=[
 ["icones/mobis-ma-favicon-32.png",gerarPNG(32)],
 ["icones/mobis-ma-apple-180.png",gerarPNG(180)],
 ["icones/mobis-ma-app-192.png",gerarPNG(192)],
 ["icones/mobis-ma-app-512.png",gerarPNG(512)],
 ["icones/mobis-ma-maskable-512.png",gerarPNG(512,true)],
 ["mobis-ma-favicon.ico",gerarICO([[32,gerarPNG(32)],[48,gerarPNG(48)]])],
];
for(const [p,data] of arquivos)await writeFile(resolve(destino,p),data);
console.log("MOBIS MA: "+arquivos.map(([p,b])=>p+" ("+b.length+" B)").join(", "));
