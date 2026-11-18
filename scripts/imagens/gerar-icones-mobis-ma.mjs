/** Derivados digitais MOBIS M-STYLE CROMO V3 (18/11/2026).
 * Nunca redesenha a marca: valida os PNGs oficiais preservados byte a byte
 * do kit V3 do Google Drive e apenas gera ICO e versão maskable com margem segura.
 * Sem bibliotecas externas, login, dados de clientes ou rede.
 */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {inflateSync,deflateSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const arquivos=[
 ['painel/src/assets/marcas/mobis-mstyle-v3-logo.png','5c051693453af9bc44382f4b02bf22749d400e4abe735ce36556fa433deab554'],
 ['painel/public/icones/mobis-ma-favicon-32.png','313e9c950f89490162bba8fd0a3b47c3ad77ba969b9726fbb387f8a9df36aef6'],
 ['painel/public/icones/mobis-ma-apple-180.png','17e19696cf4f4bf63d2537264e57f8c590a3fa42e3703adc5ff439b09c2664fa'],
 ['painel/public/icones/mobis-ma-app-192.png','ff63ab1f6bc6d9e5532f3c18b58c5297d4c7cf21d2b354f4ae89b13fab85d3d2'],
 ['painel/public/icones/mobis-ma-app-512.png','ea87dcf2b3db62ad4868e8e9f6bf53f7d8ba37d2bd9751c74b3a8893f10f2fd9']
];
const fonte=[];
for(const [path,sha] of arquivos){
 const dados=await readFile(resolve(root,path));
 if(createHash('sha256').update(dados).digest('hex')!==sha)throw Error('Identidade V3 inválida: '+path);
 fonte.push(dados);
}
const destino=resolve(root,'painel/public');
await mkdir(resolve(destino,'icones'),{recursive:true});

// .ico verdadeiro: incorpora o PNG original 32x32 sem o modificar.
function ico(png){
 const header=Buffer.alloc(22);
 header.writeUInt16LE(1,2);header.writeUInt16LE(1,4);
 header[6]=32;header[7]=32;
 header.writeUInt16LE(1,10);header.writeUInt16LE(32,12);
 header.writeUInt32LE(png.length,14);header.writeUInt32LE(22,18);
 return Buffer.concat([header,png]);
}
await writeFile(resolve(destino,'mobis-ma-favicon.ico'),ico(fonte[1]));

const crcTable=Uint32Array.from({length:256},(_,i)=>{
 let c=i;for(let j=0;j<8;j++)c=c&1?(0xEDB88320^(c>>>1)):(c>>>1);return c>>>0;
});
function crc32(bytes){let c=0xffffffff;for(const b of bytes)c=crcTable[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0;}
function chunk(name,data){
 const h=Buffer.from(name,'ascii'),len=Buffer.alloc(4),crc=Buffer.alloc(4);
 len.writeUInt32BE(data.length,0);crc.writeUInt32BE(crc32(Buffer.concat([h,data])),0);
 return Buffer.concat([len,h,data,crc]);
}
function lerRGBA(bytes){
 const sig=Buffer.from('89504e470d0a1a0a','hex');
 if(!bytes.subarray(0,8).equals(sig))throw Error('PNG V3 inválido');
 let p=8,w=0,h=0,parts=[];
 while(p<bytes.length){
  const n=bytes.readUInt32BE(p),id=bytes.toString('ascii',p+4,p+8),data=bytes.subarray(p+8,p+8+n);p+=12+n;
  if(id==='IHDR'){
   w=data.readUInt32BE(0);h=data.readUInt32BE(4);
   if(data[8]!==8||data[9]!==6||data[12]!==0)throw Error('PNG oficial precisa ser RGBA 8-bit não entrelaçado');
  } else if(id==='IDAT')parts.push(data);
  else if(id==='IEND')break;
 }
 const raw=inflateSync(Buffer.concat(parts)),stride=w*4,out=Buffer.alloc(h*stride);
 let offset=0;
 for(let y=0;y<h;y++){
  const filter=raw[offset++],base=y*stride,prior=(y-1)*stride;
  for(let x=0;x<stride;x++){
   const v=raw[offset++],a=x>=4?out[base+x-4]:0,b=y>0?out[prior+x]:0,c=y>0&&x>=4?out[prior+x-4]:0;
   let pred=0;
   if(filter===1)pred=a;
   else if(filter===2)pred=b;
   else if(filter===3)pred=(a+b)>>1;
   else if(filter===4){const p=a+b-c,da=Math.abs(p-a),db=Math.abs(p-b),dc=Math.abs(p-c);pred=da<=db&&da<=dc?a:db<=dc?b:c;}
   else if(filter!==0)throw Error('Filtro PNG desconhecido: '+filter);
   out[base+x]=(v+pred)&255;
  }
 }
 return {w,h,pixels:out};
}
function salvarRGBA(w,h,pixels){
 const stride=w*4,raw=Buffer.alloc(h*(stride+1));
 for(let y=0;y<h;y++){const start=y*(stride+1);raw[start]=0;pixels.copy(raw,start+1,y*stride,(y+1)*stride);}
 const ih=Buffer.alloc(13);ih.writeUInt32BE(w,0);ih.writeUInt32BE(h,4);ih[8]=8;ih[9]=6;
 return Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',ih),chunk('IDAT',deflateSync(raw,{level:9})),chunk('IEND',Buffer.alloc(0))]);
}

// Safe zone do Android: placa inteira ocupa 72% do quadrado, mantendo a moldura.
const {w,h,pixels:src}=lerRGBA(fonte[4]);
if(w!==512||h!==512)throw Error('Icone fonte V3 precisa ser 512x512');
const size=512,side=368,margin=(size-side)/2;
const out=Buffer.alloc(size*size*4);
for(let i=0;i<size*size;i++){out[i*4]=31;out[i*4+1]=35;out[i*4+2]=39;out[i*4+3]=255;}
for(let y=0;y<side;y++)for(let x=0;x<side;x++){
 const sx=Math.max(0,Math.min(511,Math.floor((x+.5)*512/side))),sy=Math.max(0,Math.min(511,Math.floor((y+.5)*512/side)));
 const si=(sy*512+sx)*4,di=((y+margin)*512+x+margin)*4,a=src[si+3]/255;
 for(let c=0;c<3;c++)out[di+c]=Math.round(src[si+c]*a+out[di+c]*(1-a));
}
const maskable=salvarRGBA(512,512,out);
await writeFile(resolve(destino,'icones/mobis-ma-maskable-512.png'),maskable);
console.log('MOBIS M-STYLE V3: PNGs originais validados, favicon e maskable gerados sem redesenho');
