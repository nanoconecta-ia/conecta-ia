/**
 * Host de homologação Cloudflare, isolado: SOMENTE fixtures e duas credenciais de teste.
 * NÃO importar Bling, clientes Supabase reais, custos ou dados de fornecedores.
 * Worker pai chama por Service Binding privado. Não expor este Worker no workers.dev.
 * Replay, rate-limit e auditoria: Durable Object SQLite persistente.
 */
import { verificarBridge, BRIDGE_PATH } from "../src/bridge-auth.mjs";
import { criarAdaptadorCodeModeLeitura } from "../../../supabase/functions/_shared/conector/codemode_bridge.ts";

type Chave = "hml-a" | "hml-b";
interface Env {
  STAGING_HMAC_A?: string;
  STAGING_HMAC_B?: string;
  STAGING_REVOKED_A?: string;
  STAGING_REVOKED_B?: string;
  REPLAY_AUDITORIA: DurableObjectNamespace;
}
const LOJAS: Record<Chave,{id:string;uid:string}> = {
  "hml-a": {id:"aaaaaaaa-0000-0000-0000-000000000001",uid:"11111111-1111-1111-1111-111111111111"},
  "hml-b": {id:"bbbbbbbb-0000-0000-0000-000000000002",uid:"22222222-2222-2222-2222-222222222222"},
};
const resposta = (status: number, body: Record<string,unknown>) =>
  new Response(JSON.stringify(body), {status,headers:{"content-type":"application/json","cache-control":"no-store","x-content-type-options":"nosniff"}});
function chave(env:Env,kid:string):{secret:string;ativa:boolean}|null {
  if(kid !== "hml-a" && kid !== "hml-b")return null;
  const secret = kid === "hml-a" ? env.STAGING_HMAC_A : env.STAGING_HMAC_B;
  const revoked = kid === "hml-a" ? env.STAGING_REVOKED_A : env.STAGING_REVOKED_B;
  return typeof secret === "string" ? {secret,ativa:revoked !== "true"} : null;
}
const sinteticos = (kid:Chave) => kid === "hml-a"
  ? [{sku:"FIX-HML-A-01",nome:"Peça fictícia A",fornecedor:"INTERNO_NUNCA_RETORNAR",precoCusto:99},
     {sku:"FIX-HML-A-02",nome:"Peça fictícia A2",estoque:2}]
  : [{sku:"FIX-HML-B-01",nome:"Peça fictícia B",ncm:"00000000",precoCusto:77}];

