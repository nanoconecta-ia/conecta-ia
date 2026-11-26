import {test} from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {extrair} from "../pipeline/extracao.ts";
import {conferirEvidenciaPersistida,type ChaveEvidencia,type PortaEvidenciaAuditoria} from "./evidencia_procedencia.ts";
import type {Candidato,Documento,FonteAutorizada,LeituraIndependente} from "./procedencia_engenharia.ts";
const chave:ChaveEvidencia={loja:"00000000-0000-0000-0000-000000000001",item:"00000000-0000-0000-0000-000000000002",execucao:"00000000-0000-0000-0000-000000000003",geracao:5,versao:1};
const produto={id:"00000000-0000-0000-0000-000000000004",bling_id:"123",sku:"SINTETICO",nome:"Peça OEM 12345-67890",marca:null,gtin:null,descricao_curta:null,descricao_complementar:null};
const entrada={estado:"preparada",loja_id:chave.loja,item_id:chave.item,execucao:chave.execucao,geracao:5,versao:1,revisao:"sync_0002",checkpoint:"sync_0002",produto};
const e={...entrada,estado:"evidencia_historica",produto_id:produto.id,entrada_snapshot:entrada,extracao_candidata:extrair(produto.sku,produto.nome,""),hash_entrada:"a".repeat(64),hash_extracao:"b".repeat(64),extrator:"extracao_v1",homologada:false};
const c:Candidato={escopo:{...chave,produto:produto.id,sku:produto.sku,revisao:e.revisao,checkpoint:e.checkpoint,hashEntrada:e.hash_entrada,hashExtracao:e.hash_extracao,produtor:"executor-ci"},fato:{oem:"12345-67890",montadora:"Marca teste",modelo:"Modelo teste",geracao:"G1",motor:"M1",emissao:"Euro 5",mercado:"BR",tipo_ano:"ano_modelo_crlv",ano_inicio:2014,ano_fim:2016},fonteId:"f",documentoId:"d",localizador:"p. 1"};
const agora="2026-11-26T16:00:00Z",conteudo="documento sintético";
const d:Documento={id:"d",loja:chave.loja,fonteId:"f",conteudo,sha256:createHash("sha256").update(conteudo).digest("hex"),consultadoEm:"2026-11-26T12:00:00Z"};
const f:FonteAutorizada={id:"f",loja:chave.loja,tipo:"catalogo_fabricante",autorizada:true,emissor:"Emissor sintético"};
const l:LeituraIndependente={id:"l",escopo:c.escopo,fonteId:"f",documentoId:"d",sha256:d.sha256,localizador:c.localizador,fato:c.fato,verificador:"auditor-ci",verificadoEm:"2026-11-26T13:00:00Z",resultado:"confere"};
const registro={chave,produtor:"executor-ci",hashEntrada:e.hash_entrada,hashExtracao:e.hash_extracao};
const porta=(p:Partial<PortaEvidenciaAuditoria>={}):PortaEvidenciaAuditoria=>({evidencia:async()=>e,produtorRegistrado:async()=>registro,fonte:async()=>f,documento:async()=>d,leituras:async()=>[l],verificadorAutorizado:async()=>true,...p});
test("reproduz extração e vincula leitura à geração exata, nunca homologa",async()=>{assert.deepEqual(await conferirEvidenciaPersistida(c,chave,porta(),agora),{estado:"procedencia_conferida",leituraId:"l",sha256:d.sha256,homologada:false});});
test("retém evidência adulterada, de outra geração ou de outro snapshot",async()=>{for(const x of [{...e,geracao:4},{...e,entrada_snapshot:{...entrada,checkpoint:"outro"}},{...e,extracao_candidata:{...e.extracao_candidata,texto_fonte:"inventado"}},{...e,homologada:true}])assert.equal((await conferirEvidenciaPersistida(c,chave,porta({evidencia:async()=>x}),agora)).estado,"retida");});
test("retém identidade sem registro independente ou hash divergente",async()=>{for(const x of [null,{...registro,hashExtracao:"c".repeat(64)},{...registro,chave:{...chave,geracao:4}},{...registro,produtor:"outro"}])assert.equal((await conferirEvidenciaPersistida(c,chave,porta({produtorRegistrado:async()=>x}),agora)).estado,"retida");});
test("não consulta documento antes de validar OEM e escopo persistido",async()=>{let chamadas=0;const p=porta({documento:async()=>{chamadas++;return d;}});for(const x of [{...c,fato:{...c.fato,oem:"99999-99999"}},{...c,escopo:{...c.escopo,geracao:4}},{...c,escopo:{...c.escopo,produtor:"auditor-ci"}}])assert.equal((await conferirEvidenciaPersistida(x,chave,p,agora)).estado,"retida");assert.equal(chamadas,0);});
test("leitura independente de geração diferente não serve",async()=>{assert.equal((await conferirEvidenciaPersistida(c,chave,porta({leituras:async()=>[{...l,escopo:{...l.escopo,geracao:4}}]}),agora)).estado,"retida");});
test("exclusão textual exige revisão específica mesmo com documento",async()=>{const p={...produto,descricao_curta:"NÃO SE APLICA: Euro 5"};const x={...e,entrada_snapshot:{...entrada,produto:p},extracao_candidata:extrair(p.sku,p.nome,p.descricao_curta)};assert.deepEqual(await conferirEvidenciaPersistida(c,chave,porta({evidencia:async()=>x}),agora),{estado:"retida",motivo:"exclusao_a_revisar",homologada:false});});

