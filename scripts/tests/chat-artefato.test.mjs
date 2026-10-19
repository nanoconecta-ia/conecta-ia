// Demonstração SIMULADA do artefato que será publicado. JWT/RLS reais são cobertos pelo CI SQL/M5.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createContext, SourceTextModule, SyntheticModule } from 'node:vm';
import { cifrar } from '../../supabase/functions/_shared/cripto.ts';
const codigo=await readFile(new URL('../../artifacts/assistente/index.ts',import.meta.url),'utf8');
const L='aaaaaaaa-0000-0000-0000-000000000001',U='22222222-2222-2222-2222-222222222222',C='cccccccc-0000-0000-0000-000000000001';
const chave=btoa('z'.repeat(32)), cifrada=await cifrar('chave-apenas-sintetica',chave);
async function ambiente({consentido=true,flag=true,bling=true,tool='bling_consultar_produto',status=200,fimErro=false,auditErro=false,pendente=false,provedorErro=false}={}) {
 let handler,vez=0,final=null,token='dddddddd-0000-0000-0000-000000000001';
 const rede=[],rpcs=[],audits=[],msgs=[];
 function from(t){const filtros={};const q={select(){return q},eq(k,v){filtros[k]=v;return q},order(){return q},limit(){return q},or(){return q},async single(){return result(true)},async maybeSingle(){return result(true)},async insert(v){audits.push(v);return {error:auditErro?{}:null}},then(ok,no){return Promise.resolve(result(false)).then(ok,no)}};
 function result(single){
  if(t==='lojas')return {data:{id:L,nome:'Loja de teste',chat_retencao_dias:180}};
  if(t==='recursos_efetivos')return {data:[{codigo:'chat_persistente',ativo:flag},{codigo:'chat_consulta_bling',ativo:bling}].filter(v=>!filtros.codigo||v.codigo===filtros.codigo)};
  if(t==='mensagens')return {data:[...msgs].reverse()};
  if(t==='produtos')return {data:{bling_id:'1234',sku:'SKU-1',nome:'Espelho SIMULADO',preco:12,estoque:2,sincronizado_em:'2026-10-18T00:00:00Z'}};
  return {data:single?null:[]};
 }return q}
 const client={auth:{getUser:async()=>({data:{user:{id:U}}})},from,async rpc(fn,p){rpcs.push({fn,p});
  if(fn==='chat_iniciar'){if(final)return {data:{estado:'concluido',conversa_id:C,resposta:final.p_resposta,metadados:final.p_meta}};if(pendente||msgs.length)return {data:{estado:'em_execucao',conversa_id:C}};msgs.push({id:'pergunta',papel:'usuario',conteudo:p.p_texto});return {data:{estado:'novo',conversa_id:C,pergunta_id:'pergunta',turno_token:token}};}
  if(fn==='chat_responder'){if(fimErro)return {error:{}};final=p;return {data:'resposta'}};
  if(fn==='limite_chamada')return {data:true};
  if(fn==='ia_chave_ativa')return {data:provedorErro?[]:[{provedor:'compativel_openai',cifrada,modelo:'gpt-sintetico',base_url:'https://api.openai.com/v1',limite:null,tokens_mes:0}]};
  if(fn==='bling_ler_credenciais')return {data:[{access_token_cifrado:cifrada,refresh_token_cifrado:cifrada,expira_em:new Date(Date.now()+86400000).toISOString()}]};
  throw Error('RPC inesperada '+fn);
 }};
 const fake=async(url,op)=>{rede.push({url,op});assert.equal(op.redirect,'manual');if(url.includes('api.bling.com.br')){assert.equal(op.method,'GET');return Response.json({data:{id:1234,codigo:'SKU-1',nome:'Produto SIMULADO',preco:34.5,estoque:{saldoVirtualTotal:7}}})}
  assert.equal(url,'https://api.openai.com/v1/chat/completions');const b=JSON.parse(op.body);assert.ok(!('max_tokens'in b));assert.equal(b.max_completion_tokens,768);
  if(status!==200)return new Response('ERRO-SECRETO',{status});
  vez++;return Response.json({id:'chatcmpl-sintetico-'+vez,model:'gpt-sintetico',choices:[{message:vez===1?{tool_calls:[{id:'t1',function:{name:tool,arguments:'{"sku":"SKU-1"}'}}]}:{content:'Resposta SIMULADA com dados da ferramenta'}}],usage:{total_tokens:5}});
 };
 const ctx=createContext({Response,Request,Headers,URL,TextEncoder,TextDecoder,Uint8Array,crypto,btoa,atob,AbortSignal,fetch:fake,Deno:{serve:f=>handler=f,env:{get:k=>k==='CREDENCIAIS_CHAVE_CIFRA'?chave:k==='CHAT_AMBIENTE'?'sintetico':'local'}}});
 const ext=new SyntheticModule(['createClient'],function(){this.setExport('createClient',()=>client)},{context:ctx});
 const modulo=new SourceTextModule(codigo,{context:ctx});await modulo.link(()=>ext);await modulo.evaluate();
 const body={loja_id:L,acao:'chat_perguntar',provedor:'compativel_openai',consentimento_ia:consentido,texto:'Consulte SKU-1',idempotency_key:'idem-sintetico-1',historico:[{de:'eu',texto:'HISTORICO-ALHEIO-INJETADO'}]};
 return {rede,rpcs,audits,msgs,get final(){return final},async perguntar(extra={}){const r=await handler(new Request('http://localhost/assistente',{method:'POST',headers:{authorization:'Bearer sintetico','content-type':'application/json'},body:JSON.stringify({...body,...extra})}));return {status:r.status,body:await r.json()}}};
}
test('artefato: usuário → GPT SIMULADO → Bling SIMULADO → resposta, histórico, auditoria e replay sem nova rede',async()=>{
 const a=await ambiente(),r=await a.perguntar();assert.equal(r.status,200);assert.equal(r.body.simulado,true);assert.equal(r.body.conversa_id,C);assert.equal(r.body.tokens,10);assert.equal(r.body.resposta_id,'chatcmpl-sintetico-2');assert.equal(r.body.evidencias[0].origem,'api_bling');assert.equal(r.body.evidencias[0].dados.preco,34.5);assert.equal(a.rede.length,3);assert.ok(!JSON.stringify(a.rede.map(c=>JSON.parse(c.op.body||'{}'))).includes('HISTORICO-ALHEIO-INJETADO'));assert.ok(a.rede[2].op.body.includes('34.5'));assert.equal(a.audits.length,1);assert.equal(a.final.p_meta.desfecho,'ok');assert.equal(a.final.p_user,U);assert.equal(a.final.p_loja,L);assert.equal(a.final.p_meta.chamadas[0].hash.length,64);
 const replay=await a.perguntar();assert.equal(replay.body.reutilizada,true);assert.equal(a.rede.length,3);
});
for(const opts of [{consentido:false},{flag:false},{pendente:true}])test('artefato: negativa sem rede '+JSON.stringify(opts),async()=>{const a=await ambiente(opts);const r=await a.perguntar();assert.ok(r.status>=400);assert.equal(a.rede.length,0)});
test('artefato: ferramenta de escrita inventada não executa',async()=>{const a=await ambiente({tool:'bling.produtos.alterar'});await a.perguntar();assert.equal(a.rede.filter(c=>c.url.includes('bling')).length,0);assert.ok(a.rede[1].op.body.includes('Ferramenta não permitida'));});
test('artefato: flag Bling desligada não executa chamada sugerida pelo modelo',async()=>{const a=await ambiente({bling:false});await a.perguntar();assert.equal(a.rede.filter(c=>c.url.includes('bling')).length,0);assert.equal(JSON.parse(a.rede[0].op.body).tools,undefined)});
test('artefato: 429 persiste erro genérico sem fallback de provedor',async()=>{const a=await ambiente({status:429});const r=await a.perguntar();assert.equal(r.status,429);assert.equal(a.rede.length,1);assert.equal(a.final.p_meta.desfecho,'falhou');assert.ok(!JSON.stringify(r).includes('ERRO-SECRETO'));const r2=await a.perguntar();assert.equal(r2.body.reutilizada,true);assert.equal(a.rede.length,1)});
test('artefato: falha de persistência nunca entrega resposta não confirmada',async()=>{const a=await ambiente({fimErro:true});const r=await a.perguntar();assert.equal(r.status,503);assert.equal(r.body.codigo,'registro_nao_confirmado');assert.equal(r.body.resposta,undefined);assert.equal(a.final,null)});
test('artefato: falha na auditoria não expõe resultado da ferramenta',async()=>{const a=await ambiente({auditErro:true});const r=await a.perguntar();assert.equal(r.body.evidencias.length,0);assert.ok(!a.rede[2].op.body.includes('34.5'))});
test('artefato: falta de chave persiste falha recuperável sem rede',async()=>{const a=await ambiente({provedorErro:true});const r=await a.perguntar();assert.equal(r.status,503);assert.equal(a.rede.length,0);assert.equal(a.final.p_meta.desfecho,'falhou')});
