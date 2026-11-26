// Adaptador servidor do protocolo Lifecycle. Não é Edge Function publicada.
// A porta de sync DEVE usar gravações protegidas pelo mesmo fence; a versão
// legada do bling-sync não satisfaz esse requisito. Não ligar ao cron ainda.
import type {ResultadoSync} from "../bling_sync.ts";
import type {ProdutoLifecycle} from "./detector.ts";
import {digestTecnico,registrarSyncConcluida,type SnapshotConfirmado} from "./integracao_sync.ts";
import type {PortaCaptura,RegistroCaptura} from "./persistencia.ts";
export type Reserva={loja:string;execucao:string;geracao:number};
export type SnapshotGravado=SnapshotConfirmado&{loja:string;execucao:string;geracao:number};
export type DadosConclusao={registro:RegistroCaptura;reserva:Reserva;digest:string;produtos:ProdutoLifecycle[]};
export interface PortaRodada {
 reservar(loja:string,execucao:string):Promise<{estado:"reservado";geracao:number}|{estado:"desabilitado"|"ocupado"|"execucao_encerrada"}>;
 // Executar o sync já protegido: não chamar o legado que grava diretamente.
 sincronizarProtegido(reserva:Reserva):Promise<ResultadoSync>;
 encerrar(reserva:Reserva):Promise<boolean>;
 checkpoint(loja:string):Promise<string|null>;
 snapshot(loja:string,revisao:string):Promise<SnapshotGravado|null>;
 captura(loja:string,revisao:string):Promise<RegistroCaptura|null>;
 projecao(loja:string):Promise<{produtos:ProdutoLifecycle[];total:number}>;
 pausas(loja:string):Promise<ReadonlySet<string>>;
 finalizar(dados:DadosConclusao):Promise<string>;
}
const uuid=(s:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
const tecnico=(p:ProdutoLifecycle):ProdutoLifecycle=>({id:p.id,loja_id:p.loja_id,bling_id:p.bling_id,sku:p.sku,situacao:p.situacao,nome:p.nome??null,marca:p.marca??null,gtin:p.gtin??null,categoria_bling_id:p.categoria_bling_id??null,descricao_curta:p.descricao_curta??null,descricao_complementar:p.descricao_complementar??null,peso_kg:p.peso_kg??null,largura_cm:p.largura_cm??null,altura_cm:p.altura_cm??null,profundidade_cm:p.profundidade_cm??null,formato:p.formato??null,pai_bling_id:p.pai_bling_id??null});
export async function executarRodadaLifecycle(p:PortaRodada,ctx:{loja:string;execucao:string;habilitada:boolean}){
 const negar=(estado:string)=>({estado,confirmado:false});
 if(!ctx.habilitada)return negar("desabilitada");
 if(!uuid(ctx.loja)||!uuid(ctx.execucao))throw Error("identidade da execução inválida");
 const lease=await p.reservar(ctx.loja,ctx.execucao);
 if(lease.estado!=="reservado")return negar(lease.estado);
 if(!Number.isSafeInteger(lease.geracao)||lease.geracao<=0)return negar("geracao_invalida");
 const reserva={loja:ctx.loja,execucao:ctx.execucao,geracao:lease.geracao};
 let iniciouFinalizacao=false;
 try{
  const cp=await p.checkpoint(ctx.loja);
  const anterior=cp===null?null:await p.snapshot(ctx.loja,cp);
  if(cp!==null&&(!anterior||anterior.loja!==ctx.loja||anterior.checkpoint!==cp))return negar("predecessor_sem_snapshot");
  if(anterior&&await digestTecnico(ctx.loja,anterior.produtos)!==anterior.digest)return negar("snapshot_anterior_divergente");
  const resultado=await p.sincronizarProtegido(reserva);
  if(!resultado.completo||resultado.erro)return negar("sync_incompleta");
  const lido=await p.projecao(ctx.loja);
  if(!Number.isSafeInteger(lido.total)||lido.total!==lido.produtos.length||lido.total>5000)return negar("snapshot_incompleto");
  const depois=lido.produtos.map(tecnico);
  const pausados=await p.pausas(ctx.loja);
  const digest=await digestTecnico(ctx.loja,depois);
  // Readback confirma também snapshot, execução, geração e conteúdo, não só evento.
  const obter=async(loja:string,revisao:string)=>{
   if(loja!==ctx.loja)throw Error("escopo inválido");
   const s=await p.snapshot(loja,revisao);
   if(!s||s.loja!==loja||s.checkpoint!==revisao||s.execucao!==reserva.execucao||s.geracao!==reserva.geracao||s.digest!==digest||await digestTecnico(loja,s.produtos)!==digest)return null;
   return p.captura(loja,revisao);
  };
  const porta:PortaCaptura={
   checkpoint:loja=>{if(loja!==ctx.loja)throw Error("escopo inválido");return p.checkpoint(loja)},
   obter,
   gravar:async registro=>{
    iniciouFinalizacao=true;
    const r=await p.finalizar({registro,reserva,digest,produtos:depois});
    if(r==="gravado"||r==="ja_gravado"||r==="conflito"||r==="desabilitado")return r;
    // Respostas novas/ambíguas precisam de leitura independente, sem retry.
    throw Error("finalização não confirmada");
   }
  };
  return await registrarSyncConcluida(porta,{loja:ctx.loja,execucaoId:ctx.execucao,resultado,habilitada:true,exclusaoVerificada:true,anterior,depois,totalConfirmado:lido.total,pausados});
 }catch{
  return negar(iniciouFinalizacao?"resultado_ambiguo_reconciliar":"rodada_interrompida");
 }finally{
  // Antes de tentar finalizar, libera apenas a própria reserva.
  // Depois de uma tentativa, não repetir nem encerrar às cegas: a RPC
  // encerra atomicamente se gravou; caso contrário, expiração/reconciliação.
  if(!iniciouFinalizacao)await p.encerrar(reserva).catch(()=>false);
 }
}
