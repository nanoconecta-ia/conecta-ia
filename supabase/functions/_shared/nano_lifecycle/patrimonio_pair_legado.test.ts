// Checkpoint 99 — reconciliação patrimonial dos 11 contratos próprios do Pair.
// Base: 3b71d97cf44defb3b80f808a60c94c982d99e81d (98).
// CI 98: 10 workflows concluídos com sucesso; publicação ignorada.
// MCP-98-01 a 05 aprovados. Contrato-migracao: conclusão success, status
// inconsistente na API; log de encerramento e workflow completo conferidos.
// O registro central continua intacto; null significa sem equivalência central,
// não ausência de implementação. Este arquivo é exclusivamente teste sintético.
// Não certifica RLS, banco real, rede, autorização de produção ou auditoria independente.
// Revisão dos 19 arquivos legados e dependências externas continua pendente.
import {test} from "node:test";
import assert from "node:assert/strict";
import {FERRAMENTAS, tratar, type Dados, type Sessao, type EventoAuditoria, type Portas} from "../pair/gateway.ts";
import {aleatorioB64u} from "../pair/cripto.ts";
import {ALIASES_PAIR} from "../conector/aliases.ts";

const uuid="11111111-1111-4111-8111-111111111111";
const casos=[
 {nome:"get_part_by_code",escopo:"produtos:ler",leitura:true,porta:"consultarPeca",args:{termo:"SKU-TESTE"},obrig:["termo"],campos:["termo"]},
 {nome:"propose_bula",escopo:"enriquecimento:propor",leitura:false,porta:"proporBula",args:{sku:"SKU-TESTE",medidas:{altura:{valor:10,unidade:"mm"}},fonte:"https://example.com/manual"},obrig:["sku","medidas","fonte"],campos:["sku","medidas","contraindicacoes","fonte"]},
 {nome:"propose_banner",escopo:"banners:propor",leitura:false,porta:"proporAprovacao",args:{titulo:"Teste",imagem_url:"https://example.com/banner.png"},obrig:["titulo","imagem_url"],campos:["titulo","subtitulo","imagem_url","link_url","link_sku","inicio","fim","idempotency_key","versao_de"]},
 {nome:"get_pending_approvals",escopo:"aprovacoes:ler",leitura:true,porta:"aprovacoesPendentes",args:{limite:5},obrig:[],campos:["limite"]},
 {nome:"get_task_status",escopo:"tarefas:ler",leitura:true,porta:"statusTarefa",args:{id:uuid},obrig:["id"],campos:["id"]},
 {nome:"set_active_product",escopo:"contexto:registrar",leitura:false,porta:"registrarContexto",args:{sku:"SKU-TESTE",acao:"aberto"},obrig:["sku"],campos:["sku","acao"]},
 {nome:"get_validated_fields",escopo:"produtos:ler",leitura:true,porta:"camposAprovados",args:{sku:"SKU-TESTE"},obrig:["sku"],campos:["sku"]},
 {nome:"get_sync_status",escopo:"produtos:ler",leitura:true,porta:"statusSincronizacao",args:{},obrig:[],campos:[]},
 {nome:"get_product_images",escopo:"produtos:ler",leitura:true,porta:"imagensProduto",args:{sku:"SKU-TESTE"},obrig:["sku"],campos:["sku"]},
 {nome:"chat_reivindicar",escopo:"chat:responder",leitura:false,porta:"chatReivindicar",args:{},obrig:[],campos:[]},
 {nome:"chat_responder",escopo:"chat:responder",leitura:false,porta:"chatResponder",args:{fila_id:uuid,texto:"Teste"},obrig:["fila_id","texto"],campos:["fila_id","texto"]},
] as const;
const nome=(c:typeof casos[number])=>"conecta."+c.nome;
const token=aleatorioB64u()+"."+aleatorioB64u();
function ambiente(escopos:string[],loja="loja-sintetica-A"){
 const sessao:Sessao={sessao_id:"sessao-teste",loja_id:loja,usuario_id:"usuario-teste",dispositivo_id:"dispositivo-teste",nome:"Agente teste",tipo:"agente_externo",escopos,capacidades:[]};
 const chamadas:{porta:string,args:unknown[]}[]=[];
 const auditoria:EventoAuditoria[]=[];
 const dados=new Proxy({} as Dados,{get(_t,porta){
  return async (...args:unknown[])=>{chamadas.push({porta:String(porta),args});return {ok:true,sintetico:true};};
 }});
 const portas:Portas={validar:async()=>sessao,limite:async()=>true,auditar:async(e)=>{auditoria.push(e);},dados};
 const rpc=async(method:string,params?:unknown)=>{
  const r=await tratar({metodo:"POST",authorization:"Bearer "+token,corpo:JSON.stringify({jsonrpc:"2.0",id:1,method,params})},portas);
  assert.equal(r.status,200);
  return (r.corpo as {result:{isError?:boolean;tools?:{name:string;inputSchema:unknown;annotations:{readOnlyHint:boolean}}[]};error?:unknown});
 };
 return {sessao,chamadas,auditoria,rpc,call:(c:typeof casos[number],args:unknown=c.args)=>rpc("tools/call",{name:nome(c),arguments:args})};
}
test("LEG-99-01: todos os aliases Pair possuem definição única; as 11 lacunas são contratos próprios",()=>{
 assert.deepEqual(FERRAMENTAS.map(f=>f.nome).sort(),Object.keys(ALIASES_PAIR).sort());
 assert.equal(new Set(FERRAMENTAS.map(f=>f.nome)).size,FERRAMENTAS.length);
 assert.deepEqual(Object.entries(ALIASES_PAIR).filter(([,v])=>v===null).map(([k])=>k).sort(),casos.map(nome).sort());
});
test("LEG-99-02: contratos próprios preservam escopo, leitura, argumentos e fechamento do schema",()=>{
 for(const c of casos){
  const f=FERRAMENTAS.find(x=>x.nome===nome(c));assert.ok(f);
  assert.equal(f.escopo,c.escopo);assert.equal(f.somenteLeitura,c.leitura);
  const schema=f.inputSchema as {required:string[];properties:Record<string,unknown>;additionalProperties:boolean};
  assert.deepEqual([...schema.required].sort(),[...c.obrig].sort());
  assert.deepEqual(Object.keys(schema.properties).sort(),[...c.campos].sort());
  assert.equal(schema.additionalProperties,false);
  assert.deepEqual([...f.esquema.obrig].sort(),[...c.obrig].sort());
  assert.deepEqual(Object.keys(f.esquema.props).sort(),[...c.campos].sort());
 }
});
test("LEG-99-03: descoberta e chamada sem escopo não alcançam nenhuma porta",async()=>{
 const a=ambiente([]);
 assert.deepEqual((await a.rpc("tools/list")).result.tools,[]);
 for(const c of casos){
  const r=await a.call(c);assert.equal(r.result.isError,true,nome(c));
  assert.equal(a.auditoria.at(-1)?.resultado,"negado");
 }
 assert.equal(a.chamadas.length,0);
});
test("LEG-99-04: escopo próprio expõe contrato e rejeita troca de loja antes do despacho",async()=>{
 for(const c of casos){
  const a=ambiente([c.escopo]);
  const lista=(await a.rpc("tools/list")).result.tools!;
  const f=FERRAMENTAS.find(x=>x.nome===nome(c))!;
  const item=lista.find(x=>x.name===nome(c));assert.ok(item);
  assert.deepEqual(item.inputSchema,f.inputSchema);assert.equal(item.annotations.readOnlyHint,c.leitura);
  assert.ok(lista.every(x=>FERRAMENTAS.find(f=>f.nome===x.name)?.escopo===c.escopo));
  assert.equal((await a.call(c,{...c.args,loja_id:"loja-invasora"})).result.isError,true);
  assert.equal(a.auditoria.at(-1)?.resultado,"invalido");assert.equal(a.chamadas.length,0);
 }
});
test("LEG-99-05: despacho real do gateway em duas lojas sintéticas preserva porta e identidade da sessão",async()=>{
 for(const loja of ["loja-sintetica-A","loja-sintetica-B"]){
  for(const c of casos){
   const a=ambiente([c.escopo],loja);
   const r=await a.call(c);
   assert.equal(r.error,undefined,nome(c));assert.notEqual(r.result.isError,true,nome(c));
   assert.equal(a.chamadas.length,1,nome(c));const chamada=a.chamadas[0];
   assert.equal(chamada.porta,c.porta);
   const primeiro=chamada.args[0];
   if(c.porta==="proporAprovacao"){
    const p=primeiro as Record<string,unknown>;
    assert.equal(p.loja_id,loja);assert.equal(p.sessao_id,a.sessao.sessao_id);
    assert.equal(p.usuario_id,a.sessao.usuario_id);assert.equal(p.dispositivo_id,a.sessao.dispositivo_id);
    assert.equal(p.tipo,"banner_publicacao");assert.equal(p.risco,"MEDIUM");assert.equal(p.antes,null);
   }else if(c.porta==="chatReivindicar"||c.porta==="chatResponder"){assert.deepEqual(primeiro,a.sessao);}
   else{assert.equal(primeiro,loja);if(c.porta==="registrarContexto")assert.equal(chamada.args[1],a.sessao.usuario_id);}
   assert.equal(a.auditoria.at(-1)?.resultado,"ok");assert.equal(a.auditoria.at(-1)?.loja_id,loja);
  }
 }
});
