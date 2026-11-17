import assert from "node:assert/strict";
import {test} from "node:test";
import { BLOCOS_MOBIS, MONTADORAS_MOBIS, modelosAprovadosDaMontadora, nosPublicaveis, permiteExibirProposta } from "./blocosCatalogoMobis.ts";

test("6 blocos independentes e vinculados à fonte real, não ao Bling para escrita",()=>{
  assert.deepEqual(BLOCOS_MOBIS.map(b=>b.id),["cabecalho","banner","montadoras","taxonomia","produtos","privacidade"]);
  assert.ok(BLOCOS_MOBIS.every(b=>!b.origem.toLowerCase().includes("insert")));
  assert.equal(MONTADORAS_MOBIS.length,9);
});
test("montadora filtra só modelos encontrados nos nós aprovados, sem inventar aplicações",()=>{
  const aprovados=["Hyundai HR","Bongo K2500","Mitsubishi L200","Ford Ranger","Iveco Daily"];
  assert.deepEqual(modelosAprovadosDaMontadora("Hyundai",aprovados),["Hyundai HR"]);
  assert.deepEqual(modelosAprovadosDaMontadora("Kia",aprovados),["Bongo K2500"]);
  assert.deepEqual(modelosAprovadosDaMontadora("Mitsubishi",aprovados),["Mitsubishi L200"]);
  assert.deepEqual(modelosAprovadosDaMontadora("Peugeot",aprovados),[]);
});
test("taxonomia exibe somente nós com produtos reais publicados",()=>{
  const c=nosPublicaveis([{nome:"Motor",slug:"motor",total:7},{nome:"Freios",slug:"freios",total:0},
    {nome:"Motor duplicado",slug:"motor",total:7},{nome:"Suspensão",slug:"suspensao",total:2}]);
  assert.deepEqual(c.map(x=>x.slug),["motor","suspensao"]);
});
test("propostas precisam de aprovação humana, fonte, visibilidade e ausência de pausa",()=>{
  const p={skuFisico:"CI002916",especie:"aplicacao_veicular",fontes:[{referencia:"catálogo técnico homologado",data:"2026-11-17"}],
    status:"aprovado",visivel:true,automacaoPausada:false};
  assert.equal(permiteExibirProposta(p),true);
  assert.equal(permiteExibirProposta({...p,visivel:false}),false);
  assert.equal(permiteExibirProposta({...p,status:"a_confirmar"}),false);
  assert.equal(permiteExibirProposta({...p,automacaoPausada:true}),false);
  assert.equal(permiteExibirProposta({...p,fontes:[]}),false);
});
