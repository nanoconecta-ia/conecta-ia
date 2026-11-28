import {test} from "node:test";
import assert from "node:assert/strict";
import {conferirDecisaoCatalogoSql} from "./porta_decisao_catalogo_sql.ts";
import type {SessaoAuditoriaSql} from "./porta_auditoria_sql.ts";
const id=(n:number)=>"00000000-0000-0000-0000-"+String(n).padStart(12,"0");
const e={loja_id:id(1),produto_id:id(2),aplicacao_id:id(3)};
const antes={...e,id:e.aplicacao_id,status:"a_confirmar",pagina_indexavel:false,fonte:"fixture",coletado_em:"2026-11-26T10:00:00Z"};
const atual={...antes,status:"aprovado"};
const evento={id:"9007199254740993",quando:"2026-11-26T11:00:00Z",loja_id:e.loja_id,user_id:id(4),acao:"aplicacao.aprovar",tabela:"produto_aplicacoes",antes,depois:atual};
const valor={atual,eventos:[evento],agora:"2026-11-27T12:00:00Z"};
const row={identidade:"auditor",valor};
const fake=(rows:unknown[]):SessaoAuditoriaSql=>({consultar:async()=>rows});
test("CAT-110-01: consulta única parametrizada e resposta consultiva",async()=>{
 let calls=0;
 const r=await conferirDecisaoCatalogoSql(e,{consultar:async(q,p)=>{calls++;assert.equal(q,"select session_user::text as identidade, nano_lifecycle_interno.nano_catalogo_ler_decisao($1::uuid,$2::uuid,$3::uuid) as valor");assert.deepEqual(p,[e.loja_id,e.produto_id,e.aplicacao_id]);return [row];}},"auditor");
 assert.equal(calls,1);assert.equal(r.estado,"aprovacao_legada_conferida");assert.equal(r.homologada,false);assert.equal(Object.hasOwn(r,"prova"),false);
});
test("CAT-110-02: escopo inválido não chega ao SQL",async()=>{
 let calls=0;const s={consultar:async()=>{calls++;return [row];}};
 assert.equal((await conferirDecisaoCatalogoSql({...e,aplicacao_id:"inválido"},s,"auditor")).estado,"retida");
 assert.equal((await conferirDecisaoCatalogoSql(e,s,"")).estado,"retida");assert.equal(calls,0);
});
test("CAT-110-03: sessão, negação e envelope divergente retêm decisão",async()=>{
 for(const rows of [[],[row,row],[{...row,identidade:"outro"}],[{...row,valor:null}],[{...row,valor:{...valor,prova:true}}],[{...row,valor:{...valor,eventos:[{...evento,extra:true}]}}]]){
  assert.equal((await conferirDecisaoCatalogoSql(e,fake(rows),"auditor")).estado,"retida");
 }
});
test("CAT-110-04: aplicação persistida divergente e erro de transporte retidos",async()=>{
 assert.equal((await conferirDecisaoCatalogoSql({...e,aplicacao_id:id(5)},fake([row]),"auditor")).estado,"retida");
 assert.equal((await conferirDecisaoCatalogoSql(e,{consultar:async()=>{throw Error("offline");}},"auditor")).estado,"retida");
});
test("CAT-110-05: mutação externa durante await não muda escopo capturado",async()=>{
 const alvo={...e};const r=await conferirDecisaoCatalogoSql(alvo,{consultar:async()=>{alvo.aplicacao_id=id(9);return [row];}},"auditor");
 assert.equal(r.estado,"aprovacao_legada_conferida");if(r.estado==="aprovacao_legada_conferida")assert.equal(r.aplicacao_id,e.aplicacao_id);
});
