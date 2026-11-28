// Adaptador de captura: o checkpoint só é considerado avançado após confirmação
// e leitura independente do registro transacional. Não despacha pesquisa.
// O chamador deve entregar snapshots consistentes de uma sincronização serializada.
import {prepararCaptura,type EventoDuravel} from "./captura.ts";
export type PlanoCaptura=Awaited<ReturnType<typeof prepararCaptura>>;
export type RegistroCaptura={loja:string;revisao:string;checkpointAnterior:string|null;estado:"baseline"|"pronto_para_transacao";eventos:EventoDuravel[];bloqueios:PlanoCaptura["bloqueios"]};
export interface PortaCaptura {
 checkpoint(loja:string):Promise<string|null>;
 // Operação atômica CAS: registrar revisão, eventos, bloqueios e checkpoint.
 gravar(registro:RegistroCaptura):Promise<"gravado"|"ja_gravado"|"conflito"|"desabilitado">;
 obter(loja:string,revisao:string):Promise<RegistroCaptura|null>;
}
function igual(a:RegistroCaptura,b:RegistroCaptura):boolean{
 const eventos=(r:RegistroCaptura)=>r.eventos.map(e=>JSON.stringify([e.idempotency_key,e.produto_id,e.loja_id,e.bling_id,e.sku,e.revisao,e.tipo,e.destino,e.pausado_na_captura,[...e.campos].sort()])).sort();
 const bloqueios=(r:RegistroCaptura)=>r.bloqueios.map(x=>JSON.stringify([x.produto_id,x.motivo])).sort();
 return a.loja===b.loja&&a.revisao===b.revisao&&a.checkpointAnterior===b.checkpointAnterior&&a.estado===b.estado&&JSON.stringify(eventos(a))===JSON.stringify(eventos(b))&&JSON.stringify(bloqueios(a))===JSON.stringify(bloqueios(b));
}
export async function registrarCaptura(porta:PortaCaptura,ctx:Omit<Parameters<typeof prepararCaptura>[0],"checkpoint">&{checkpointEsperado?:string|null}){
 if(!ctx.habilitada)return {estado:"desabilitada",confirmado:false};
 if(!ctx.completa)return {estado:"sync_incompleta",confirmado:false};
 const checkpoint=await porta.checkpoint(ctx.loja);
 if(checkpoint===ctx.revisao){
  const existente=await porta.obter(ctx.loja,ctx.revisao);
  if(!existente||existente.loja!==ctx.loja||existente.revisao!==ctx.revisao)return {estado:"reconciliar_checkpoint",confirmado:false};
  // Reconstruir o plano com o predecessor persistido para detectar reuso indevido
  // da mesma revisão com snapshots diferentes.
  if(ctx.checkpointEsperado!==undefined&&existente.checkpointAnterior!==ctx.checkpointEsperado)return {estado:"checkpoint_divergente",confirmado:false};
  const plano=await prepararCaptura({...ctx,checkpoint:existente.checkpointAnterior});
  if(plano.estado!=="baseline"&&plano.estado!=="pronto_para_transacao")return {estado:"reconciliar_checkpoint",confirmado:false};
  const esperado:RegistroCaptura={loja:ctx.loja,revisao:ctx.revisao,checkpointAnterior:existente.checkpointAnterior,estado:plano.estado,eventos:plano.eventos,bloqueios:plano.bloqueios};
  return igual(existente,esperado)?{estado:"ja_confirmado",confirmado:true,eventos:esperado.eventos.length,bloqueios:esperado.bloqueios.length}:{estado:"revisao_divergente",confirmado:false};
 }
 if(ctx.checkpointEsperado!==undefined&&checkpoint!==ctx.checkpointEsperado)return {estado:"checkpoint_divergente",confirmado:false};
 const plano=await prepararCaptura({...ctx,checkpoint});
 if(plano.estado!=="baseline"&&plano.estado!=="pronto_para_transacao")return {estado:plano.estado,confirmado:false};
 const registro:RegistroCaptura={loja:ctx.loja,revisao:ctx.revisao,checkpointAnterior:checkpoint,estado:plano.estado,eventos:plano.eventos,bloqueios:plano.bloqueios};
 try{
  const r=await porta.gravar(registro);
  if(r==="conflito"||r==="desabilitado")return {estado:r,confirmado:false};
 }catch{
  // Timeout pode significar commit efetuado: jamais repetir gravação às cegas.
  const lido=await porta.obter(ctx.loja,ctx.revisao).catch(()=>null);
  const atual=await porta.checkpoint(ctx.loja).catch(()=>null);
  return lido&&igual(lido,registro)&&atual===ctx.revisao?{estado:"confirmado_por_leitura",confirmado:true,eventos:registro.eventos.length,bloqueios:registro.bloqueios.length}:{estado:"resultado_ambiguo_reconciliar",confirmado:false};
 }
 const lido=await porta.obter(ctx.loja,ctx.revisao);
 const atual=await porta.checkpoint(ctx.loja);
 if(!lido||!igual(lido,registro)||atual!==ctx.revisao)return {estado:"resultado_ambiguo_reconciliar",confirmado:false};
 return {estado:"confirmado",confirmado:true,eventos:registro.eventos.length,bloqueios:registro.bloqueios.length};
}
