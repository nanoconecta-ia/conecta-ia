// Integração entre conclusão de varredura e porta de persistência.
// Não lê o espelho por conta própria: requer snapshot anterior persistido e
// snapshot concluído sob exclusão mútua de todos os escritores do espelho.
// Esses requisitos ainda dependem do adaptador de infraestrutura. Sem isso
// o chamador não pode certificar a rodada e nenhuma captura é realizada.
import type {ProdutoLifecycle} from "./detector.ts";
import type {ResultadoSync} from "../bling_sync.ts";
import {registrarCaptura,type PortaCaptura} from "./persistencia.ts";
const CAMPOS=["id","loja_id","bling_id","sku","situacao","nome","marca","gtin","categoria_bling_id","descricao_curta","descricao_complementar","peso_kg","largura_cm","altura_cm","profundidade_cm","formato","pai_bling_id"] as const;
const hex=async(v:unknown)=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(JSON.stringify(v)))),b=>b.toString(16).padStart(2,"0")).join("");
/** Hash da projeção técnica, não do JSON integral do ERP. Ordem de linhas não interfere. */
export async function digestTecnico(loja:string,ps:readonly ProdutoLifecycle[]){
 if(!loja||ps.some(p=>p.loja_id!==loja||!p.id))throw Error("snapshot fora do escopo");
 if(new Set(ps.map(p=>p.id)).size!==ps.length)throw Error("identidade repetida");
 const linhas=ps.map(p=>CAMPOS.map(c=>{const v=p[c];if(typeof v==="number"&&!Number.isFinite(v))throw Error("campo numérico inválido");return typeof v==="string"?v.trim()||null:v??null;})).sort((a,b)=>String(a[0])<String(b[0])?-1:String(a[0])>String(b[0])?1:0);
 return hex(["nano-snapshot-v1",loja,linhas]);
}
export type SnapshotConfirmado={checkpoint:string;digest:string;produtos:ProdutoLifecycle[]};
export async function registrarSyncConcluida(porta:PortaCaptura,ctx:{
 loja:string;execucaoId:string;resultado:ResultadoSync;habilitada:boolean;
 // Gerado pelo servidor ao adquirir e manter lease/fencing dos escritores.
 // Não aceitar esta flag de entrada de agente ou usuário.
 exclusaoVerificada:boolean;anterior:SnapshotConfirmado|null;depois:ProdutoLifecycle[];
 totalConfirmado:number;pausados:ReadonlySet<string>;
}){
 const negar=(estado:string)=>({estado,confirmado:false});
 if(!ctx.habilitada)return negar("desabilitada");
 if(!ctx.resultado.completo||ctx.resultado.erro)return negar("sync_incompleta");
 if(!ctx.exclusaoVerificada)return negar("exclusao_nao_verificada");
 if(!/^[a-zA-Z0-9_-]{8,96}$/.test(ctx.execucaoId)||!Number.isSafeInteger(ctx.totalConfirmado)||ctx.totalConfirmado!==ctx.depois.length)return negar("snapshot_incompleto");
 const antes=ctx.anterior?.produtos??[];
 const digestAnterior=await digestTecnico(ctx.loja,antes);
 if(ctx.anterior&&digestAnterior!==ctx.anterior.digest)return negar("snapshot_anterior_divergente");
 const digest=await digestTecnico(ctx.loja,ctx.depois);
 // Vincula baseline e sucessores ao conteúdo técnico E à identidade durável
 // da execução: o mesmo estado pode voltar depois de uma mudança legítima.
 const predecessor=ctx.anterior?.checkpoint??null;
 const revisao="sync_"+await hex([ctx.loja,ctx.execucaoId,predecessor,digestAnterior,digest]);
 const resultado=await registrarCaptura(porta,{loja:ctx.loja,revisao,checkpointEsperado:predecessor,antes,depois:ctx.depois,pausados:ctx.pausados,completa:true,habilitada:true});
 return {...resultado,revisao,digest};
}
