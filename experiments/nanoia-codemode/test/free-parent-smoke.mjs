/**
 * Homologação local de Workers FREE: MCP estático -> HMAC -> Service Binding
 * -> Host Durable Object SQLite com somente fixtures. Nunca executa código IA.
 * Sem login Cloudflare, plano pago, Bling ou Supabase de produção.
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { assinarBridge, BRIDGE_PATH } from "../src/bridge-auth.mjs";

const persist=mkdtempSync(join(tmpdir(),"nanoia-hml-free-"));
const hA=randomBytes(48).toString("base64url"),hB=randomBytes(48).toString("base64url");
const a=randomBytes(48).toString("base64url"),b=randomBytes(48).toString("base64url");
const hostPort=8897,freePort=8898;
const active=[];
function start(args) {
  const p=spawn("./node_modules/.bin/wrangler",["dev",...args,"--show-interactive-dev-session=false"],
    {stdio:["ignore","pipe","pipe"],env:{...process.env,CI:"true",WRANGLER_SEND_METRICS:"false"}});
  let logs="";
  for (const stream of [p.stdout,p.stderr])stream.on("data",x=>logs=(logs+x.toString()).slice(-7000));
  active.push({p,logs:()=>logs});
  return p;
}
async function ready(port,p){
  for(let i=0;i<90;i++){
    if(p.exitCode!==null)throw Error("worker_encerrou_antes_de_iniciar");
    try{
      const r=await fetch("http://127.0.0.1:"+port+"/inexistente",{signal:AbortSignal.timeout(600)});
      if(r.status===404)return;
    }catch{}
    await new Promise(r=>setTimeout(r,250));
  }
  throw Error("worker_nao_iniciou");
}
async function rpc(token,method,params={},headers={}) {
  const r=await fetch("http://127.0.0.1:"+freePort+"/mcp",{method:"POST",
    headers:{"content-type":"application/json", authorization:"Bearer "+token,...headers},
    body:JSON.stringify({jsonrpc:"2.0",id:777,method,params}),signal:AbortSignal.timeout(9000)});
  const t=await r.text();
  return {status:r.status, data:JSON.parse(t)};
}
try{
  const host=start(["-c","staging/wrangler-host.jsonc","--local","--ip","127.0.0.1",
    "--port",String(hostPort),"--persist-to",persist,
    "--var","STAGING_HMAC_A:"+hA,"--var","STAGING_HMAC_B:"+hB]);
  await ready(hostPort,host);
  const free=start(["-c","staging/wrangler-free-parent.jsonc","--local","--ip","127.0.0.1",
    "--port",String(freePort),"--var","PILOT_ENABLED:true",
    "--var","PILOT_TOKEN_A:"+a,"--var","PILOT_TOKEN_B:"+b,
    "--var","PILOT_HOST_SECRET_A:"+hA,"--var","PILOT_HOST_SECRET_B:"+hB]);
  await ready(freePort,free);
  const bad=await rpc("invalido","initialize");
  assert.equal(bad.status,401);
  const origin=await rpc(a,"initialize",{},{"origin":"https://teste.invalid"});
  assert.equal(origin.status,403);
  for(const token of [a,b]) {
    const init=await rpc(token,"initialize",{protocolVersion:"2025-06-18",capabilities:{},clientInfo:{name:"free-ci",version:"1"}});
    assert.equal(init.status,200);
    assert.equal(init.data.result.serverInfo.name,"nanoia-free-homologacao-sintetica");
    const list=await rpc(token,"tools/list");
    assert.deepEqual(list.data.result.tools.map(t=>t.name),["catalogo_resumo","catalogo_listar"]);
  }
  const req=(token,name,args={})=>rpc(token,"tools/call",{name,arguments:args});
  const A=await req(a,"catalogo_resumo");
  const B=await req(b,"catalogo_resumo");
  assert.equal(A.status,200,JSON.stringify(A.data));
  assert.equal(B.status,200,JSON.stringify(B.data));
  assert.equal(A.data.result.structuredContent.produtos,2);
  assert.equal(B.data.result.structuredContent.produtos,1);
  const lista=await req(a,"catalogo_listar",{limite:10});
  assert.equal(lista.status,200,JSON.stringify(lista.data));
  const out=JSON.stringify(lista.data.result);
  assert.match(out,/FIX-HML-A-01/);
  for(const p of ["FIX-HML-B-01","fornecedor","precoCusto","ncm","estoque","INTERNO_NUNCA_RETORNAR"])
    assert.ok(!out.includes(p),"campo_nao_autorizado");
  const cross=await req(b,"catalogo_listar",{loja_id:"aaaaaaaa-0000-0000-0000-000000000001"});
  assert.ok(cross.data.error,"parametros_nao_autorizados");
  const code=await req(a,"code",{code:"async()=>fetch('https://example.com')"});
  assert.ok(code.data.error,"nenhuma ferramenta de execução arbitrária no Free");
  const write=await req(a,"bling_produtos_alterar",{});
  assert.ok(write.data.error,"escrita Bling bloqueada");
  const invalid=await req(a,"catalogo_listar",{limite:200});
  assert.equal(invalid.data.error?.code,-32602);
  const source=JSON.stringify({operacao:"catalogo_resumo",args:{}});
  const sig=await assinarBridge({keyId:"hml-a",secret:hA,corpo:source});
  const direct=()=>fetch("http://127.0.0.1:"+hostPort+BRIDGE_PATH,{
    method:"POST",headers:{"content-type":"application/json",...sig},body:source});
  assert.equal((await direct()).status,200);
  assert.equal((await direct()).status,401,"replay não bloqueado");
  console.log("PASS: Workers FREE MCP fixo, HMAC, 2 tenants, host SQLite, replay, campos mínimos e sem Code Mode");
}catch(e) {
  console.error("FAIL: Workers FREE:",String(e));
  for(const v of active) {
    let log=v.logs();
    for(const secret of [hA,hB,a,b])log=log.replaceAll(secret,"[REDACTED]");
    console.error(log.slice(-1500));
  }
  process.exitCode=1;
}finally{
  for(const v of active)v.p.kill("SIGTERM");
  try{rmSync(persist,{recursive:true,force:true});}catch{}
}
