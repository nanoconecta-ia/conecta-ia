import {test} from "node:test";
import assert from "node:assert/strict";
import {executarRodadaLifecycle,type PortaRodada,type DadosConclusao,type SnapshotGravado} from "./rodada_sync.ts";
import type {RegistroCaptura} from "./persistencia.ts";
import type {ProdutoLifecycle} from "./detector.ts";
const loja="e7000000-0000-0000-0000-000000000001",execucao="e7100000-0000-0000-0000-000000000001";
const p:ProdutoLifecycle={id:"p1",loja_id:loja,bling_id:"123",sku:"SKU",situacao:"A",nome:"Filtro",preco:100,estoque:3};
const ctx={loja,execucao,habilitada:true};
const completo={paginas:3,vistos:1,gravados:1,detalhes:1,resumosExcluidos:0,ausentes:0,completo:true};
function fake(modo:"normal"|"parcial"|"timeout_antes"|"timeout_depois"|"snapshot_divergente"|"ocupado"="normal"){
 let checkpoint:string|null=null, snapshot:SnapshotGravado|null=null, captura:RegistroCaptura|null=null;
 const chamadas:string[]=[];let dados:DadosConclusao|undefined;
 const porta:PortaRodada={
  reservar:async()=>{chamadas.push("reservar");return modo==="ocupado"?{estado:"ocupado"}:{estado:"reservado",geracao:1}},
  sincronizarProtegido:async r=>{assert.deepEqual(r,{loja,execucao,geracao:1});chamadas.push("sync");return {...completo,completo:modo!=="parcial"}},
  encerrar:async()=>{chamadas.push("encerrar");return true},
  checkpoint:async()=>checkpoint,
  snapshot:async()=>snapshot,
  captura:async()=>captura,
  projecao:async()=>({produtos:[p],total:1}),
  pausas:async()=>new Set(["p1"]),
  finalizar:async d=>{chamadas.push("finalizar");dados=d;if(modo==="timeout_antes")throw Error("timeout");checkpoint=d.registro.revisao;captura=d.registro;snapshot={loja,checkpoint,digest:modo==="snapshot_divergente"?"x":d.digest,produtos:d.produtos,execucao,geracao:1};if(modo==="timeout_depois")throw Error("timeout");return "gravado"}
 };
 return {porta,chamadas,dados:()=>dados};
}
test("rodada completa usa reserva, sync e finalização; snapshot sem campos comerciais",async()=>{const f=fake();const r=await executarRodadaLifecycle(f.porta,ctx);assert.equal(r.confirmado,true);assert.deepEqual(f.chamadas,["reservar","sync","finalizar"]);const d=f.dados()!;assert.equal(d.registro.estado,"baseline");assert.equal(d.registro.eventos.length,0);assert.ok(!("preco" in d.produtos[0])&&!("[estoque]" in d.produtos[0])&&!("estoque" in d.produtos[0]))});
test("desligado, ocupado ou parcial não finalizam",async()=>{const f=fake();assert.equal((await executarRodadaLifecycle(f.porta,{...ctx,habilitada:false})).estado,"desabilitada");assert.deepEqual(f.chamadas,[]);const o=fake("ocupado");assert.equal((await executarRodadaLifecycle(o.porta,ctx)).estado,"ocupado");assert.deepEqual(o.chamadas,["reservar"]);const s=fake("parcial");assert.equal((await executarRodadaLifecycle(s.porta,ctx)).estado,"sync_incompleta");assert.deepEqual(s.chamadas,["reservar","sync","encerrar"])});
test("timeout antes/depois: sem retry nem liberação às cegas",async()=>{for(const m of ["timeout_antes","timeout_depois"] as const){const f=fake(m);const r=await executarRodadaLifecycle(f.porta,ctx);assert.equal(r.confirmado,m==="timeout_depois");assert.deepEqual(f.chamadas,["reservar","sync","finalizar"])}});
test("snapshot divergente impede confirmação apesar de RPC gravado",async()=>{const f=fake("snapshot_divergente");assert.equal((await executarRodadaLifecycle(f.porta,ctx)).confirmado,false)});
test("checkpoint sem snapshot impede sync e libera reserva",async()=>{const f=fake();f.porta.checkpoint=async()=>"sync_0001";assert.equal((await executarRodadaLifecycle(f.porta,ctx)).estado,"predecessor_sem_snapshot");assert.deepEqual(f.chamadas,["reservar","encerrar"])});
