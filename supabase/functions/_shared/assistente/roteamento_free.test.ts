import { test } from "node:test";
import assert from "node:assert/strict";
import { consultaPublicaEconomica, planoLimites, reservarPassoLivre, saudacaoSemIA, restanteDiarioOpenRouter } from "./roteamento_free.ts";
import { IaErro } from "../ia/claude.ts";

test("saudação curta não chama IA nem simula resultado do provedor", () => {
  assert.match(saudacaoSemIA("Oi!")!, /sem gastar tokens/);
  assert.equal(saudacaoSemIA("Quero saber o SKU CI000016"), null);
  assert.equal(saudacaoSemIA("Oi, qual é o preço da minha peça?"), null);
});
test("glossário público curto usa perfil econômico e bloqueia dados comerciais", () => {
  assert.equal(consultaPublicaEconomica("O que é turbocompressor?"), true);
  assert.equal(consultaPublicaEconomica("O que é turbocompressor?", 1), false);
  assert.equal(consultaPublicaEconomica("O que é CI000016?"), false);
  assert.equal(consultaPublicaEconomica("Qual o custo da bomba?"), false);
});
test("OpenRouter free usa reserva por minuto e API real para saldo diário; Groq por host exato", () => {
  const or = planoLimites("openrouter_free", null, false);
  assert.equal(or.plano, "openrouter");
  assert.equal(or.chamadas.find(x => x.tipo === "rpm")?.max, 16);
  assert.equal(or.chamadas.some(x => x.tipo === "rpd"), false);
  assert.equal(planoLimites("compativel_openai","https://api.groq.com/openai/v1",true).plano,"groq");
  assert.equal(planoLimites("compativel_openai","https://api.groq.com.evil/x",true).plano,"outro");
  assert.equal(planoLimites("compativel_openai","https://api.openai.com/v1",true).plano,"outro");
});
test("bloqueio interno por saldo reserva é feito antes de chamar RPC ou provedor", async () => {
  let n=0; const db={ rpc: async () => {n++; return {data:true,error:null};} };
  const p=planoLimites("compativel_openai","https://api.groq.com/openai/v1",false);
  await assert.rejects(reservarPassoLivre(db,"loja",p,49253,50000,0),(e:unknown)=>e instanceof IaErro&&e.status===429);
  assert.equal(n,0);
  const compacto=planoLimites("compativel_openai","https://api.groq.com/openai/v1",true);
  await reservarPassoLivre(db,"loja",compacto,49253,50000,0);
  assert.equal(n,1);
});
test("limite por modelo e loja, falha fechada e sem segredo em logs",async()=>{
  const chamadas: Record<string,unknown>[]=[];
  const db={ rpc: async (_:string,p:Record<string,unknown>)=>{chamadas.push(p);return {data:true,error:null};}};
  await reservarPassoLivre(db,"loja",planoLimites("openrouter_free",null,false),100,null,0);
  assert.equal(chamadas.length,1);
  assert.equal(chamadas[0].p_janela_s,60);
  assert.doesNotMatch(JSON.stringify(chamadas),/sk-|gsk_/);
  const falha={ rpc: async ()=>({data:false,error:null}) };
  await assert.rejects(reservarPassoLivre(falha,"loja",planoLimites("openrouter_free",null,true),0,null,0),
    (e:unknown)=>e instanceof IaErro&&e.status===429);
});

test("saldo externo OpenRouter: consulta somente-leitura e sem inferência; 0 impede próxima chamada", async () => {
  let n=0;
  const k="sk-or-v1-"+"A".repeat(28);
  const fetcher=(async (url:string|URL|Request, init?:RequestInit)=>{
    n++;
    assert.equal(String(url),"https://openrouter.ai/api/v1/key");
    assert.equal(init?.method,"GET");
    assert.equal((init?.headers as Record<string,string>).Authorization,`Bearer ${k}`);
    return new Response(JSON.stringify({data:{free_model_daily_requests:{remaining:0,used:50,limit:50}}}),{status:200});
  }) as typeof fetch;
  assert.equal(await restanteDiarioOpenRouter(k,fetcher),0);
  assert.equal(n,1);
  assert.equal(await restanteDiarioOpenRouter("invalida",fetcher),null);
  assert.equal(n,1);
});
test("cota diária externa desconhecida não é falsamente relatada como ilimitada",async()=>{
  const k="sk-or-v1-"+"A".repeat(28);
  const f=(async()=>new Response("sem dados",{status:503})) as typeof fetch;
  assert.equal(await restanteDiarioOpenRouter(k,f),null);
});
