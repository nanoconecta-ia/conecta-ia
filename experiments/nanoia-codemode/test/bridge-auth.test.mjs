import test from "node:test";
import assert from "node:assert/strict";
import { assinarBridge, verificarBridge, validarDestinoHost, criarClienteBridge, BRIDGE_PATH } from "../src/bridge-auth.mjs";
const secret = "segredo_ficticio_laboratorio_A_2026_abcdef9876543210";
const keyId = "hml-a";
const corpo = JSON.stringify({ operacao:"catalogo_resumo",args:{} });
const validar = (cab, valor=corpo, opt={}) => verificarBridge({
  method: opt.method ?? "POST", path: opt.path ?? BRIDGE_PATH,
  headers: new Headers(cab), corpo: valor,
  buscarChave: async (id) => id===keyId ? { secret, ativa: true } : null,
  replay: opt.replay ?? (async()=>false),
  agora: opt.agora ?? Date.now(),
});
test("assinatura HMAC autentica método, path, key-id, timestamp e bytes do corpo",async()=>{
  const h=await assinarBridge({keyId,secret,corpo});
  assert.deepEqual(await validar(h),{ok:true,keyId});
  assert.equal((await validar(h,corpo.replace("resumo","listar"))).ok,false);
  assert.equal((await validar(h,corpo,{method:"GET"})).ok,false);
  assert.equal((await validar(h,corpo,{path:"/v2/codemode/consulta"})).ok,false);
  assert.equal((await validar({...h,"x-nano-key-id":"hml-b"})).ok,false);
  assert.equal((await validar({...h,"x-nano-signature":"v1="+"0".repeat(64)})).ok,false);
});
test("bloqueia replay, assinatura expirada e identidade revogada",async()=>{
  const h=await assinarBridge({keyId,secret,corpo});
  const usados=new Set();
  const replay=async(id,n)=>{const s=id+":"+n;if(usados.has(s))return true;usados.add(s);return false;};
  assert.equal((await validar(h,corpo,{replay})).ok,true);
  assert.equal((await validar(h,corpo,{replay})).motivo,"repeticao_bloqueada");
  const expirou=await assinarBridge({keyId,secret,corpo,agora:Date.now()-31_000});
  assert.equal((await validar(expirou)).ok,false);
  const inativo=await verificarBridge({method:"POST",path:BRIDGE_PATH,headers:new Headers(h),corpo,
    buscarChave:async()=>({secret,ativa:false}),replay:async()=>false});
  assert.equal(inativo.ok,false);
});
test("destino tem que ser https estrito, localhost somente opt-in de laboratório",()=>{
  assert.equal(validarDestinoHost("https://hml.example.com"+BRIDGE_PATH),"https://hml.example.com"+BRIDGE_PATH);
  assert.equal(validarDestinoHost("http://127.0.0.1:8799"+BRIDGE_PATH,true),"http://127.0.0.1:8799"+BRIDGE_PATH);
  for(const url of [
    "http://127.0.0.1:8799"+BRIDGE_PATH,
    "http://localhost:8799"+BRIDGE_PATH,
    "https://localhost"+BRIDGE_PATH,
    "https://127.0.0.1"+BRIDGE_PATH,
    "https://hml.example.com"+BRIDGE_PATH+"?token=x",
    "https://u:senha@hml.example.com"+BRIDGE_PATH,
    "https://hml.example.com/v1/qualquer",
  ])assert.throws(()=>validarDestinoHost(url),/destino_invalido/,url);
});
test("cliente recusa operação arbitrária, parâmetros inadequados, HTTP 500 e redirecionamento",async()=>{
  let calls=0;
  const fetchFn=async (_url,init)=>{ calls++; assert.equal(init.redirect,"manual");return new Response(JSON.stringify({ok:true,resultado:{produtos:1}}),{status:200,headers:{"content-type":"application/json"}});};
  const cli=criarClienteBridge({url:"https://hml.example.com"+BRIDGE_PATH,keyId,secret,fetchFn});
  assert.deepEqual(await cli("catalogo_resumo",{}),{produtos:1});
  await assert.rejects(cli("bling_produtos_alterar",{}),/operacao_nao_autorizada/);
  await assert.rejects(cli("catalogo_listar",{busca:"A".repeat(6000)}),/argumento_invalido/);
  assert.equal(calls,1);
  const erro=criarClienteBridge({url:"https://hml.example.com"+BRIDGE_PATH,keyId,secret,
    fetchFn:async()=>new Response("falhou",{status:500})});
  await assert.rejects(erro("catalogo_resumo",{}),/host_recusou_operacao/);
  // Redirect jamais pode encaminhar credenciais HMAC a outro destino.
  const redirecionado=criarClienteBridge({url:"https://hml.example.com"+BRIDGE_PATH,keyId,secret,
    fetchFn:async()=>new Response(null,{status:302,headers:{location:"https://fora.example/roubo"}})});
  await assert.rejects(redirecionado("catalogo_resumo",{}),/host_recusou_operacao/);
  const redir=criarClienteBridge({url:"https://hml.example.com"+BRIDGE_PATH,keyId,secret,
    fetchFn:async()=>{throw new Error("redirect-blocked");}});
  await assert.rejects(redir("catalogo_resumo",{}),/host_indisponivel/);
});
