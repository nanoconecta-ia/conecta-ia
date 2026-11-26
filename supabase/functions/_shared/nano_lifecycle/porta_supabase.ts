// Adaptador concreto do transporte RPC Supabase, somente servidor.
// NÃO expõe service_role, não instancia cliente público, não executa sync legado.
// O callback protegido ainda deve ser implementado e homologado com os escritores.
import type {PortaRodada,Reserva,DadosConclusao,SnapshotGravado} from "./rodada_sync.ts";
import type {RegistroCaptura} from "./persistencia.ts";
import type {ProdutoLifecycle} from "./detector.ts";
import type {ResultadoSync} from "../bling_sync.ts";
export type RpcServidor={rpc(nome:string,args:Record<string,unknown>):PromiseLike<{data:unknown;error:unknown}>};
const obj=(x:unknown):Record<string,unknown>=>{if(!x||typeof x!=="object"||Array.isArray(x))throw Error("resposta RPC inválida");return x as Record<string,unknown>};
const str=(x:unknown):string=>{if(typeof x!=="string"||!x)throw Error("campo RPC inválido");return x};
const nstr=(x:unknown):string|null=>x===null?null:str(x);
const inteiro=(x:unknown):number=>{if(typeof x!=="number"||!Number.isSafeInteger(x)||x<0)throw Error("inteiro RPC inválido");return x};
const lista=(x:unknown):unknown[]=>{if(!Array.isArray(x)||x.length>5000)throw Error("lista RPC inválida");return x};
const escopo=(x:Record<string,unknown>,loja:string)=>{if(x.loja_id!==loja)throw Error("escopo RPC inválido")};
const CAMPOS=["id","loja_id","bling_id","sku","situacao","nome","marca","gtin","categoria_bling_id","descricao_curta","descricao_complementar","peso_kg","largura_cm","altura_cm","profundidade_cm","formato","pai_bling_id"] as const;
const NUM=new Set(["peso_kg","largura_cm","altura_cm","profundidade_cm"]);
function produtos(x:unknown,loja:string):ProdutoLifecycle[]{
 const ps=lista(x).map(v=>{
  const p=obj(v);escopo(p,loja);
  if(Object.keys(p).length!==CAMPOS.length||CAMPOS.some(k=>!Object.hasOwn(p,k)))throw Error("projeção fora do contrato");
  for(const k of CAMPOS){const a=p[k];if(a===null&&k!=="id"&&k!=="loja_id")continue;if(NUM.has(k)?typeof a!=="number"||!Number.isFinite(a):typeof a!=="string")throw Error("campo da projeção inválido")}
  str(p.id);
  return p as unknown as ProdutoLifecycle;
 });
 if(new Set(ps.map(p=>p.id)).size!==ps.length)throw Error("identidade repetida");
 return ps;
}
export function criarPortaSupabase(admin:RpcServidor,syncProtegido:(reserva:Reserva)=>Promise<ResultadoSync>):PortaRodada{
 const rpc=async(nome:string,args:Record<string,unknown>)=>{const r=await admin.rpc(nome,args);if(r.error)throw Error("falha RPC Lifecycle: "+nome);return r.data};
 const ler=(loja:string,tipo:string,revisao:string|null=null)=>rpc("nano_lifecycle_ler",{p_loja:loja,p_tipo:tipo,p_revisao:revisao});
 const fence=(r:Reserva)=>({p_loja:r.loja,p_execucao:r.execucao,p_geracao:r.geracao});
 return {
  async reservar(loja,execucao){
   const d=obj(await rpc("nano_lifecycle_reservar",{p_loja:loja,p_execucao:execucao,p_segundos:180}));
   if(d.estado==="reservado"){const geracao=inteiro(d.geracao);if(geracao===0)throw Error("geração inválida");return {estado:"reservado",geracao}}
   if(d.estado==="ocupado"||d.estado==="desabilitado"||d.estado==="execucao_encerrada")return {estado:d.estado};
   throw Error("estado de reserva inválido");
  },
  sincronizarProtegido:syncProtegido,
  async encerrar(r){const d=await rpc("nano_lifecycle_encerrar_reserva",fence(r));if(typeof d!=="boolean")throw Error("encerramento inválido");return d},
  async checkpoint(loja){const d=obj(await ler(loja,"checkpoint"));escopo(d,loja);if(d.habilitado!==true)throw Error("checkpoint desabilitado");return nstr(d.revisao)},
  async snapshot(loja,revisao):Promise<SnapshotGravado|null>{
   const x=await ler(loja,"snapshot",revisao);if(x===null)return null;const d=obj(x);escopo(d,loja);if(d.revisao!==revisao)throw Error("revisão divergente");
   const digest=str(d.digest);if(!/^[0-9a-f]{64}$/.test(digest))throw Error("digest inválido");const geracao=inteiro(d.geracao);if(geracao===0)throw Error("geração inválida");
   return {loja,checkpoint:revisao,digest,execucao:str(d.execucao),geracao,produtos:produtos(d.produtos,loja)};
  },
  async captura(loja,revisao):Promise<RegistroCaptura|null>{
   const x=await ler(loja,"captura",revisao);if(x===null)return null;const d=obj(x);escopo(d,loja);if(d.revisao!==revisao||d.estado!=="baseline"&&d.estado!=="pronto_para_transacao")throw Error("captura divergente");
   const eventos=lista(d.eventos).map(v=>{const e=obj(v);escopo(e,loja);if(e.revisao!==revisao||typeof e.pausado_na_captura!=="boolean"||!Array.isArray(e.campos)||e.campos.some(c=>typeof c!=="string"))throw Error("evento inválido");for(const k of ["produto_id","bling_id","sku","tipo","destino","idempotency_key"])str(e[k]);return e}) as unknown as RegistroCaptura["eventos"];
   const bloqueios=lista(d.bloqueios).map(v=>{const b=obj(v);str(b.produto_id);str(b.motivo);return b}) as unknown as RegistroCaptura["bloqueios"];
   return {loja,revisao,checkpointAnterior:nstr(d.predecessor),estado:d.estado,eventos,bloqueios};
  },
  async projecao(loja){const d=obj(await ler(loja,"projecao"));escopo(d,loja);const ps=produtos(d.produtos,loja),total=inteiro(d.total);if(ps.length!==total)throw Error("projeção truncada");return {produtos:ps,total}},
  async pausas(loja){const d=obj(await ler(loja,"pausas"));escopo(d,loja);const ids=lista(d.produtos).map(str);if(new Set(ids).size!==ids.length||ids.length!==inteiro(d.total))throw Error("pausas truncadas");return new Set(ids)},
  async finalizar(d:DadosConclusao){const {registro:r,reserva:s}=d;if(r.loja!==s.loja)throw Error("escopo da finalização inválido");produtos(d.produtos,s.loja);
   return str(await rpc("nano_lifecycle_finalizar",{...fence(s),p_revisao:r.revisao,p_predecessor:r.checkpointAnterior,p_estado:r.estado,p_eventos:r.eventos,p_bloqueios:r.bloqueios,p_digest:d.digest,p_produtos:d.produtos}));
  }
 };
}