import {conferirComAuditorSql,type SessaoAuditoriaSql} from "./porta_auditoria_sql.ts";
const consultas=(override?:(sql:string,p:readonly (string|number)[],n:number)=>readonly unknown[]|undefined)=>{
 const chamadas:{sql:string;p:readonly (string|number)[]}[]=[];
 const sessao:SessaoAuditoriaSql={consultar:async(sql,p)=>{
  chamadas.push({sql,p});
  const v=override?.(sql,p,chamadas.length);if(v!==undefined)return v;
  if(sql.startsWith("select session_user"))return [{identidade:"auditor-ci",autorizado:true}];
  const tabela:Record<string,unknown>={ler_evidencia:e,ler_autoria:registro,ler_fonte:f,ler_documento:d,ler_pareceres:[l],verificador_autorizado:true};
  const nome=sql.match(/^select nano_lifecycle_interno\.nano_lifecycle_([a-z_]+)\(/)?.[1];
  assert.ok(nome&&Object.hasOwn(tabela,nome));return [{valor:tabela[nome]}];
 }};
 return {sessao,chamadas};
};
test("adaptador SQL usa parâmetros e escopo completo, sem escrita",async()=>{
 const {sessao,chamadas}=consultas();
 assert.deepEqual(await conferirComAuditorSql(c,chave,sessao,"auditor-ci",agora),{estado:"procedencia_conferida",leituraId:"l",sha256:d.sha256,homologada:false});
 assert.equal(chamadas.length,8);
 assert.ok(chamadas.every(x=>x.sql.startsWith("select ")&&!x.sql.includes(chave.loja)));
 assert.deepEqual(chamadas[2].p,[chave.loja,chave.item,chave.execucao,chave.geracao,chave.versao]);
 assert.deepEqual(chamadas[5].p,[chave.loja,c.documentoId,c.localizador,JSON.stringify(c.escopo)]);
});
test("nega login trocado ou revogado antes de ler evidência",async()=>{
 for(const row of [{identidade:"produtor",autorizado:true},{identidade:"auditor-ci",autorizado:false},{identidade:"auditor-ci",autorizado:"true"}]){
  const {sessao,chamadas}=consultas(()=>[row]);assert.equal((await conferirComAuditorSql(c,chave,sessao,"auditor-ci",agora)).estado,"retida");assert.equal(chamadas.length,1);
 }
});
test("rejeita resposta SQL malformada e revogação durante a leitura",async()=>{
 for(const override of [(sql:string)=>sql.includes("ler_autoria")?[]:undefined,(sql:string)=>sql.includes("ler_pareceres")?[{valor:[null]}]:undefined,(sql:string)=>sql.includes("verificador_autorizado")&&!sql.startsWith("select session_user")?[{valor:"true"}]:undefined,(sql:string,_p:readonly (string|number)[],n:number)=>sql.startsWith("select session_user")&&n>1?[{identidade:"auditor-ci",autorizado:false}]:undefined]){
  const {sessao}=consultas(override);assert.equal((await conferirComAuditorSql(c,chave,sessao,"auditor-ci",agora)).estado,"retida");
 }
});
test("localizador com caracteres SQL permanece parâmetro, não instrução",async()=>{
 const localizador="p. 1'; --", candidato={...c,localizador};
 const {sessao,chamadas}=consultas(sql=>sql.includes("ler_pareceres")?[{valor:[{...l,localizador}]}]:undefined);
 assert.equal((await conferirComAuditorSql(candidato,chave,sessao,"auditor-ci",agora)).estado,"procedencia_conferida");
 assert.equal(chamadas[5].p[2],localizador);assert.ok(!chamadas[5].sql.includes(localizador));
});
test("snapshot sem identidade Bling ou com campo extra é retido",async()=>{
 for(const snapshot of [{...entrada,produto:{...produto,bling_id:"0"}},{...entrada,preco:99}]){
  assert.equal((await conferirEvidenciaPersistida(c,chave,porta({evidencia:async()=>({...e,entrada_snapshot:snapshot})}),agora)).estado,"retida");
 }
});
