// Cliente MCP/OAuth real em loopback. Consentimento, banco e produto SIMULADOS; sem rede externa.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {tratarOAuth,desafioOAuth} from '../../supabase/functions/_shared/pair/oauth.ts';
import {tratar} from '../../supabase/functions/_shared/pair/gateway.ts';
import {sha256Hex,separarToken} from '../../supabase/functions/_shared/pair/cripto.ts';
if(!process.env.MCP_SDK_DIR)throw Error('SDK efêmero ausente');
const sdk=p=>pathToFileURL(resolve(process.env.MCP_SDK_DIR,'dist/esm',p)).href;
const {Client}=await import(sdk('client/index.js'));
const {StreamableHTTPClientTransport}=await import(sdk('client/streamableHttp.js'));
let base,flow=null,aprovado=false,revogado=false,expirado=false,hashes=null,refreshHash=null,refreshCalls=0,toolCalls=0;
const caminhos=[];
const sessao={sessao_id:'sintetica',loja_id:'loja-A',usuario_id:'usuario-A',dispositivo_id:'dispositivo-A',nome:'Cliente SIMULADO',tipo:'agente_externo',escopos:['bling:consultar'],capacidades:[]};
const oauth={get baseURL(){return base},appURL:'https://painel-sintetico.example/',segredo:async()=> 'SEGREDO-SINTETICO',limite:async()=>true,async rpc(fn,p){
 if(fn==='oauth_pair_iniciar'){flow=p;return {data:{ok:true}}}
 if(fn==='oauth_pair_trocar'){
  if(!aprovado||p.p_codigo_hash!==flow.p_codigo_hash||p.p_cliente_hash!==flow.p_cliente_hash||p.p_redirect!==flow.p_redirect||p.p_challenge!==flow.p_challenge)return {data:null};
  hashes=p;refreshHash=p.p_refresh_hash;return {data:{escopos:['bling:consultar'],offline:true,expira_em:new Date(Date.now()+900000).toISOString()}};
 }
 if(fn==='oauth_pair_renovar'){
  refreshCalls++;if(revogado||p.p_refresh_hash!==refreshHash||p.p_cliente_hash!==flow.p_cliente_hash)return {data:null};
  hashes=p;refreshHash=p.p_novo_refresh_hash;expirado=false;return {data:{escopos:['bling:consultar'],offline:true,expira_em:new Date(Date.now()+900000).toISOString()}};
 }
 throw Error('RPC inesperada '+fn);
}};
const portas={validar:async(h,s)=>!revogado&&!expirado&&hashes?.p_token_hash===h&&hashes?.p_sal_hash===s?sessao:null,limite:async()=>true,auditar:async()=>{},dados:{consultarProdutoBling:async(s,sku)=>{assert.equal(s.loja_id,'loja-A');toolCalls++;return {origem:'api_bling',simulado:true,ambiente:'sintetico',dados:{sku,nome:'Produto SIMULADO'}}}}};
const servidor=createServer(async(req,res)=>{
 try{
  const chunks=[];for await(const ch of req)chunks.push(ch);const body=Buffer.concat(chunks).toString();const u=new URL(req.url,base);caminhos.push(u.pathname);
  const request=new Request(u,{method:req.method,headers:req.headers,...(req.method==='POST'?{body}:{})});
  const o=await tratarOAuth(request,oauth);if(o){res.writeHead(o.status,Object.fromEntries(o.headers));res.end(await o.text());return}
  // Simula a montagem real: fora da rota da Edge Function não há discovery hospedado.
  if(u.pathname!==new URL(base).pathname){res.writeHead(404);res.end('{}');return}
  const r=await tratar({metodo:req.method,authorization:req.headers.authorization??null,corpo:body},portas);
  res.writeHead(r.status,{'Content-Type':'application/json',...r.headers,...(r.status===401?{'WWW-Authenticate':desafioOAuth(base)}:{})});res.end(r.corpo?JSON.stringify(r.corpo):undefined);
 }catch(e){res.writeHead(503);res.end(JSON.stringify({error:'fixture_indisponivel'}));throw e}
});
servidor.listen(0,'127.0.0.1');await once(servidor,'listening');base=`http://127.0.0.1:${servidor.address().port}/functions/v1/conecta-gateway`;
let clientInfo,tokens,verifier,authorizeURL;
const provider={
 get redirectUrl(){return new URL(`http://127.0.0.1:${servidor.address().port}/callback`)},
 get clientMetadata(){return {client_name:'SDK SIMULADO',redirect_uris:[this.redirectUrl.href],token_endpoint_auth_method:'none',grant_types:['authorization_code','refresh_token'],response_types:['code'],scope:'bling:consultar offline_access'}},
 state:()=>'state-apenas-sintetico',
 clientInformation:()=>clientInfo,saveClientInformation:i=>{clientInfo=i},tokens:()=>tokens,saveTokens:t=>{tokens=t},saveCodeVerifier:v=>{verifier=v},codeVerifier:()=>verifier,
 redirectToAuthorization:u=>{authorizeURL=u},invalidateCredentials:scope=>{if(scope==='all'||scope==='client')clientInfo=undefined;if(scope==='all'||scope==='tokens')tokens=undefined},
};
let client=new Client({name:'teste-oauth-conecta',version:'1.0.0'}),transport=new StreamableHTTPClientTransport(new URL(base),{authProvider:provider});
try{
 let initialError;try{await client.connect(transport)}catch(e){initialError=e}assert.ok(initialError,'esperava redirecionamento OAuth');if(!authorizeURL)console.log('Diagnóstico OAuth sintético:',String(initialError),JSON.stringify(caminhos));assert.ok(authorizeURL,'SDK não descobriu o servidor OAuth');assert.ok(clientInfo?.client_id,'registro dinâmico não ocorreu');
 const a=await fetch(authorizeURL,{redirect:'manual'});assert.equal(a.status,302);const code=new URLSearchParams(new URL(a.headers.get('location')).hash.split('?')[1]).get('c');assert.ok(code);
 assert.equal(flow.p_codigo_hash,await sha256Hex(code));assert.equal(flow.p_challenge,authorizeURL.searchParams.get('code_challenge'));
 aprovado=true;await transport.finishAuth(code);assert.ok(separarToken(tokens.access_token));assert.ok(tokens.refresh_token);
 await client.close();client=new Client({name:'teste-oauth-conecta',version:'1.0.0'});transport=new StreamableHTTPClientTransport(new URL(base),{authProvider:provider});await client.connect(transport);
 const tools=await client.listTools();assert.equal(tools.tools.length,1);
 let r=await client.callTool({name:'conecta.bling_consultar_produto',arguments:{sku:'80692'}});assert.equal(JSON.parse(r.content[0].text).simulado,true);assert.equal(toolCalls,1);
 expirado=true;r=await client.callTool({name:'conecta.bling_consultar_produto',arguments:{sku:'80692'}});assert.ok(refreshCalls>=1);assert.equal(toolCalls,2);
 revogado=true;await assert.rejects(client.callTool({name:'conecta.bling_consultar_produto',arguments:{sku:'80692'}}));assert.equal(toolCalls,2);
 console.log('OAuth SDK MCP: discovery em subcaminho, DCR, PKCE S256, consentimento SIMULADO, token Pair, ferramenta, renovação e revogação passaram. Produto SIMULADO.');
}finally{await client.close();servidor.closeAllConnections();await new Promise(ok=>servidor.close(ok))}
