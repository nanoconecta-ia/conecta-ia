// Contrato puro de captura e encaminhamento para o pipeline existente.
// NÃO é armazenamento, transação, consumidor ou autorização de execução.
// O adaptador deve persistir eventos, bloqueios e checkpoint atomicamente e
// usar uma revisão de sync durável, criada uma vez por commit de snapshot.
import {detectarLifecycle,type ProdutoLifecycle,type Evento} from "./detector.ts";
export type EventoDuravel=Evento&{revisao:string;idempotency_key:string;destino:"pesquisa"|"revisao_inativacao";pausado_na_captura:boolean};
const token=(s:string)=>/^[A-Za-z0-9_-]{8,96}$/.test(s);
const chave=async (parts:string[])=>{
 const data=new TextEncoder().encode(JSON.stringify(parts));
 const bytes=new Uint8Array(await crypto.subtle.digest("SHA-256",data));
 return "nano-lifecycle:"+Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("");
};
const duplicado=(ps:ProdutoLifecycle[],campo:"id"|"bling_id")=>{
 const vistos=new Set<string>();
 for(const p of ps){const k=p[campo];if(!k)continue;if(vistos.has(k))return true;vistos.add(k)}return false;
};
export async function prepararCaptura(ctx:{loja:string;revisao:string;checkpoint:string|null;antes:ProdutoLifecycle[];depois:ProdutoLifecycle[];pausados:ReadonlySet<string>;completa:boolean;habilitada:boolean}){
 const vazio=(estado:string)=>({estado,revisao:ctx.revisao,checkpointEsperado:ctx.checkpoint,checkpointProposto:null as string|null,eventos:[] as EventoDuravel[],bloqueios:[] as ReturnType<typeof detectarLifecycle>["bloqueios"]});
 if(!ctx.habilitada)return vazio("desabilitada");
 if(!ctx.loja||!token(ctx.revisao)||ctx.checkpoint!==null&&!token(ctx.checkpoint))throw Error("revisao invalida");
 if([...ctx.antes,...ctx.depois].some(p=>p.loja_id!==ctx.loja))throw Error("escopo invalido");
 if(!ctx.completa)return vazio("sync_incompleta");
 if(ctx.checkpoint===ctx.revisao)return vazio("revisao_ja_capturada");
 if(duplicado(ctx.antes,"id")||duplicado(ctx.antes,"bling_id")||duplicado(ctx.depois,"id")||duplicado(ctx.depois,"bling_id"))return vazio("snapshot_ambiguo");
 const ids=new Map(ctx.depois.map(p=>[p.id,p]));
 // A sincronização precisa marcar ausência explicitamente, não sumir uma linha ativa.
 if(ctx.antes.some(p=>p.situacao==="A"&&(!ids.has(p.id)||ids.get(p.id)!.bling_id!==p.bling_id)))return vazio("identidade_ou_ausencia_a_revisar");
 // Primeiro checkpoint é uma linha de base, nunca autorização para varrer o histórico.
 if(ctx.checkpoint===null)return {...vazio("baseline"),checkpointProposto:ctx.revisao};
 // Captura inclusive mudanças em produtos pausados. O despacho será bloqueado,
 // preservando evento e versão para reavaliar após uma retomada autorizada.
 const r=detectarLifecycle(ctx.loja,ctx.antes,ctx.depois,new Set<string>(),true);
 const eventos=await Promise.all(r.eventos.map(async e=>({...e,revisao:ctx.revisao,idempotency_key:await chave([ctx.loja,e.produto_id,e.bling_id,ctx.revisao,e.tipo]),destino:e.tipo==="inativado"?"revisao_inativacao" as const:"pesquisa" as const,pausado_na_captura:ctx.pausados.has(e.produto_id)})));
 return {...vazio("pronto_para_transacao"),checkpointProposto:ctx.revisao,eventos,bloqueios:r.bloqueios};
}
export interface ItemPipeline {id:string;loja_id:string;produto_id:string|null;sku:string|null;idempotency_key:string;estado:string}
const TERMINAIS=new Set(["sincronizado","rejeitado","falhou"]);
// A leitura de revisão atual deve vir do checkpoint por produto, não da revisão
// global (uma mudança em outro SKU não torna este evento obsoleto).
export function planejarEncaminhamento(e:EventoDuravel,ctx:{loja:string;atual:ProdutoLifecycle|null;revisaoTecnicaAtual:string|null;pausado:boolean;habilitado:boolean;orcamentoDisponivel:boolean;identidadeVerificada:boolean;itens:readonly ItemPipeline[]}){
 const negar=(motivo:string)=>({acao:"reter" as const,motivo});
 if(e.loja_id!==ctx.loja||ctx.itens.some(i=>i.loja_id!==ctx.loja))throw Error("escopo invalido");
 if(!ctx.habilitado)return negar("desabilitado");
 if(!ctx.atual||ctx.atual.loja_id!==ctx.loja||ctx.atual.id!==e.produto_id||ctx.atual.bling_id!==e.bling_id||ctx.atual.sku?.trim()!==e.sku||!ctx.identidadeVerificada)return negar("identidade_a_revisar");
 if(ctx.revisaoTecnicaAtual!==e.revisao)return negar("revisao_obsoleta_a_reconciliar");
 if(e.destino==="revisao_inativacao"||e.tipo==="inativado")return {acao:"revisar_inativacao" as const,motivo:"sem_pesquisa_ou_publicacao"};
 if(ctx.atual.situacao!=="A")return negar("inativo");
 if(ctx.pausado)return negar("pausado");
 const iguais=ctx.itens.filter(i=>i.idempotency_key===e.idempotency_key);
 if(iguais.length>1||iguais.some(i=>i.produto_id!==e.produto_id||i.sku!==e.sku))return negar("conflito_idempotencia");
 if(iguais.length===1)return {acao:"vincular_existente" as const,itemId:iguais[0].id,estado:iguais[0].estado};
 if(ctx.itens.some(i=>!TERMINAIS.has(i.estado)&&(i.produto_id===e.produto_id||i.sku?.trim().toUpperCase()===e.sku.toUpperCase())))return negar("pipeline_ativo_aguardar");
 if(!ctx.orcamentoDisponivel)return negar("orcamento_indisponivel");
 // Minuta de chamada RPC; não é escrita. Transação/adaptador revalida tudo,
 // verifica o item retornado e nunca marca evento entregue por retorno ambíguo.
 return {acao:"propor_pipeline" as const,rpc:{p_loja:ctx.loja,p_sku:e.sku,p_produto:e.produto_id,p_entrada:{origem:"nano_lifecycle",revisao:e.revisao,tipo:e.tipo,campos:e.campos},p_idem:e.idempotency_key}};
}
