import {test} from "node:test";
import assert from "node:assert/strict";
import {reconciliarDecisaoCatalogo,type EventoDecisaoCatalogo} from "./decisao_catalogo.ts";
const id=(n:number)=>"00000000-0000-0000-0000-"+String(n).padStart(12,"0");
const escopo={loja_id:id(1),produto_id:id(2),aplicacao_id:id(3)};
const base={id:id(3),loja_id:id(1),produto_id:id(2),modelo:"Modelo X",motorizacao:"M1",ano_inicial:2014,ano_final:2016,fonte:"fixture",coletado_em:"2026-11-26T10:00:00Z",status:"a_confirmar",pagina_indexavel:false};
const aprovado={...base,status:"aprovado"},rejeitado={...base,status:"rejeitado"};
const ev:EventoDecisaoCatalogo={id:"9007199254740993",quando:"2026-11-26T11:00:00Z",loja_id:id(1),user_id:id(4),acao:"aplicacao.aprovar",tabela:"produto_aplicacoes",antes:base,depois:aprovado};
const rev:EventoDecisaoCatalogo={...ev,id:"9007199254740994",quando:"2026-11-26T12:00:00Z",acao:"aplicacao.rejeitar",antes:aprovado,depois:rejeitado};
const agora="2026-11-27T12:00:00Z";
const run=(atual:unknown=aprovado,eventos:EventoDecisaoCatalogo[]=[ev])=>reconciliarDecisaoCatalogo(escopo,atual,eventos,agora);
test("CAT-104-01: decisão humana legada rastreável não constitui homologação",()=>{
 const r=run();assert.equal(r.estado,"aprovacao_legada_conferida");assert.equal(r.homologada,false);assert.equal(Object.hasOwn(r,"prova"),false);
 if(r.estado==="aprovacao_legada_conferida"){assert.equal(r.evento_id,ev.id);assert.equal(r.aprovador,id(4));}
});
test("CAT-104-02: rejeição mais recente veta aprovação antiga mesmo com ordem de entrada invertida",()=>{
 assert.equal(run(rejeitado,[rev,ev]).estado,"rejeitada_legada");assert.equal(run(aprovado,[rev,ev]).estado,"retida");
});
test("CAT-104-03: edição depois da decisão e histórico vazio não herdam aprovação",()=>{
 for(const delta of [{motorizacao:"M2"},{ano_final:2020},{fonte:"outra"},{pagina_indexavel:true},{produto_id:id(5)}])assert.equal(run({...aprovado,...delta}).estado,"retida");
 assert.equal(run(aprovado,[]).estado,"retida");
});
test("CAT-104-04: cadeia ambígua, evento duplicado, data futura e ator ausente são retidos",()=>{
 for(const eventos of [[ev,ev],[ev,{...rev,quando:ev.quando}],[{...ev,user_id:null}],[{...ev,quando:"2027-01-01T00:00:00Z"}],[ev,{...rev,antes:base}],[{...ev,loja_id:id(5)}],[{...ev,id:"9223372036854775808"}]])assert.equal(run(aprovado,eventos).estado,"retida");
});
test("CAT-104-05: reaprovação explícita após rejeição é rastreável mas nunca técnica",()=>{
 const nova={...ev,id:"9007199254740995",quando:"2026-11-26T13:00:00Z",antes:rejeitado,depois:aprovado};
 const r=run(aprovado,[nova,rev,ev]);assert.equal(r.estado,"aprovacao_legada_conferida");assert.equal(r.homologada,false);if(r.estado==="aprovacao_legada_conferida")assert.equal(r.evento_id,nova.id);
});


const publicado={...aprovado,pagina_indexavel:true};
const revPublicada={...rev,antes:publicado,depois:rejeitado};
test("CAT-107-01: rejeição de aplicação indexável retira flag e mantém toda a identidade",()=>{
 const r=run(rejeitado,[revPublicada]);assert.equal(r.estado,"rejeitada_legada");assert.equal(r.homologada,false);
});
test("CAT-107-02: rejeição com flag ativa ou qualquer alteração adicional é retida",()=>{
 for(const delta of [{pagina_indexavel:true},{motorizacao:"M2"},{fonte:"outra"},{codigo_oem:"OUTRO"}]){
  const depois={...rejeitado,...delta};assert.equal(run(depois,[{...revPublicada,depois}]).estado,"retida");
 }
});
test("CAT-107-03: reaprovação posterior preserva flag falsa e não restaura indexação",()=>{
 const nova={...ev,id:"9007199254740995",quando:"2026-11-26T13:00:00Z",antes:rejeitado,depois:aprovado};
 assert.equal(run(aprovado,[nova,revPublicada]).estado,"aprovacao_legada_conferida");
 assert.equal(run(publicado,[{...nova,depois:publicado},revPublicada]).estado,"retida");
});
test("CAT-107-04: flag ausente, tipo inválido ou estado inicial incoerente retêm decisão",()=>{
 const {pagina_indexavel:_,...semFlag}=base;
 for(const antes of [semFlag,{...base,pagina_indexavel:"false"},{...base,pagina_indexavel:true}]){
  assert.equal(run(aprovado,[{...ev,antes}]).estado,"retida");
 }
});
test("CAT-107-05: aprovação repetida de registro já indexável não cria nova prova",()=>{
 const r=run(publicado,[{...ev,antes:publicado,depois:publicado}]);
 assert.equal(r.estado,"aprovacao_legada_conferida");assert.equal(r.homologada,false);assert.equal(Object.hasOwn(r,"prova"),false);
});

test("CAT-120-01: ordem, corte do snapshot e data da fonte respeitam microssegundos",()=>{
 const primeiro={...ev,quando:"2026-11-26T11:00:00.123456Z"};
 const segundo={...rev,quando:"2026-11-26T08:00:00.123457-03:00"};
 assert.equal(run(rejeitado,[segundo,primeiro]).estado,"rejeitada_legada");
 assert.equal(run(rejeitado,[primeiro,{...segundo,quando:primeiro.quando}]).estado,"retida");
 assert.equal(reconciliarDecisaoCatalogo(escopo,rejeitado,[primeiro,segundo],primeiro.quando).estado,"retida");
 const fontePosterior={...base,coletado_em:segundo.quando};
 const depois={...fontePosterior,status:"aprovado"};
 assert.equal(run(depois,[{...primeiro,antes:fontePosterior,depois}]).estado,"retida");
});
