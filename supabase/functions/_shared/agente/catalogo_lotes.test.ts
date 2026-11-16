import { test } from "node:test";
import assert from "node:assert/strict";
import { filtrarLoteCatalogo, validarSelecaoCatalogo } from "./catalogo_lotes.ts";
const p = (id: string, situacao: string) => ({id, nome:id, situacao});
test("só produtos ativos, não pausados, entram no enriquecimento", () => {
 const produtos=[p("1","A"),p("2","E"),p("3","I"),p("4","A")];
 const r=filtrarLoteCatalogo(produtos,{escopo:"todos_ativos",selecionados:[],pausados:new Set(["4"])});
 assert.deepEqual(r.elegiveis.map(x=>x.id),["1"]);
 assert.equal(r.inativos,2);assert.equal(r.pausados,1);
});
test("seleção usa ID real, não SKU, e não extrapola",()=>{
 const r=filtrarLoteCatalogo([p("1","A"),p("2","A")],{escopo:"selecionados",selecionados:["1","outro"],pausados:new Set()});
 assert.deepEqual(r.elegiveis.map(x=>x.id),["1"]);
 assert.equal(r.naoEncontrados,1);
});
test("rejeita lote vazio, grande e IDs duplicados",()=>{
 const uuid="d6000000-0000-0000-0000-000000000001";
 assert.match(validarSelecaoCatalogo("selecionados",[] )??"",/Selecione/);
 assert.match(validarSelecaoCatalogo("selecionados",Array(101).fill(uuid))??"",/100/);
 assert.match(validarSelecaoCatalogo("selecionados",[uuid,uuid])??"",/duplicados/);
 assert.equal(validarSelecaoCatalogo("selecionados",[uuid]),null);
 assert.match(validarSelecaoCatalogo("todos_ativos",[uuid])??"",/não aceita/);
});
