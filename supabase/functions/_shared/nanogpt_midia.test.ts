import { test } from "node:test";
import assert from "node:assert/strict";
import { validarImagemAprovada, corpoImagensBling, copiarDrive } from "./nanogpt_midia.ts";
test("exportação recusa imagem pendente, removida e sem direitos", () => {
 for (const i of [null, {}, {aprovada:true}, {aprovada:true, removida_em:'hoje'}, {aprovada:true,direitos_confirmados_em:'hoje'}]) assert.throws(()=>validarImagemAprovada(i));
 assert.doesNotThrow(()=>validarImagemAprovada({aprovada:true,direitos_confirmados_em:'hoje',direitos_referencia:'autorização do fabricante'}));
});
test("Bling preserva URLs atuais, evita duplicatas e envia apenas imagensURL", () => {
 const p={situacao:'A',midia:{imagens:{externas:[{link:'https://fabricante.com/a.jpg'}]}}};
 const b=corpoImagensBling(p,'https://conecta.com/b.jpg');
 assert.deepEqual(b,{midia:{imagens:{imagensURL:[{link:'https://fabricante.com/a.jpg'},{link:'https://conecta.com/b.jpg'}]}}});
 assert.equal(corpoImagensBling(p,'https://fabricante.com/a.jpg').midia.imagens.imagensURL.length,1);
 assert.throws(()=>corpoImagensBling({...p,situacao:'E'},'https://conecta.com/b.jpg'));
 assert.throws(()=>corpoImagensBling({situacao:'A',midia:{imagens:{internas:[{}]}}},'https://conecta.com/b.jpg'));
});
test("Drive transmite bytes originais e exige id e tamanho confirmados", async () => {
 const bytes=new Uint8Array([1,2,3,4]); let chamadas=0;
 const f=async (url: any, init: any) => { chamadas++; assert.match(url,/uploadType=multipart/);assert.equal(init.method,'POST'); const body=new Uint8Array(await init.body.arrayBuffer()); assert.ok(body.some((v,i)=>v===1&&body[i+1]===2&&body[i+2]===3&&body[i+3]===4));return Response.json({id:'reservado',size:'4'}); };
 const r=await copiarDrive('segredo','reservado','foto.png',bytes,'image/png','hash',f as typeof fetch);assert.equal(r.id,'reservado');assert.equal(chamadas,1);
 await assert.rejects(()=>copiarDrive('x','reservado','foto.png',bytes,'image/png','hash',(async()=>Response.json({id:'outro',size:'4'})) as typeof fetch));
 let tentativas=0;await assert.rejects(()=>copiarDrive('x','reservado','foto.png',bytes,'image/png','hash',(async()=>{tentativas++;throw Error('timeout')}) as typeof fetch));assert.equal(tentativas,1);
});
