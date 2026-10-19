import { test } from 'node:test';
import assert from 'node:assert/strict';
import { consultarProduto } from './bling_consultar.ts';
import { cifrar } from '../cripto.ts';
const chave = btoa('q'.repeat(32));
const token = 'TOKEN-SINTETICO-'+'x'.repeat(3000);
const cifrado = await cifrar(token,chave);
function ambiente({flag=true,produto=true,status=200,identidade=true,auditoria=true,limite=true,parcial=false}={}) {
 const calls: any[]=[]; const audits: any[]=[]; const consultas: any[]=[];
 const p={bling_id:'1234',sku:'SKU-1',nome:'Espelho',preco:12,estoque:2,sincronizado_em:'2026-10-18T00:00:00Z'};
 const usuario={from(t:string){const filtros:any={};const q:any={select(){return q},eq(k:string,v:any){filtros[k]=v;return q},maybeSingle(){return Promise.resolve({data:produto?p:null})},then(ok:any,no:any){consultas.push({t,filtros});return Promise.resolve({data:[{ativo:flag}]}).then(ok,no)}};consultas.push({t,filtros});return q}};
 const admin={async rpc(fn:string,args:any){if(fn==='limite_chamada')return {data:limite};if(fn==='bling_ler_credenciais')return {data:[{access_token_cifrado:cifrado,refresh_token_cifrado:cifrado,expira_em:new Date(Date.now()+86400000).toISOString()}]};throw Error('RPC inesperada '+fn)},from(t:string){assert.equal(t,'auditoria');return {async insert(v:any){audits.push(v);return {error:auditoria?null:{}}}}}};
 const fake:typeof fetch=async(url,op)=>{calls.push({url,op});assert.equal(op?.method,'GET');assert.equal(op?.redirect,'manual');assert.equal((op?.headers as any).Authorization,'Bearer '+token);return Response.json({data:{id:identidade?1234:9999,codigo:'SKU-1',nome:'Produto API',preco:34.5,...(parcial?{}:{estoque:{saldoVirtualTotal:-2.5}}),fornecedor:{precoCusto:999},token:'segredo'}},{status})};
 const ctx:any={usuario,admin,lojaId:'A',userId:'U',conversaId:'C',cfg:{chaveCifra:chave,fetch:fake},simulado:true,chamadas:[],evidencias:[]};
 return {ctx,calls,audits,consultas};
}
test('API: JWT completo, GET fixo, origem, identidade, auditoria e allowlist',async()=>{const a=ambiente();const r:any=await consultarProduto({sku:'SKU-1'},a.ctx);assert.equal(r.origem,'api_bling');assert.equal(r.simulado,true);assert.equal(r.dados.preco,34.5);assert.equal(r.dados.estoque,-2.5);assert.equal(a.calls[0].url,'https://api.bling.com.br/Api/v3/produtos/1234');assert.equal(a.audits.length,1);assert.equal(a.ctx.chamadas[0].hash.length,64);assert.ok(!JSON.stringify(r).includes('segredo'));assert.ok(!JSON.stringify(a.audits).includes('TOKEN'));assert.ok(a.consultas.some(q=>q.t==='produtos'&&q.filtros.loja_id==='A'&&q.filtros.sku==='SKU-1'));});
for(const op of [{status:403},{status:429},{identidade:false}]) test('fallback explícito '+JSON.stringify(op),async()=>{const a=ambiente(op);const r:any=await consultarProduto({sku:'SKU-1'},a.ctx);assert.equal(r.origem,'espelho');assert.equal(r.dados.preco,12);assert.ok(r.sincronizado_em);assert.ok(r.motivo);});
test('API parcial não usa estoque do espelho com rótulo de API',async()=>{const a=ambiente({parcial:true});const r:any=await consultarProduto({sku:'SKU-1'},a.ctx);assert.equal(r.dados.estoque,null);assert.equal(r.origem,'api_bling');});
for(const op of [{flag:false},{produto:false},{limite:false}]) test('negativa sem API '+JSON.stringify(op),async()=>{const a=ambiente(op);await assert.rejects(consultarProduto({sku:'SKU-1'},a.ctx));assert.equal(a.calls.length,0);});
test('não aceita URL, ID livre ou campos extras',async()=>{const a=ambiente();await assert.rejects(consultarProduto({sku:'SKU-1',url:'https://malicioso.test'},a.ctx));assert.equal(a.calls.length,0);});
test('falha de auditoria impede entregar dado ao modelo',async()=>{const a=ambiente({auditoria:false});await assert.rejects(consultarProduto({sku:'SKU-1'},a.ctx),/auditar/);assert.equal(a.ctx.evidencias.length,0);});
test('limite por turno impede quarta consulta',async()=>{const a=ambiente();for(let n=0;n<3;n++)await consultarProduto({sku:'SKU-1'},a.ctx);await assert.rejects(consultarProduto({sku:'SKU-1'},a.ctx),/três/);assert.equal(a.calls.length,3);});
