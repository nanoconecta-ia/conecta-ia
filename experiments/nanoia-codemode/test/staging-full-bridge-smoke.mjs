/**
 * Integração local completa de staging:
 * MCP -> Code Mode sem egress -> Worker pai (HMAC) -> Service Binding ->
 * Worker host de staging -> Durable Object SQLite/auditoria.
 * Sem rede externa, sem Bling, sem Supabase real.
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
const A="token_staging_A_somente_fixture_20261030_ABCDEF";
const B="token_staging_B_somente_fixture_20261030_ABCDEF";
const hA="secretA_staging_fixture_HMAC_nao_publicar_1234567890123456";
const hB="secretB_staging_fixture_HMAC_nao_publicar_1234567890123456";
const hostPort=8893, parentPort=8894, base="http://127.0.0.1:";
const env={...process.env,CI:"true",WRANGLER_SEND_METRICS:"false"};
const processes=[];
function iniciar(args){
  const p=spawn("./node_modules/.bin/wrangler",["dev",...args,"--show-interactive-dev-session=false"],{stdio:["ignore","pipe","pipe"],env});
  const obj={p,log:""};
  for(const stream of [p.stdout,p.stderr])
    stream.on("data",x=>{obj.log=(obj.log+x.toString()).slice(-7000);});
  processes.push(obj);
  return obj;
}
async function pronto(port,p){
  for(let i=0;i<90;i++){
    if(p.p.exitCode!==null)throw Error("worker finalizou antes do ready");
    try {
      const r=await fetch(base+port+"/no-route",{signal:AbortSignal.timeout(600)});
      if(r.status===404)return;
    }catch{}
    await new Promise(r=>setTimeout(r,300));
  }
  throw Error("worker sem ready");
}
const sessoes=new Map();
async function rpc(token,method,params){
  const headers={"content-type":"application/json","accept":"application/json, text/event-stream","authorization":"Bearer "+token,
    ...(sessoes.has(token)?{"mcp-session-id":sessoes.get(token)}:{})};
  const r=await fetch(base+parentPort+"/mcp",{method:"POST",headers,
    body:JSON.stringify({jsonrpc:"2.0",id:2000+Math.floor(Math.random()*10000),method,params}),
    signal:AbortSignal.timeout(14000)});
  const sid=r.headers.get("mcp-session-id");if(sid)sessoes.set(token,sid);
  const txt=await r.text();
  if(!r.ok)return {status:r.status,result:null,txt};
  const line=txt.split(/\r?\n/).find(x=>x.startsWith("data:"));
  const obj=JSON.parse(line?line.slice(5):txt);
  return {status:r.status,result:obj.result,txt};
}
async function consultar(token,code){
  const r=await rpc(token,"tools/call",{name:"code",arguments:{code}});
  assert.equal(r.status,200,r.txt.slice(0,320));
  assert.equal(Boolean(r.result?.isError),false,r.txt.slice(0,600));
  return JSON.stringify(r.result);
}
try{
  const host=iniciar(["-c","staging/wrangler-host.jsonc","--local","--ip","127.0.0.1","--port",String(hostPort),
    "--var","STAGING_HMAC_A:"+hA,"--var","STAGING_HMAC_B:"+hB,"--var","DEBUG_FIXTURE:true"]);
  await pronto(hostPort,host);
  const parent=iniciar(["-c","staging/wrangler-parent.jsonc","--local","--ip","127.0.0.1","--port",String(parentPort),
    "--var","PILOT_TOKEN_A:"+A,"--var","PILOT_TOKEN_B:"+B,
    "--var","PILOT_HOST_SECRET_A:"+hA,"--var","PILOT_HOST_SECRET_B:"+hB]);
  await pronto(parentPort,parent);
  assert.match(parent.log,/\[connected\]/,"Service Binding deve estar conectado");
  const unauthorized=await rpc("token_ruim_staging_fixture","ping",{});
  assert.equal(unauthorized.status,401);
  for(const token of [A,B]){
    const init=await rpc(token,"initialize",{protocolVersion:"2025-06-18",capabilities:{},clientInfo:{name:"stage-ci",version:"1"}});
    assert.equal(init.status,200);
    assert.ok(init.result?.serverInfo);
    const tools=await rpc(token,"tools/list",{});
    assert.deepEqual(tools.result.tools.map(x=>x.name),["code"]);
  }
  console.log("HML_STEP: resumo A");
  const a=await consultar(A,"async () => { return await codemode.catalogo_resumo({}); }");
  console.log("HML_STEP: resumo B");
  const b=await consultar(B,"async () => { return await codemode.catalogo_resumo({}); }");
  assert.match(a,/produtos.{0,12}2/);
  assert.match(b,/produtos.{0,12}1/);
  console.log("HML_STEP: lista A");
  const lista=await consultar(A,"async () => { return await codemode.catalogo_listar({limite:10}); }");
  assert.match(lista,/FIX-HML-A-01/);
  for(const marker of ["FIX-HML-B-01","precoCusto","fornecedor","ncm","estoque"])
    assert.ok(!lista.includes(marker),"vazamento: "+marker);
  const cross=await consultar(B,"async () => { return await codemode.catalogo_listar({loja_id:'aaaaaaaa-0000-0000-0000-000000000001'}); }");
  assert.ok(!cross.includes("FIX-HML-A-01"),"vazamento entre lojas");
  const egress=await consultar(A,"async () => { try { await fetch('http://127.0.0.1:8893/no-route'); return {bloqueado:false}; } catch { return {bloqueado:true}; } }");
  assert.match(egress,/bloqueado.{0,12}true/);
  console.log("PASS: staging MCP -> sandbox -> HMAC -> Service Binding -> Durable Object auditado e isolado");
}catch(e){
  // Dar tempo para flush do log do Worker antes de encerrar processos de teste.
  await new Promise(r=>setTimeout(r,300));
  console.error("FAIL staging integrado:",String(e));
  for(const proc of processes){
    const safe=proc.log.replaceAll(hA,"[CHAVE_TESTE]").replaceAll(hB,"[CHAVE_TESTE]")
      .replaceAll(A,"[TOKEN_TESTE]").replaceAll(B,"[TOKEN_TESTE]");
    console.error(safe.slice(-2300));
  }
  process.exitCode=1;
}finally {for(const v of processes)v.p.kill("SIGTERM");}
