import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SourceTextModule, SyntheticModule, createContext } from 'node:vm';
import { gerar } from '../gerar-autocontido.mjs';
import { assinarEstado } from '../../supabase/functions/_shared/estado.ts';
import { cifrar, decifrar } from '../../supabase/functions/_shared/cripto.ts';
const root=new URL('../../',import.meta.url).pathname;
const chave=btoa('w'.repeat(32)),segredo='hmac-so-sintetico',L='aaaaaaaa-0000-0000-0000-000000000001',U='11111111-1111-1111-1111-111111111111';
const cipher=await cifrar('client-secret-sintetico',chave);
async function callback({administra=true,cnpj='19903967000101',tokenStatus=200,tokenValido=true,nonceLoja=L,nonceUser=U}={}){
 let handler,consumido=false;const rede=[],salvos=[];
 const client={async rpc(fn,p){if(fn==='bling_estado_consumir'){if(consumido)return {data:[]};consumido=true;return {data:[{loja_id:nonceLoja,user_id:nonceUser}]}}if(fn==='bling_usuario_administra')return {data:administra};if(fn==='bling_ler_app')return {data:[{client_id:'client-sintetico',client_secret_cifrado:cipher,cnpj:'19903967000101'}]};if(fn==='bling_salvar_credenciais'){salvos.push(p);return {data:null}}throw Error('RPC inesperada '+fn)}};
 const fake=async(url,op)=>{rede.push({url,op});assert.equal(op.redirect,'manual');assert.ok(op.signal);assert.equal(op.headers['enable-jwt'],'1');if(url.includes('/oauth/token')){assert.equal(op.method,'POST');assert.equal(new URLSearchParams(op.body).get('grant_type'),'authorization_code');return Response.json({access_token:'A'.repeat(3000),refresh_token:'R'.repeat(1500),expires_in:tokenValido?3600:-1},{status:tokenStatus})}assert.equal(url,'https://api.bling.com.br/Api/v3/empresas/me/dados-basicos');assert.equal(op.headers.Authorization.length,3007);return Response.json({data:{cnpj}})};
 const ctx=createContext({Response,Request,Headers,URL,URLSearchParams,TextEncoder,TextDecoder,Uint8Array,crypto,btoa,atob,AbortSignal,fetch:fake,Deno:{serve:f=>handler=f,env:{get:k=>({CREDENCIAIS_CHAVE_CIFRA:chave,ESTADO_SEGREDO:segredo}[k])}}});
 const ext=new SyntheticModule(['createClient'],function(){this.setExport('createClient',()=>client)},{context:ctx});const r=await gerar(root,'supabase/functions/bling-callback/index.ts');const m=new SourceTextModule(r.codigo,{context:ctx});await m.link(()=>ext);await m.evaluate();
 return {rede,salvos,async chamar(state){return handler(new Request('http://localhost/bling-callback?'+new URLSearchParams({code:'codigo-sintetico',state})))}};
}
const estado=()=>assinarEstado({l:L,u:U,n:'nonce-sintetico',e:Date.now()+600000},segredo);
test('OAuth sintético: state único, identidade da conta, JWT longo e cifragem; replay não troca código',async()=>{const a=await callback(),s=await estado(),r=await a.chamar(s);assert.equal(r.status,200);assert.equal(a.salvos.length,1);assert.equal((await decifrar(a.salvos[0].p_access,chave)).length,3000);assert.ok(!JSON.stringify(a.salvos).includes('A'.repeat(40)));assert.equal((await a.chamar(s)).status,400);assert.equal(a.rede.length,2)});
for(const [nome,opts,calls]of[['papel revogado',{administra:false},0],['loja do nonce divergente',{nonceLoja:'outra'},0],['usuário do nonce divergente',{nonceUser:'outro'},0],['CNPJ diferente',{cnpj:'12345678000199'},2],['troca recusada',{tokenStatus:400},1],['expiração inválida',{tokenValido:false},1]])test('OAuth recusa '+nome,async()=>{const a=await callback(opts),r=await a.chamar(await estado());assert.equal(r.status,400);assert.equal(a.salvos.length,0);assert.equal(a.rede.length,calls)});
test('OAuth recusa assinatura inválida e state expirado antes de qualquer rede',async()=>{const a=await callback();assert.equal((await a.chamar((await estado())+'alterado')).status,400);assert.equal((await a.chamar(await assinarEstado({l:L,u:U,n:'n',e:Date.now()-1},segredo))).status,400);assert.equal(a.rede.length,0);assert.equal(a.salvos.length,0)});
