/**
 * Smoke hospedado de Workers Free; somente duas lojas e produtos artificiais.
 * Credenciais recebidas do runner; jamais imprimi-las ou consultar Bling.
 */
import assert from "node:assert/strict";
const url=process.env.NANOIA_HML_URL;
const a=process.env.NANOIA_HML_TOKEN_A,b=process.env.NANOIA_HML_TOKEN_B;
if(!url||!/^https:\/\/nanoia-hml-free-pai-[0-9]{5,16}\.[a-z0-9-]+\.workers\.dev\/mcp$/.test(url)
 || !a||!b||a.length<32||b.length<32||a===b)throw Error("configuracao_hml_free_invalida");
const request=async(token,method,params={})=>{
 const resp=await fetch(url,{method:"POST",headers:{"content-type":"application/json",
   authorization:"Bearer "+token},body:JSON.stringify({jsonrpc:"2.0",id:42,method,params}),
   redirect:"manual",signal:AbortSignal.timeout(15000)});
 return {status:resp.status,body:await resp.json()};
};
const noauth=await fetch(url,{method:"POST",body:"{}",redirect:"manual"});
assert.equal(noauth.status,401);
const origin=await fetch(url,{method:"POST",headers:{origin:"https://site-desconhecido.invalid",
 authorization:"Bearer "+a},body:"{}",redirect:"manual"});
assert.equal(origin.status,403);
for(const token of [a,b]){
 const x=await request(token,"initialize",{protocolVersion:"2025-06-18",capabilities:{},
 clientInfo:{name:"free-stage-ci",version:"1"}});
 assert.equal(x.status,200);
 assert.ok(x.body.result?.serverInfo);
 const tools=await request(token,"tools/list");
 assert.deepEqual(tools.body.result.tools.map(t=>t.name),["catalogo_resumo","catalogo_listar"]);
}
const op=(token,name,args={})=>request(token,"tools/call",{name,arguments:args});
const resA=await op(a,"catalogo_resumo");
const resB=await op(b,"catalogo_resumo");
assert.equal(resA.status,200);
assert.equal(resB.status,200);
assert.equal(resA.body.result.structuredContent.produtos,2);
assert.equal(resB.body.result.structuredContent.produtos,1);
const list=await op(a,"catalogo_listar",{limite:10});
assert.equal(list.status,200);
const raw=JSON.stringify(list.body);
assert.match(raw,/FIX-HML-A-01/);
for(const x of ["FIX-HML-B-01","precoCusto","fornecedor","ncm","estoque"])
 assert.ok(!raw.includes(x),"campo_sensivel");
const spoof=await op(b,"catalogo_listar",{loja_id:"aaaaaaaa-0000-0000-0000-000000000001"});
assert.ok(spoof.body.error);
const code=await op(a,"code",{code:"fetch('https://example.com')"});
assert.ok(code.body.error,"Code Mode proibido no Free");
const write=await op(a,"bling_produtos_alterar",{});
assert.ok(write.body.error,"nenhuma escrita Bling");
console.log("PASS: Workers Free hospedado, MCP estático, HMAC, lojas A/B, proteção de dados e nenhuma execução IA.");
