import {test} from "node:test";
import assert from "node:assert/strict";
import {prepararEntradaEngenharia,persistirResultadoEngenharia,recuperarReciboEngenharia} from "./entrada_engenharia.ts";
const reserva={loja:"ed000000-0000-0000-0000-000000000001",item:"ed100000-0000-0000-0000-000000000001",execucao:"ed200000-0000-0000-0000-000000000001",geracao:3,versao:1};
const dados={estado:"preparada",loja_id:reserva.loja,item_id:reserva.item,execucao:reserva.execucao,geracao:3,versao:1,revisao:"sync_0002",checkpoint:"sync_0002",produto:{id:"ed300000-0000-0000-0000-000000000001",bling_id:"123",sku:"NANO-TESTE",nome:"Motor parcial HR D4CB Euro 5 2014",marca:"Tringo",gtin:null,descricao_curta:"OEM 28113-4F000",descricao_complementar:"NÃO SE APLICA: D4BH Euro 3."}};
const rpc=(data:unknown,error:unknown=null)=>({rpc:async()=>({data,error})});
test("reusa extrator: OEM candidato, ano literal, exclusão e marca separados",async()=>{
 const r=await prepararEntradaEngenharia(rpc(dados),reserva);
 assert.equal(r.estado,"preparada");if(r.estado!=="preparada")throw Error("estado");
 assert.equal(r.homologada,false);assert.equal(r.extracao.marca_fabricante,"Tringo");
 assert.ok(r.extracao.codigos_oem.some(c=>c.normalizado==="28113-4F000"));
 assert.deepEqual(r.extracao.aplicacao.motores,["D4CB"]);assert.deepEqual(r.extracao.excluido.motores,["D4BH"]);
 assert.equal(r.extracao.aplicacao.anos_informados[0].inicio,2014);assert.equal(r.extracao.aplicacao.anos_informados[0].fim,null);
});
test("recusa retorno comercial e campos estranhos",async()=>{
 await assert.rejects(prepararEntradaEngenharia(rpc({...dados,produto:{...dados.produto,preco:10}}),reserva));
});
test("recusa escopo e geração divergentes",async()=>{
 for(const x of [{...dados,loja_id:reserva.item},{...dados,geracao:2}])await assert.rejects(prepararEntradaEngenharia(rpc(x),reserva));
});
test("retém pausa e reserva expirada; falha desconhecida não vira sucesso",async()=>{
 assert.deepEqual(await prepararEntradaEngenharia(rpc({estado:"pausado"}),reserva),{estado:"retida",motivo:"pausado"});
 assert.deepEqual(await prepararEntradaEngenharia(rpc({estado:"reserva_invalida"}),reserva),{estado:"retida",motivo:"reserva_invalida"});
 await assert.rejects(prepararEntradaEngenharia(rpc({estado:"qualquer"}),reserva));
 await assert.rejects(prepararEntradaEngenharia(rpc(null,{message:"falha"}),reserva));
});

test("persiste extração do snapshot com a mesma reserva e recebe somente recibo não homologado",async()=>{
 const calls:{nome:string,args:Record<string,unknown>}[]=[];
 const admin={rpc:async(nome:string,args:Record<string,unknown>)=>{calls.push({nome,args});return {data:calls.length===1?dados:{estado:"gravado",hash_entrada:"a".repeat(64),hash_extracao:"b".repeat(64),homologada:false},error:null}}};
 const r=await persistirResultadoEngenharia(admin,reserva);
 assert.equal(r.estado,"gravado");assert.equal(calls.length,2);
 assert.equal(calls[1].nome,"nano_lifecycle_persistir_engenharia");
 assert.deepEqual(calls[1].args.p_entrada,dados);assert.equal(calls[1].args.p_geracao,3);
 const e=calls[1].args.p_extracao as {aplicacao:{motores:string[]}};
 assert.deepEqual(e.aplicacao.motores,["D4CB"]);
});
test("não grava se leitura retida; recusa recibo que promete homologação",async()=>{
 assert.deepEqual(await persistirResultadoEngenharia(rpc({estado:"pausado"}),reserva),{estado:"retida",motivo:"pausado"});
 let n=0;await assert.rejects(persistirResultadoEngenharia({rpc:async()=>({data:++n===1?dados:{estado:"gravado",hash_entrada:"a".repeat(64),hash_extracao:"b".repeat(64),homologada:true},error:null})},reserva));
});

test("recibo histórico confirma tupla exata sem reexecutar a extração",async()=>{
 const data={estado:"recuperado",loja_id:reserva.loja,item_id:reserva.item,execucao:reserva.execucao,geracao:reserva.geracao,versao:reserva.versao,hash_entrada:"a".repeat(64),hash_extracao:"b".repeat(64),homologada:false};
 let n=0;const r=await recuperarReciboEngenharia({rpc:async(nome:string)=>{n++;assert.equal(nome,"nano_lifecycle_recibo_engenharia");return {data,error:null}}},reserva);
 assert.equal(n,1);assert.equal(r.estado,"recuperado");
 await assert.rejects(recuperarReciboEngenharia(rpc({...data,geracao:99}),reserva));
 await assert.rejects(recuperarReciboEngenharia(rpc({...data,homologada:true}),reserva));
 assert.deepEqual(await recuperarReciboEngenharia(rpc({estado:"recibo_inexistente"}),reserva),{estado:"retida",motivo:"recibo_inexistente"});
 assert.deepEqual(await recuperarReciboEngenharia(rpc({estado:"integridade_divergente"}),reserva),{estado:"retida",motivo:"integridade_divergente"});
});
