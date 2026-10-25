// Executa os arquivos autocontidos; todas as identidades, credenciais e respostas são SINTÉTICAS.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createContext, SourceTextModule, SyntheticModule } from 'node:vm';
import { cifrar } from '../../supabase/functions/_shared/cripto.ts';
const chave = btoa('s'.repeat(32)), segredo = 'TOKEN-BLING-APENAS-SINTETICO';
const cifrado = await cifrar(segredo, chave);
const token = `${'t'.repeat(43)}.${'s'.repeat(43)}`;
const sessao = {sessao_id:'sessao-sintetica',loja_id:'loja-A',usuario_id:'usuario-A',dispositivo_id:'dispositivo-A',nome:'Teste SIMULADO',tipo:'agente_externo',escopos:['bling:consultar'],capacidades:[]};
async function ambiente({escopos=sessao.escopos,revogada=false,flag=true,api=200,identidade=true,auditFalha='',ambiente='sintetico',chaveAusente=false,vault=false,validarErro=false}={}) {
  let handler;
  const consultas=[],rede=[],audits=[],rpcs=[];
  const admin={from(t){
    const filtros={};const q={select(){return q},eq(k,v){filtros[k]=v;return q},ilike(k,v){filtros[k]=v;return q},limit(){return q},
      async maybeSingle(){consultas.push({t,filtros});assert.equal(filtros.loja_id,'loja-A');assert.equal(filtros.sku,'80692');return {data:{sku:'80692',bling_id:'1234',nome:'Espelho SIMULADO',preco:10,estoque:2,sincronizado_em:'2026-10-18T00:00:00Z'}}},
      then(ok,no){consultas.push({t,filtros});assert.equal(filtros.loja_id,'loja-A');if(t==='produtos'){const linha={sku:'80692',bling_id:'1234',nome:'Espelho SIMULADO',preco:10,estoque:2,situacao:'A',sincronizado_em:'2026-10-18T00:00:00Z'};return Promise.resolve({data:(filtros.sku?filtros.sku==='80692':String(filtros.nome).includes('80692'))?[linha]:[],error:null}).then(ok,no)}assert.equal(t,'recursos_efetivos');return Promise.resolve({data:[{ativo:flag}]}).then(ok,no)},
      async insert(v){audits.push(v);return {error:auditFalha === v.acao ? {message:'SEGREDO-SQL'} : null}},
    };return q;
  },async rpc(fn,p){rpcs.push({fn,p});
    if(fn==='pair_validar'){if(validarErro)throw Error('SEGREDO-SQL');assert.match(p.p_token_hash,/^[a-f0-9]{64}$/);assert.match(p.p_sal_hash,/^[a-f0-9]{64}$/);return {data:revogada?null:{...sessao,escopos}}}
    if(fn==='limite_chamada')return {data:true};
    if(fn==='plataforma_segredo')return {data:vault?chave:null};
    if(fn==='bling_ler_credenciais'){assert.equal(p.p_loja_id,'loja-A');return {data:[{access_token_cifrado:cifrado,refresh_token_cifrado:cifrado,expira_em:new Date(Date.now()+86400000).toISOString()}]}}
    throw Error('RPC inesperada '+fn);
  }};
  const fake=async(url,op)=>{rede.push({url,op});assert.ok(url.startsWith('https://api.bling.com.br/Api/v3/produtos?'));assert.ok(url.includes('criterio=5'));assert.equal(op.method,'GET');assert.equal(op.redirect,'manual');assert.equal(op.headers.Authorization,'Bearer '+segredo);return Response.json({data:[{id:identidade?1234:9999,codigo:'80692',nome:'Produto SIMULADO',situacao:'A',preco:34.5,estoque:{saldoVirtualTotal:7},fornecedor:{custo:999},secret:'SEGREDO-API'}]},{status:api})};
  const env={SUPABASE_URL:'https://supabase-sintetico.test',SUPABASE_SERVICE_ROLE_KEY:'service-sintetico',PAIR_AMBIENTE:ambiente,CREDENCIAIS_CHAVE_CIFRA:chaveAusente?undefined:chave};
  const ctx=createContext({Response,Request,Headers,URL,TextEncoder,TextDecoder,Uint8Array,crypto,btoa,atob,AbortSignal,setTimeout,fetch:fake,Deno:{serve:f=>handler=f,env:{get:k=>env[k]}}});
  const ext=new SyntheticModule(['createClient'],function(){this.setExport('createClient',()=>admin)},{context:ctx});
  const codigo=await readFile(new URL('../../artifacts/conecta-gateway/index.ts',import.meta.url),'utf8');
  const mod=new SourceTextModule(codigo,{context:ctx});await mod.link(()=>ext);await mod.evaluate();
  return {rede,audits,consultas,rpcs,async chamar(args={sku:'80692'},method='tools/call'){
    const r=await handler(new Request('https://gateway-sintetico.test',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params:method==='tools/call'?{name:'conecta.bling_consultar_produto',arguments:args}:{}})}));
    return {status:r.status,corpo:await r.json()};
  }};
}
const dado=r=>JSON.parse(r.corpo.result.content[0].text);
test('artefato Pair → gateway → Bling SIMULADO: origem, dados mínimos e auditoria com sessão',async()=>{
  const a=await ambiente(),r=await a.chamar(),d=dado(r);
  assert.equal(r.status,200);assert.equal(d.origem,'api_bling');assert.equal(d.simulado,true);assert.equal(d.ambiente,'sintetico');assert.equal(d.dados.preco,34.5);
  assert.equal(a.rede.length,2,'SKU exato + referência no nome');assert.equal(a.audits.length,2);assert.equal(a.audits[0].acao,'pair.bling_consulta');assert.equal(a.audits[1].acao,'gateway.ok');
  assert.equal(a.audits[0].depois.sessao_id,sessao.sessao_id);assert.equal(a.audits[0].depois.dispositivo_id,sessao.dispositivo_id);assert.match(a.audits[0].depois.hash,/^[a-f0-9]{64}$/);
  assert.ok(!('conversa_id' in a.audits[0].depois));assert.doesNotMatch(JSON.stringify([r,a.audits]),/SEGREDO|TOKEN-BLING|custo|fornecedor|service-sintetico/);
});
for(const op of [{api:403},{api:429}])test('artefato: fallback no espelho identificado '+JSON.stringify(op),async()=>{
  const a=await ambiente(op),d=dado(await a.chamar());assert.equal(d.origem,'espelho');assert.equal(d.dados.preco,10);assert.ok(d.sincronizado_em);assert.ok(d.motivo);
});
test('artefato: identidade divergente (id da API ≠ id do espelho) vira DOIS candidatos, sem fundir nem escolher',async()=>{
  const a=await ambiente({identidade:false}),d=dado(await a.chamar());
  assert.equal(d.candidatos.length,2);assert.equal(new Set(d.candidatos.map(c=>c.id)).size,2);assert.equal(d.conclusao.autoriza_criacao,false);assert.equal(d.conclusao.ausencia_nos_filtros_pesquisados,false);
});
for(const op of [{escopos:['produtos:ler']},{revogada:true},{flag:false},{chaveAusente:true}])test('artefato: negativa sem API '+JSON.stringify(op),async()=>{
  const a=await ambiente(op),r=await a.chamar();assert.ok(r.status===401||r.corpo.result.isError);assert.equal(a.rede.length,0);
});
for(const extra of [{loja_id:'loja-B'},{url:'https://malicioso.test'},{id:'outra-identidade'}])test('artefato: rejeita roteamento fornecido pelo agente '+JSON.stringify(extra),async()=>{
  const a=await ambiente(),r=await a.chamar({sku:'80692',...extra});assert.equal(r.corpo.result.isError,true);assert.equal(a.rede.length,0);assert.equal(a.consultas.length,0);
});
for(const auditFalha of ['pair.bling_consulta','gateway.ok'])test('artefato: auditoria impede entrega em '+auditFalha,async()=>{
  const a=await ambiente({auditFalha}),r=await a.chamar();assert.ok(r.status===503||r.corpo.result.isError);assert.doesNotMatch(JSON.stringify(r),/34.5|Produto SIMULADO|SEGREDO/);
});
test('artefato: ambiente ausente não comprova operação real',async()=>{
  const a=await ambiente({ambiente:''}),d=dado(await a.chamar());assert.equal(d.ambiente,'nao_validado');assert.equal(d.simulado,false);
});
test('artefato: falha de infraestrutura responde 503 genérico',async()=>{
  const a=await ambiente({validarErro:true}),r=await a.chamar();assert.equal(r.status,503);assert.doesNotMatch(JSON.stringify(r),/SEGREDO/);assert.equal(a.rede.length,0);
});
test('artefato pair: QR real do protocolo contém só desafio; credenciais sintéticas ficam fora da URL',async()=>{
  let handler; const rpcs=[];
  const admin={async rpc(fn,p){rpcs.push({fn,p});return {data:fn==='limite_chamada'?true:{id:'desafio-sintetico',expira_em:'2026-10-18T23:59:00Z'}}}};
  const ctx=createContext({Response,Request,Headers,URL,TextEncoder,TextDecoder,Uint8Array,crypto,btoa,atob,Deno:{serve:f=>handler=f,env:{get:k=>k==='APP_URL'?'https://conecta-sintetico.test/': 'sintetico'}}});
  const ext=new SyntheticModule(['createClient'],function(){this.setExport('createClient',()=>admin)},{context:ctx});
  const codigo=await readFile(new URL('../../artifacts/pair/index.ts',import.meta.url),'utf8');
  const mod=new SourceTextModule(codigo,{context:ctx});await mod.link(()=>ext);await mod.evaluate();
  const r=await handler(new Request('https://pair-sintetico.test',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({acao:'iniciar',nome:'Agente SIMULADO',tipo:'agente_externo',escopos:['bling:consultar'],token_hash:'a'.repeat(64)})})),d=await r.json();
  assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');assert.match(d.verificacao,/^\d{6}$/);assert.match(d.sal,/^[A-Za-z0-9_-]{43}$/);
  assert.ok(d.url.includes(d.codigo));for(const segredo of [d.sal,d.segredo,d.verificacao,'a'.repeat(64)])assert.ok(!d.url.includes(segredo));
  const args=rpcs.find(v=>v.fn==='pair_iniciar').p;
  assert.deepEqual([...args.p_escopos],['bling:consultar']);for(const campo of ['p_codigo_hash','p_segredo_hash','p_verificacao_hash','p_token_hash','p_sal_hash'])assert.match(args[campo],/^[a-f0-9]{64}$/);
});

test('artefato: chaveiro existente no Vault permite consulta sem variável de cifra',async()=>{const a=await ambiente({chaveAusente:true,vault:true}),r=await a.chamar();assert.equal(dado(r).origem,'api_bling');assert.equal(a.rede.length,2);assert.ok(a.rpcs.some(r=>r.fn==='plataforma_segredo'));});
