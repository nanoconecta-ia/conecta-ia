/**
 * Verificação read-only de um Worker pai de staging hospedado.
 * Credenciais sintéticas são recebidas apenas por variáveis efêmeras do runner.
 * Jamais imprime token; interrompe em qualquer resposta divergente.
 */
import assert from "node:assert/strict";
const url = process.env.NANOIA_HML_URL, a = process.env.NANOIA_HML_TOKEN_A, b = process.env.NANOIA_HML_TOKEN_B;
if (!url || !a || !b || !/^https:\/\/[a-z0-9.-]+\.workers\.dev\/mcp$/.test(url) ||
  a.length < 30 || b.length < 30 || a === b) throw Error("homologacao_hospedada_nao_configurada");
const sessions = new Map();
async function call(token,method,params = {}) {
  const headers = {"content-type":"application/json", accept:"application/json, text/event-stream", authorization:"Bearer "+token,
    ...(sessions.has(token) ? {"mcp-session-id":sessions.get(token)} : {})};
  const r=await fetch(url,{method:"POST",headers,
    body:JSON.stringify({jsonrpc:"2.0",id:1000+Math.floor(Math.random()*99999),method,params}),
    redirect:"manual",signal:AbortSignal.timeout(15000)});
  const sid=r.headers.get("mcp-session-id"); if(sid)sessions.set(token,sid);
  if(r.status!==200)return {status:r.status};
  const body=await r.text();
  const line=body.split(/\r?\n/).find(x=>x.startsWith("data:"));
  const parsed=JSON.parse(line?line.slice(5):body);
  return {status:r.status, result:parsed.result};
}
async function code(token,source) {
  const r=await call(token,"tools/call",{name:"code",arguments:{code:source}});
  assert.equal(r.status,200,"codigo_nao_respondido");
  assert.equal(Boolean(r.result?.isError),false,"codigo_recusado");
  return JSON.stringify(r.result);
}
const absent = await fetch(url,{method:"POST",headers:{"content-type":"application/json"},body:"{}",redirect:"manual"});
assert.equal(absent.status,401);
const origin = await fetch(url,{method:"POST",headers:{origin:"https://nao-autorizado.invalid",authorization:"Bearer "+a},
  body:"{}",redirect:"manual"});
assert.equal(origin.status,403);
for (const token of [a,b]) {
  const init=await call(token,"initialize",{protocolVersion:"2025-06-18",capabilities:{},clientInfo:{name:"nanoia-hml-ci",version:"1"}});
  assert.equal(init.status,200);
  assert.ok(init.result?.serverInfo);
  const tools=await call(token,"tools/list",{});
  assert.deepEqual(tools.result?.tools?.map(x=>x.name),["code"]);
}
const aa=await code(a,"async()=>await codemode.catalogo_resumo({})");
const bb=await code(b,"async()=>await codemode.catalogo_resumo({})");
assert.match(aa,/produtos.{0,12}2/);
assert.match(bb,/produtos.{0,12}1/);
const list=await code(a,"async()=>await codemode.catalogo_listar({limite:10})");
assert.match(list,/FIX-HML-A-01/);
for(const forbidden of ["FIX-HML-B-01","precoCusto","fornecedor","ncm","estoque","INTERNO_NUNCA_RETORNAR"])
  assert.ok(!list.includes(forbidden),"vazamento_de_campo");
const isolated=await code(b,"async()=>await codemode.catalogo_listar({loja_id:'aaaaaaaa-0000-0000-0000-000000000001'})");
assert.ok(!isolated.includes("FIX-HML-A-01"));
const noEgress=await code(a,"async()=>{try{await fetch('https://example.com');return {blocked:false}}catch{return {blocked:true}}}");
assert.match(noEgress,/blocked.{0,12}true/);
console.log("PASS: staging Cloudflare hospedado, Bearer, Origin, MCP, 2 lojas, output minimo e sandbox isolada");
