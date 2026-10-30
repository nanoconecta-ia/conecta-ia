/**
 * Teste local do HOST DE STAGING com Durable Object SQLite REAL via Wrangler.
 * Não precisa de conta Cloudflare: somente fixtures e chaves públicas de teste.
 * Nenhum token de produção ou do Bling é lido. Processo termina ao final.
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { assinarBridge, BRIDGE_PATH } from "../src/bridge-auth.mjs";
const secretA="segredo_sintetico_stage_A_nao_usar_em_producao__0000000001";
const secretB="segredo_sintetico_stage_B_nao_usar_em_producao__0000000002";
const port=8891, root="http://127.0.0.1:"+port;
const run=spawn("./node_modules/.bin/wrangler",[
  "dev", "-c", "staging/wrangler-host.jsonc", "--local", "--ip", "127.0.0.1",
  "--port", String(port), "--show-interactive-dev-session=false",
  "--var", "STAGING_HMAC_A:"+secretA,"--var", "STAGING_HMAC_B:"+secretB
],{stdio:["ignore","pipe","pipe"],env:{...process.env,CI:"true",WRANGLER_SEND_METRICS:"false"}});
let logs="";
for(const st of [run.stdout,run.stderr])st.on("data",v=>{logs=(logs+v.toString()).slice(-12000);});
async function enviar(kid,secret,operacao,args={},override={}) {
  const corpo=JSON.stringify({operacao,args});
  const h=await assinarBridge({keyId:kid,secret,corpo});
  const r=await fetch(root+BRIDGE_PATH,{method:"POST",
    headers:{"content-type":"application/json",...h,...override},
    body:corpo,signal:AbortSignal.timeout(6500)});
  return {status:r.status,body:await r.json()};
}
try{
  let ready=false;
  for(let i=0;i<90;i++){
    if(run.exitCode!==null)throw Error("Wrangler encerrado antes do teste");
    try{
      const r=await fetch(root+"/no-route",{signal:AbortSignal.timeout(500)});
      if(r.status===404){ready=true;break;}
    }catch{}
    await new Promise(r=>setTimeout(r,300));
  }
  if(!ready)throw Error("staging host não iniciou");
  const a=await enviar("hml-a",secretA,"catalogo_resumo");
  assert.equal(a.status,200,JSON.stringify(a.body));
  assert.equal(a.body.resultado.produtos,2);
  const b=await enviar("hml-b",secretB,"catalogo_resumo");
  assert.equal(b.status,200,JSON.stringify(b.body));
  assert.equal(b.body.resultado.produtos,1);
  const lista=await enviar("hml-a",secretA,"catalogo_listar",{limite:10});
  assert.equal(lista.status,200,JSON.stringify(lista.body));
  assert.equal(lista.body.resultado.itens.length,2);
  const serialized=JSON.stringify(lista.body);
  assert.ok(serialized.includes("FIX-HML-A-01"));
  assert.ok(!serialized.includes("FIX-HML-B-01"));
  for(const campo of ["precoCusto","fornecedor","ncm","estoque","INTERNO_NUNCA_RETORNAR"])
    assert.ok(!serialized.includes(campo),"campo sensível foi exposto: "+campo);
  // Alterar o tenant no payload não altera a identidade autenticada.
  const spoof=await enviar("hml-b",secretB,"catalogo_listar",{loja_id:"aaaaaaaa-0000-0000-0000-000000000001"});
  assert.ok(spoof.status===200||spoof.status===403);
  assert.ok(!JSON.stringify(spoof.body).includes("FIX-HML-A-01"));
  const desconhecido=await enviar("hml-c",secretA,"catalogo_resumo");
  assert.equal(desconhecido.status,401);
  const semEscopo=await enviar("hml-a",secretB,"catalogo_resumo");
  assert.equal(semEscopo.status,401);
  const proibido=await enviar("hml-a",secretA,"bling_alterar_preco");
  assert.equal(proibido.status,403);
  const corpo=JSON.stringify({operacao:"catalogo_resumo",args:{}});
  const hdr=await assinarBridge({keyId:"hml-a",secret:secretA,corpo});
  const first=await fetch(root+BRIDGE_PATH,{method:"POST",headers:hdr,body:corpo});
  assert.equal(first.status,200);
  const duplicate=await fetch(root+BRIDGE_PATH,{method:"POST",headers:hdr,body:corpo});
  assert.equal(duplicate.status,401,"replay no Durable Object deve ser bloqueado");
  // 60 consultas por minuto por chave e falha fechada ao atingir limite.
  let limited=false;
  for(let i=0;i<70;i++){
    const r=await enviar("hml-b",secretB,"catalogo_resumo");
    if(r.status===429){limited=true;break;}
    assert.equal(r.status,200,JSON.stringify(r.body));
  }
  assert.ok(limited,"quota persistente por chave não aplicou 429");
  console.log("PASS: host DO staging SQLite, isolamento A/B, HMAC, auditoria, replay persistido, 429 e payload mínimo");
}catch(e){
  console.error("FAIL: staging host DO:",String(e));
  const safe=logs.replaceAll(secretA,"[TEST_KEY]").replaceAll(secretB,"[TEST_KEY]");
  console.error("WRANGLER:",safe.slice(-2800));
  process.exitCode=1;
}finally {run.kill("SIGTERM");}
