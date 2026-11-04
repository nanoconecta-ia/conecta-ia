import { test } from "node:test";
import assert from "node:assert/strict";
import { evidenciaSkuExato, gerarFichaSemLLM } from "./ficha_sem_llm.ts";
const fonte = { origem: "api_bling", consultada: true, completa: true };
const unico = {
 termo: "CI000016", total_candidatos: 1, truncado: false, candidatos: [
  { id: "12345", sku: "CI000016", nome: "Bomba de agua HR", situacao: "ativo", origem: "api_bling" }
 ], fontes: [fonte],
 conclusao: { api_completa: true, ausencia_nos_filtros_pesquisados: false, autoriza_criacao: false },
 consultado_em: "2026-11-01T19:00:00Z", simulado: true,
};
test("ficha sem modelo: conserva proveniencia, origem simulada e nao cria cadastro",()=>{
 const r=gerarFichaSemLLM(unico);
 assert.equal(r.modo,"ficha_sem_llm");
 assert.equal(r.situacao,"um_candidato");
 assert.equal(r.autoriza_criacao,false);
 assert.match(r.resposta,/SIMULADO/);
 assert.match(r.resposta,/CI000016/);
 assert.match(r.resposta,/NENHUM PRODUTO FOI CADASTRADO/);
 assert.match(r.resposta,/campos que exigem confirmação/i);
});
test("ficha: candidato excluido nao autoriza duplicacao",()=>{
 const r=gerarFichaSemLLM({...unico,candidatos:[{...unico.candidatos[0],situacao:"excluido"}]});
 assert.equal(r.autoriza_criacao,false);
 assert.match(r.resposta,/excluido/);
 assert.match(r.resposta,/reativação/);
});
test("ficha: sem candidato nunca equivale a inexistencia comprovada",()=>{
 const r=gerarFichaSemLLM({...unico,candidatos:[],total_candidatos:0});
 assert.equal(r.situacao,"sem_candidatos_no_escopo");
 assert.equal(r.autoriza_criacao,false);
 assert.match(r.resposta,/NÃO prova que o produto inexiste/);
 assert.match(r.resposta,/BLOQUEADO/);
});
test("ficha: candidatos multiplos ou parcial bloqueiam decisao precipitada",()=>{
 const dois=[unico.candidatos[0],{id:"12346",sku:"CI000017",nome:"Outra bomba",situacao:"inativo",origem:"espelho"}];
 const r=gerarFichaSemLLM({...unico,candidatos:dois,total_candidatos:2});
 assert.equal(r.situacao,"conflito_ou_lista_parcial");
 assert.match(r.resposta,/Múltiplos candidatos/);
 const parcial=gerarFichaSemLLM({...unico,total_candidatos:8,lista_parcial:true,conclusao:{api_completa:false}});
 assert.equal(parcial.parcial,true);assert.match(parcial.resposta,/LISTA PARCIAL/);
 assert.match(parcial.resposta,/incompleta/);
});
test("ficha: evidencia incompleta e dados sinteticos nao aceitos como confiaveis",()=>{
 assert.throws(()=>gerarFichaSemLLM({}),/Evidência incompleta/);
 assert.throws(()=>gerarFichaSemLLM(null),/inválida/);
 const r=gerarFichaSemLLM({...unico,simulado:true,conclusao:{api_completa:false}});
 assert.match(r.resposta,/SIMULADO/);
 assert.equal(r.autoriza_criacao,false);
});

test("ficha estrita filtra candidatos aproximados e preserva SKU inteiro", () => {
 const candidatos = [
   { id: "1", sku: "K2500", nome: "Radiador" },
   { id: "2", sku: "ENG-1645-05", nome: "Turbina" },
   { id: "3", sku: "ENG-1645", nome: "Outro produto" },
 ];
 const e = evidenciaSkuExato({...unico, candidatos, total_candidatos: 3}, "ENG-1645-05");
 assert.deepEqual(e.candidatos, [candidatos[1]]);
 const ficha = gerarFichaSemLLM(e);
 assert.equal(ficha.candidatos, 1);
 assert.match(ficha.resposta, /ENG-1645-05/);
 assert.doesNotMatch(ficha.resposta, /Radiador|Outro produto/);
 assert.equal(evidenciaSkuExato({...unico, candidatos}, "INEXISTENTE-123").total_candidatos, 0);
 assert.equal(evidenciaSkuExato({...unico, candidatos}, "eng-1645-05").total_candidatos, 0);
});
test("ficha estrita não oculta duplicidade do SKU nem truncamento da busca", () => {
 const c = unico.candidatos[0];
 assert.equal(gerarFichaSemLLM(evidenciaSkuExato({...unico, candidatos:[c,{...c,id:"outro"}]}, c.sku)).candidatos, 2);
 assert.equal(gerarFichaSemLLM(evidenciaSkuExato({...unico,truncado:true}, c.sku)).parcial, true);
});
