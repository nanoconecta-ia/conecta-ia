import {test} from 'node:test';
import assert from 'node:assert/strict';
import {tratarOAuth,redirectValido,type OAuthPortas} from './oauth.ts';
import {sha256Hex} from './cripto.ts';
import {b64u} from '../estado.ts';
const base='https://conecta-sintetico.test/functions/v1/conecta-gateway',redirect='https://cliente.example/cb';
const verifier='v'.repeat(43),challenge=b64u(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))));
function ambiente(){
 const calls:{fn:string;p:Record<string,unknown>}[]=[];let pedido:any=null,aprovado=false,consumido=false;
 const p:OAuthPortas={baseURL:base,appURL:'https://painel.example/',segredo:async()=> 'SEGREDO-APENAS-SINTETICO',limite:async()=>true,rpc:async(fn,a)=>{
   calls.push({fn,p:a});if(fn==='oauth_pair_iniciar'){pedido=a;return {data:{ok:true}}}
   if(fn==='oauth_pair_trocar'){if(!aprovado||consumido||a.p_codigo_hash!==pedido?.p_codigo_hash||a.p_cliente_hash!==pedido.p_cliente_hash||a.p_redirect!==pedido.p_redirect||a.p_challenge!==pedido.p_challenge)return {data:null};consumido=true;return {data:{escopos:['bling:consultar'],offline:true,expira_em:new Date(Date.now()+600000).toISOString()}}}
   return {data:null};
 }};
 const chamar=(path:string,body?:unknown,headers:Record<string,string>={})=>tratarOAuth(new Request(base+path,{method:body===undefined?'GET':'POST',headers,body:body===undefined?undefined:typeof body==='string'?body:JSON.stringify(body)}),p);
 const registrar=async()=>{const r=await chamar('/oauth/register',{redirect_uris:[redirect],client_name:'Cliente SIMULADO',token_endpoint_auth_method:'none'});assert.equal(r!.status,201);return (await r!.json()).client_id as string};
 return {p,calls,chamar,registrar,aprovar:()=>aprovado=true,get pedido(){return pedido}};
}
test('redirect fechado: HTTPS público e loopback HTTP; sem credencial ou fragmento',()=>{
 for(const u of [redirect,'http://127.0.0.1:8123/cb','http://localhost:8123/cb'])assert.equal(redirectValido(u),true,u);
 for(const u of ['http://cliente.example/cb','https://127.0.0.1/cb','https://a.internal/cb','https://u:p@cliente.example/cb','https://cliente.example/#token','javascript:alert(1)'])assert.equal(redirectValido(u),false,u);
});
test('discovery público não consulta segredo nem dados da loja',async()=>{
 const a=ambiente();a.p.segredo=async()=>{throw Error('não pode ler')};
 for(const path of ['/.well-known/oauth-protected-resource','/oauth/.well-known/oauth-authorization-server']){const r=await a.chamar(path);assert.equal(r!.status,200);assert.equal(a.calls.length,0)}
});
test('DCR → authorize → PKCE → token: consentimento obrigatório, token opaco e uso único',async()=>{
 const a=ambiente(),client=await a.registrar();
 const q=new URLSearchParams({client_id:client,redirect_uri:redirect,response_type:'code',state:'state-sintetico',code_challenge:challenge,code_challenge_method:'S256',scope:'bling:consultar offline_access',resource:base});
 const auth=await a.chamar('/oauth/authorize?'+q);assert.equal(auth!.status,302);assert.match(auth!.headers.get('location')!,/^https:\/\/painel.example\/#\/autorizar-agente\?c=/);
 const code=new URLSearchParams(new URL(auth!.headers.get('location')!).hash.split('?')[1]).get('c')!;
 assert.equal(a.pedido.p_codigo_hash,await sha256Hex(code));assert.deepEqual(a.pedido.p_escopos,['bling:consultar']);assert.ok(!JSON.stringify(a.pedido).includes(verifier));
 const token=new URLSearchParams({client_id:client,grant_type:'authorization_code',code,code_verifier:verifier,redirect_uri:redirect,resource:base});
 assert.equal((await (await a.chamar('/oauth/token',token.toString()))!.json()).error,'invalid_grant');
 a.aprovar();const r=await a.chamar('/oauth/token',token.toString()),data=await r!.json();assert.equal(r!.status,200);assert.match(data.access_token,/^[\w-]{43}\.[\w-]{43}$/);assert.match(data.refresh_token,/^r1\.[\w-]{43}\.[\w-]{43}$/);assert.equal(r!.headers.get('cache-control'),'no-store');assert.doesNotMatch(JSON.stringify(data),/SEGREDO|eyJ/);
 assert.equal((await (await a.chamar('/oauth/token',token.toString()))!.json()).error,'invalid_grant');
});
test('registro adulterado, redirect não registrado, PKCE fraco e recurso alheio não iniciam pedido',async()=>{
 const a=ambiente(),client=await a.registrar(),q=new URLSearchParams({client_id:client,redirect_uri:redirect,response_type:'code',state:'state-sintetico',code_challenge:challenge,code_challenge_method:'S256',scope:'bling:consultar',resource:base});
 for(const [k,v] of [['client_id',client+'x'],['redirect_uri','https://outro.example/cb'],['code_challenge_method','plain'],['code_challenge','curto'],['resource','https://outro.example/mcp'],['scope','aprovacoes:aprovar']]){
  const ruim=new URLSearchParams(q);ruim.set(k,v);const r=await a.chamar('/oauth/authorize?'+ruim);assert.ok(r!.status>=400,k);
 }
 assert.equal(a.calls.length,0);
});
test('parâmetro duplicado, Basic e pedido excessivo falham sem emitir token',async()=>{
 const a=ambiente(),client=await a.registrar();
 for(const raw of [new URLSearchParams({client_id:client,grant_type:'refresh_token',refresh_token:'errado'}).toString(),'client_id='+encodeURIComponent(client)+'&client_id=outro']){
   const r=await a.chamar('/oauth/token',raw);assert.ok(r!.status>=400);
 }
 const r=await a.chamar('/oauth/token',new URLSearchParams({client_id:client}).toString(),{Authorization:'Basic c2ludGV0aWNv'});assert.equal(r!.status,401);assert.equal(a.calls.length,0);
});
test('limite e falta de configuração negam sem tocar dados',async()=>{
 const a=ambiente();a.p.limite=async()=>false;assert.equal((await a.chamar('/oauth/register',{}))!.status,429);assert.equal(a.calls.length,0);
 a.p.limite=async()=>true;a.p.segredo=async()=>undefined;assert.equal((await a.chamar('/oauth/register',{}))!.status,503);
});
