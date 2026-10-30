/**
 * NanoIA MCP homologação Cloudflare WORKERS FREE.
 * Worker convencional SEM DynamicWorkerExecutor e SEM Worker Loader.
 * Só oferece duas ferramentas de LEITURA em dados sintéticos por Service Binding
 * ao host com HMAC, Policy Engine, Durable Object SQLite e auditoria fail-closed.
 * Não conecta Bling, Supabase, LLM, provedores pagos ou catálogo da Mobis.
 */
import { autenticarDemo } from "../src/seguranca.mjs";
import { criarClienteBridge } from "../src/bridge-auth.mjs";
interface Env {
  PILOT_ENABLED?: string;
  PILOT_TOKEN_A?: string;
  PILOT_TOKEN_B?: string;
  PILOT_HOST_URL?: string;
  PILOT_HOST_KEY_A?: string;
  PILOT_HOST_KEY_B?: string;
  PILOT_HOST_SECRET_A?: string;
  PILOT_HOST_SECRET_B?: string;
  PILOT_HOST_SERVICE?: Fetcher;
}
const json=(body:unknown,status=200,extra:Record<string,string>={})=>new Response(JSON.stringify(body), {
  status,headers:{"content-type":"application/json","cache-control":"no-store",
    "x-content-type-options":"nosniff","referrer-policy":"no-referrer",...extra},
});
const ferramentas = [
  {name:"catalogo_resumo",description:"Consulta contagens fictícias da loja autenticada, com auditoria.",
    inputSchema:{type:"object",properties:{},additionalProperties:false}},
  {name:"catalogo_listar",description:"Lista somente SKU/nome fictícios da loja autenticada.",
    inputSchema:{type:"object",properties:{
      busca:{type:"string",maxLength:80},limite:{type:"integer",minimum:1,maximum:20}
    },additionalProperties:false}},
];
const erro=(id:unknown,code:number,message:string)=>({jsonrpc:"2.0",id:id??null,error:{code,message}});
const sucesso=(id:unknown,result:unknown)=>({jsonrpc:"2.0",id,result});
const valido=(x:unknown):x is Record<string,unknown>=>x!==null&&typeof x==="object"&&!Array.isArray(x);
function argumentos(name:string,value:unknown){
  if(!valido(value))throw Error("parametros_invalidos");
  const keys=Object.keys(value);
  if(name==="catalogo_resumo"){
    if(keys.length)throw Error("parametros_invalidos");
    return {};
  }
  if(name!=="catalogo_listar"||keys.some(k=>!["busca","limite"].includes(k)))throw Error("parametros_invalidos");
  if(value.busca!==undefined&&(typeof value.busca!=="string"||value.busca.length>80))throw Error("parametros_invalidos");
  if(value.limite!==undefined&&(!Number.isSafeInteger(value.limite)||(value.limite as number)<1||(value.limite as number)>20))
    throw Error("parametros_invalidos");
  return value;
}
export default {
  async fetch(req:Request,env:Env):Promise<Response>{
    const url=new URL(req.url);
    if(url.pathname!=="/mcp")return json({erro:"nao_encontrado"},404);
    if(req.method!=="POST")return json({erro:"metodo_invalido"},405);
    if(req.headers.has("origin"))return json({erro:"origem_nao_autorizada"},403);
    if(!env?.PILOT_HOST_SERVICE || env.PILOT_ENABLED!=="true")return json({erro:"desligado"},503);
    const tenant=await autenticarDemo(req,env);
    if(!tenant)return json({erro:"nao_autorizado"},401,{"www-authenticate":"Bearer realm=\"nanoia-free-hml\""});
    const length=Number(req.headers.get("content-length")??"0");
    if(length>4096)return json({erro:"corpo_grande"},413);
    let input:Record<string,unknown>;
    try {
      const body=await req.text();
      if(new TextEncoder().encode(body).length>4096) return json({erro:"corpo_grande"},413);
      const parsed=JSON.parse(body);
      if(!valido(parsed))throw Error("json");
      input=parsed;
    }catch{return json(erro(null,-32700,"Parse error"),400);}
    const id=input.id;
    if(input.jsonrpc!=="2.0" || (id!==undefined&&typeof id!=="string"&&typeof id!=="number"))
      return json(erro(null,-32600,"Invalid Request"),400);
    if(input.method==="notifications/initialized")return new Response(null,{status:202,
      headers:{"cache-control":"no-store"}});
    if(id===undefined)return json(erro(null,-32600,"Invalid Request"),400);
    if(input.method==="initialize"){
      return json(sucesso(id,{protocolVersion:"2025-06-18",capabilities:{tools:{listChanged:false}},
        serverInfo:{name:"nanoia-free-homologacao-sintetica",version:"0.1.0"}}));
    }
    if(input.method==="ping")return json(sucesso(id,{}));
    if(input.method==="tools/list")return json(sucesso(id,{tools:ferramentas}));
    if(input.method!=="tools/call")return json(erro(id,-32601,"Method not found"));
    const p=input.params;
    if(!valido(p)||typeof p.name!=="string")return json(erro(id,-32602,"Invalid params"));
    if(!["catalogo_resumo","catalogo_listar"].includes(p.name))
      return json(erro(id,-32601,"Tool not found"));
    let args:Record<string,unknown>;
    try{args=argumentos(p.name,p.arguments??{});}
    catch{return json(erro(id,-32602,"Invalid params"));}
    // Tenant nunca vem dos argumentos do modelo: apenas da credencial bearer.
    const lojaA=tenant==="piloto-a";
    let consulta:(op:string,args:Record<string,unknown>)=>Promise<unknown>;
    try{
      consulta=criarClienteBridge({
        url:env.PILOT_HOST_URL,
        keyId:lojaA?env.PILOT_HOST_KEY_A:env.PILOT_HOST_KEY_B,
        secret:lojaA?env.PILOT_HOST_SECRET_A:env.PILOT_HOST_SECRET_B,
        fetchFn:env.PILOT_HOST_SERVICE.fetch.bind(env.PILOT_HOST_SERVICE),
      });
    }catch{return json(erro(id,-32000,"Homologacao indisponivel"),503);}
    try{
      const output=await consulta(p.name,args);
      return json(sucesso(id,{content:[{type:"text",text:JSON.stringify(output)}],
        structuredContent:output}));
    }catch{
      // Nunca propagar erro bruto, host, HMAC, chave, tenant ou dados internos.
      return json(erro(id,-32000,"Consulta indisponivel"),503);
    }
  },
} satisfies ExportedHandler<Env>;