/** Um Durable Object por chave de laboratório. Não guarda segredos nem payloads. */
export class ReplayAuditoriaHml {
  constructor(private readonly state: DurableObjectState) {
    this.state.storage.sql.exec(`CREATE TABLE IF NOT EXISTS nonces(nonce TEXT PRIMARY KEY, exp INTEGER NOT NULL);`);
    this.state.storage.sql.exec(`CREATE TABLE IF NOT EXISTS quota(minuto INTEGER PRIMARY KEY, total INTEGER NOT NULL);`);
    this.state.storage.sql.exec(`CREATE TABLE IF NOT EXISTS auditoria(id TEXT PRIMARY KEY, momento INTEGER NOT NULL, ferramenta TEXT NOT NULL, status TEXT NOT NULL);`);
  }
  async fetch(request:Request):Promise<Response> {
    const url=new URL(request.url);
    if(request.method !== "POST")return resposta(405,{erro:"metodo"});
    let dados:Record<string,unknown>;
    try { dados=await request.json() as Record<string,unknown>; }
    catch { return resposta(400,{erro:"corpo"}); }
    if(url.pathname === "/nonce") {
      const nonce=dados.nonce, exp=dados.exp;
      if(typeof nonce!=="string" || !/^[0-9a-fA-F-]{36}$/.test(nonce) ||
         typeof exp!=="number" || !Number.isSafeInteger(exp) ||
         exp < Date.now()-30_000 || exp > Date.now()+90_000)
        return resposta(400,{erro:"nonce"});
      const now=Date.now(), minuto=Math.floor(now/60000);
      const result=this.state.storage.transactionSync(()=>{
        // Operações sem await no mesmo SQLite; INSERT OR IGNORE é atômico.
        this.state.storage.sql.exec("DELETE FROM nonces WHERE exp < ?",now);
        this.state.storage.sql.exec("DELETE FROM quota WHERE minuto < ?",minuto-2);
        const r=this.state.storage.sql.exec("INSERT OR IGNORE INTO nonces(nonce,exp) VALUES(?,?)",nonce,exp);
        if(r.rowsWritten===0)return {repeticao:true,limitado:false};
        const q=this.state.storage.sql.exec(
          "INSERT INTO quota(minuto,total) VALUES(?,1) ON CONFLICT(minuto) DO UPDATE SET total=total+1 WHERE total<60",minuto);
        return {repeticao:false,limitado:q.rowsWritten===0};
      });
      return resposta(200,result);
    }
    if(url.pathname === "/audit") {
      const id=dados.id, ferramenta=dados.ferramenta, status=dados.status;
      if(typeof id!=="string" || !/^[0-9a-fA-F-]{36}$/.test(id) ||
         typeof ferramenta!=="string" || !["conecta.catalogo.resumo","conecta.catalogo.listar"].includes(ferramenta) ||
         status!=="permitida")return resposta(400,{erro:"auditoria"});
      const r=this.state.storage.sql.exec("INSERT OR IGNORE INTO auditoria(id,momento,ferramenta,status) VALUES(?,?,?,?)",id,Date.now(),ferramenta,status);
      return resposta(r.rowsWritten===1?200:409,{ok:r.rowsWritten===1});
    }
    return resposta(404,{erro:"rota"});
  }
}
const enviarDO=async(stub:DurableObjectStub,path:string,body:Record<string,unknown>)=>{
  const r=await stub.fetch("https://staging-internal.invalid"+path,{method:"POST",
    headers:{"content-type":"application/json"},body:JSON.stringify(body)});
  if(!r.ok)throw Error("armazenamento_indisponivel");
  return await r.json() as Record<string,unknown>;
};
export default {
  async fetch(req:Request,env:Env):Promise<Response>{
    const url=new URL(req.url);
    if(req.method!=="POST" || url.pathname!==BRIDGE_PATH)return resposta(404,{erro:"nao_encontrado"});
    if(!env?.REPLAY_AUDITORIA)return resposta(503,{erro:"homologacao_nao_configurada"});
    // Tamanho máximo controlado antes de parse/cálculos.
    const tamanho=Number(req.headers.get("content-length")??"0");
    if(tamanho>4096)return resposta(413,{erro:"limite"});
    let corpo:string;
    try { corpo=await req.text(); if(new TextEncoder().encode(corpo).length>4096)return resposta(413,{erro:"limite"}); }
    catch {return resposta(400,{erro:"corpo"});}
    let excedeu=false;
    const auth=await verificarBridge({
      method:req.method,path:url.pathname,headers:req.headers,corpo,
      buscarChave:async (kid:string)=>chave(env,kid),
      replay:async (kid:string,nonce:string,exp:number)=>{
        if(kid!=="hml-a"&&kid!=="hml-b")return true;
        const stub=env.REPLAY_AUDITORIA.get(env.REPLAY_AUDITORIA.idFromName("nanoia-hml:"+kid));
        const check=await enviarDO(stub,"/nonce",{nonce,exp});
        excedeu=check.limitado===true;
        return check.repeticao===true || excedeu;
      },
    }).catch(()=>({ok:false,motivo:"verificacao_indisponivel"}));
    if(!auth.ok)return resposta(excedeu?429:401,{erro:excedeu?"limite":"nao_autorizado"});
    const kid=auth.keyId as Chave, ident=LOJAS[kid];
    if(!ident)return resposta(401,{erro:"nao_autorizado"});
    let payload:{operacao?:unknown;args?:unknown};
    try {payload=JSON.parse(corpo);}
    catch {return resposta(400,{erro:"corpo"});}
    if(!payload || !["catalogo_resumo","catalogo_listar"].includes(payload.operacao as string))
      return resposta(403,{erro:"operacao"});
    const stub=env.REPLAY_AUDITORIA.get(env.REPLAY_AUDITORIA.idFromName("nanoia-hml:"+kid));
    const itens=sinteticos(kid);
    const identidade={chave_id:kid,loja_id:ident.id,escopos:["leitura"] as const};
    const ctx={
      origem:"gateway_mcp" as const,lojaId:ident.id,userId:ident.uid,mcpChaveId:kid,escopos:["leitura"],
      dados:{
        resumo:async()=>({produtos:itens.length,publicados:0,aguardando_aprovacao:0,precoCusto:300}),
        listarProdutos:async (args:{busca?:string;limite?:number}={})=>itens
          .filter(v=>!args.busca||v.sku.includes(args.busca)||v.nome.includes(args.busca))
          .slice(0,args.limite??10),
      },
      rpc:async(nome:string)=>{
        if(nome!=="agente_chamada_registrar")return {error:{message:"rpc_nao_permitida"}};
        const operacao=payload.operacao==="catalogo_resumo"?"conecta.catalogo.resumo":"conecta.catalogo.listar";
        try {
          await enviarDO(stub,"/audit",{id:crypto.randomUUID(),ferramenta:operacao,status:"permitida"});
          return {data:true,error:null};
        }catch{return {data:null,error:{message:"auditoria_indisponivel"}};}
      },
    };
    try {
      const adaptador=criarAdaptadorCodeModeLeitura({
        identidade,contexto:ctx as any,
        revalidarChave:async()=>chave(env,kid)?.ativa===true?identidade:null,
      });
      const resultado=await adaptador.executar(payload.operacao as string,payload.args);
      return resposta(200,{ok:true,resultado});
    }catch(e) {
      // Log de código conhecido e fixo. Nunca registrar entrada, SKU, URL ou secrets.
      const codigo=e instanceof Error?e.message:"interno";
      const conhecidos=new Set(["auditoria_nao_confirmada","operacao_nao_autorizada_ou_falhou","chave_revogada_ou_sem_escopo",
        "resposta_cadastro_invalida","operacao_falhou","argumento_invalido","identidade_invalida","tempo_total_esgotado"]);
      console.warn("hml_consulta_recusada",conhecidos.has(codigo)?codigo:"interno");
      return resposta(403,{erro:"operacao_recusada"});
    }
  },
};
