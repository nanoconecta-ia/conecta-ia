import {test} from "node:test";
import assert from "node:assert/strict";
import {prepararEntradaEngenharia} from "./entrada_engenharia.ts";
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
