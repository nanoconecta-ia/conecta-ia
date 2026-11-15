import { test } from "node:test";
import assert from "node:assert/strict";
import { validarImagemAprovada, corpoImagensBling, copiarDrive, corpoSoImagens, decidirReconciliacao, chaveIdempotencia, FERRAMENTA_IMAGENS, ESPERA_RECONCILIACAO_MS } from "./nanogpt_midia.ts";
import { buscarDefinicao } from "./conector/registro.ts";
import { decidir } from "./conector/policy.ts";
import { buscarFerramenta, podeExecutar } from "./bling_ferramentas.ts";
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

const ctx = { origem: "executor" as const, aprovacaoValida: true, simulado: false, escritaRealLiberada: true, produtoTravado: false };
test("Policy Engine: a ferramenta de imagens existe nos dois registros, fora do chat e do MCP, e não grava sem liberação da loja", () => {
  const def = buscarDefinicao(FERRAMENTA_IMAGENS)!;
  assert.equal(def.estado, "ativa"); assert.equal(def.permissao, "executar"); assert.equal(def.escreveExterno, true);
  assert.equal(def.exigeAprovacao, true); assert.equal(def.idempotencia, "chave"); assert.equal(def.exposicao.chat, false); assert.equal(def.exposicao.mcp, false);
  assert.equal(decidir(def, { ...ctx, escritaRealLiberada: false }).decisao, "negada");
  assert.equal(decidir({ ...def, estado: "desligada" }, ctx).decisao, "negada");
  const f = buscarFerramenta(FERRAMENTA_IMAGENS)!;
  assert.equal(f.ativa, false); assert.equal(f.exigeIdempotencyKey, true); assert.equal(podeExecutar(f, "aprovacao").ok, false);
});
test("Policy Engine: só o executor, com aprovação, liberação e produto sem trava", () => {
  const ligada = buscarDefinicao(FERRAMENTA_IMAGENS)!;
  assert.equal(decidir(ligada, ctx).decisao, "permitida");
  assert.equal(decidir(ligada, { ...ctx, origem: "chat" }).decisao, "negada");
  assert.equal(decidir(ligada, { ...ctx, origem: "gateway_mcp" }).decisao, "negada");
  assert.equal(decidir(ligada, { ...ctx, produtoTravado: true }).decisao, "negada");
  assert.equal(decidir(ligada, { ...ctx, aprovacaoValida: false }).decisao, "requer_aprovacao");
  assert.equal(decidir(ligada, { ...ctx, escritaRealLiberada: false }).decisao, "negada");
});
test("corpo da ferramenta: só midia.imagens.imagensURL com links https", () => {
  const ok = { midia: { imagens: { imagensURL: [{ link: "https://a.com/1.jpg" }] } } };
  assert.equal(corpoSoImagens(ok), null);
  for (const c of [null, [], {}, { ...ok, nome: "x" }, { midia: { imagens: { imagensURL: [] } } }, { midia: { imagens: { imagensURL: [{ link: "http://a.com/1.jpg" }] } } },
    { midia: { imagens: { imagensURL: [{ link: "https://a.com/1.jpg", preco: 1 }] } } }, { midia: { imagens: { imagensURL: ok.midia.imagens.imagensURL, internas: [] } } }, { midia: { imagens: ok.midia.imagens, video: {} } }]) {
    assert.ok(corpoSoImagens(c), JSON.stringify(c));
  }
  assert.equal(chaveIdempotencia("img", "hash"), chaveIdempotencia("img", "hash"));
  assert.notEqual(chaveIdempotencia("img", "hash"), chaveIdempotencia("img", "outro"));
});
test("reconciliação: só libera com leitura do Bling; operação recente espera; recibo inválido é recusado", () => {
  const agora = Date.parse("2026-11-15T12:00:00Z"), url = "https://conecta/x.jpg";
  const velho = { conecta_url: url, estado: "conferencia_necessaria", atualizado_em: new Date(agora - ESPERA_RECONCILIACAO_MS - 1).toISOString() };
  assert.equal(decidirReconciliacao(velho, [url], agora).tipo, "gravado");
  assert.equal(decidirReconciliacao(velho, ["https://outra/y.jpg"], agora).tipo, "nao_gravado");
  assert.equal(decidirReconciliacao({ ...velho, atualizado_em: new Date(agora - 1000).toISOString() }, [], agora).tipo, "aguardar");
  assert.equal(decidirReconciliacao({ ...velho, atualizado_em: undefined }, [], agora).tipo, "aguardar");
  assert.equal(decidirReconciliacao({ ...velho, atualizado_em: new Date(agora - 1000).toISOString() }, [url], agora).tipo, "gravado");
  assert.equal(decidirReconciliacao({ ...velho, estado: "confirmado" }, [], agora).tipo, "gravado");
  for (const r of [null, {}, { conecta_url: "http://x" }]) assert.throws(() => decidirReconciliacao(r as any, [url], agora));
});
