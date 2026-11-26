import {test} from "node:test";
import assert from "node:assert/strict";
import {sincronizarComReserva,type LeituraBling} from "./sync_protegido.ts";
import type {RpcServidor} from "./porta_supabase.ts";
import type {GrupoLista,Existente,ItemLista} from "../bling_sync.ts";
const loja="loja-teste",reserva={loja,execucao:"execucao-teste",geracao:1};
const item={id:123,nome:"Filtro",codigo:"SKU1",situacao:"A",preco:10,estoque:{saldoVirtualTotal:3}};
function fixture(opts:{falha?:boolean;duplicado?:boolean;ausente?:boolean;detalheErrado?:boolean;retornoParcial?:boolean;candidatoErrado?:boolean}={}){
 const chamadas:{nome:string;args:Record<string,unknown>}[]=[];
 const existentes:Existente[]=opts.ausente?[{bling_id:"456",sku:"SKU2",nome:"Ausente",preco:20,estoque:4,situacao:"A",sincronizado_em:null}]:[];
 const origem:LeituraBling={
  existentes:async()=>existentes,
  listarPagina:async(_p,_l,g?:GrupoLista)=>g==="inativos"&&opts.falha?{erro:"falha ERP"}:{itens:g==="ativos"?[item]:g==="inativos"&&opts.duplicado?[{...item,situacao:"I"}]:[]},
  detalhe:async id=>({...item,id:opts.detalheErrado?id+1:id,marca:"Marca"}),
  registrarErro:async()=>{},espera:async()=>{},agora:()=>Date.parse("2026-11-26T12:00:00Z")
 };
 const admin:RpcServidor={rpc:async(nome,args)=>{
  chamadas.push({nome,args});
  if(nome==="nano_lifecycle_gravar_espelho")return {data:opts.retornoParcial?0:(args.p_linhas as unknown[]).length,error:null};
  if(nome==="nano_lifecycle_registrar_varredura")return {data:{estado:"registrada",candidatos:opts.ausente?[{bling_id:opts.candidatoErrado?"789":"456",produto_id:"p2"}]:[]},error:null};
  throw Error("RPC inesperada")
 }};
 return {origem,admin,chamadas};
}
test("varredura completa usa lote integral e evidencia três grupos mesmo sem ausentes",async()=>{
 const f=fixture();const r=await sincronizarComReserva(f.admin,f.origem,reserva);
 assert.equal(r.completo,true);assert.equal(r.ausentes,0);
 assert.deepEqual(f.chamadas.map(x=>x.nome),["nano_lifecycle_gravar_espelho","nano_lifecycle_registrar_varredura"]);
 assert.deepEqual(f.chamadas[1].args.p_grupos,{ativos:[["123"]],inativos:[[]],excluidos:[[]]});
 assert.equal(f.chamadas[0].args.p_geracao,1);
 const l=(f.chamadas[0].args.p_linhas as Record<string,unknown>[])[0];
 assert.equal(Object.keys(l).length,23);assert.equal(l.preco,10);assert.ok(!("publicado" in l)&&!("custo" in l))
});
test("falha ou duplicidade interrompe antes da evidência",async()=>{
 for(const opts of [{falha:true},{duplicado:true}]){const f=fixture(opts);assert.equal((await sincronizarComReserva(f.admin,f.origem,reserva)).completo,false);assert.ok(!f.chamadas.some(x=>x.nome==="nano_lifecycle_registrar_varredura"))}
});
test("ausência registra candidato sem gravar ausência e retém conclusão",async()=>{
 const f=fixture({ausente:true});const r=await sincronizarComReserva(f.admin,f.origem,reserva);assert.equal(r.completo,false);assert.equal(r.erro,"ausencias_pendentes_de_revisao");assert.equal(r.ausentes,0);assert.equal(f.chamadas.at(-1)?.nome,"nano_lifecycle_registrar_varredura")
});
test("detalhe errado, lote parcial ou candidato divergente falham fechados",async()=>{
 for(const opts of [{detalheErrado:true},{retornoParcial:true},{ausente:true,candidatoErrado:true}]){const f=fixture(opts);await assert.rejects(sincronizarComReserva(f.admin,f.origem,reserva))}
});
test("lista com situação errada ou página maior que 100 não é aceita",async()=>{
 for(const itens of [[{...item,situacao:"I"}],Array.from({length:101},(_,i)=>({...item,id:i+1}))] as ItemLista[][]){const f=fixture();f.origem.listarPagina=async()=>({itens});assert.equal((await sincronizarComReserva(f.admin,f.origem,reserva)).completo,false);assert.equal(f.chamadas.length,0)}
});
