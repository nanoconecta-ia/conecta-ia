// OAuth 2.1 de cliente público: DCR assinado, consentimento nativo, PKCE S256 e sessões Pair.
// Cliente OAuth recebe apenas token Pair; nunca JWT Supabase ou chave do ERP. Nenhuma tabela de clientes nova.
import {b64u,unb64u} from '../estado.ts';
import {aleatorioB64u,sha256Hex,separarToken} from './cripto.ts';
import {ESCOPOS} from './escopos.ts';
export interface OAuthPortas {
  baseURL:string; appURL:string; segredo():Promise<string|undefined>;
  rpc(fn:string,p:Record<string,unknown>):PromiseLike<{data:any;error?:unknown}>;
  limite(chave:string,max:number,janela:number):Promise<boolean>;
}
const enc=new TextEncoder(),dec=new TextDecoder();
const headers={'Content-Type':'application/json','Cache-Control':'no-store','Pragma':'no-cache','Access-Control-Allow-Origin':'*'};
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers});
const erro=(error:string,status=400)=>json({error},status);
const exato=(p:URLSearchParams,k:string)=>{if(p.getAll(k).length>1)throw Error('duplicado');return p.get(k)};
export function redirectValido(s:unknown):s is string {
  if(typeof s!=='string'||s.length>1024)return false;
  try{const u=new URL(s);if(u.username||u.password||u.hash)return false;
    if(u.protocol==='http:')return ['127.0.0.1','[::1]','localhost'].includes(u.hostname);
    return u.protocol==='https:'&&u.hostname.includes('.')&&!u.hostname.includes(':')&&!/^\d+\.\d+\.\d+\.\d+$/.test(u.hostname)&&!/\.(local|internal|localhost|lan|home|corp)$/.test(u.hostname);
  }catch{return false}
}
type Cliente={nome:string;uris:string[];n:string};
async function mac(corpo:string,segredo:string){
  const key=await crypto.subtle.importKey('raw',enc.encode(segredo),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
  return {key,dados:enc.encode('conecta.oauth.cliente.v1\n'+corpo)};
}
async function clienteAssinado(c:Cliente,s:string){const b=b64u(enc.encode(JSON.stringify(c))),m=await mac(b,s);return 'c1.'+b+'.'+b64u(new Uint8Array(await crypto.subtle.sign('HMAC',m.key,m.dados)))}
async function lerCliente(v:unknown,s:string):Promise<Cliente|null>{
  if(typeof v!=='string'||v.length>5000)return null;
  try{const [versao,b,sig,resto]=v.split('.');if(versao!=='c1'||!b||!sig||resto!==undefined)return null;
    const m=await mac(b,s);if(!await crypto.subtle.verify('HMAC',m.key,unb64u(sig),m.dados))return null;
    const c=JSON.parse(dec.decode(unb64u(b)));return typeof c.nome==='string'&&Array.isArray(c.uris)&&c.uris.every(redirectValido)?c:null;
  }catch{return null}
}
export const metadataRecurso=(base:string)=>({resource:base,authorization_servers:[base+'/oauth'],scopes_supported:[...ESCOPOS,'offline_access'],bearer_methods_supported:['header'],resource_name:'Conecta IA — loja autorizada'});
export const desafioOAuth=(base:string)=>`Bearer resource_metadata="${base}/.well-known/oauth-protected-resource"`;
export async function tratarOAuth(req:Request,p:OAuthPortas):Promise<Response|null>{
  const u=new URL(req.url),basePath=new URL(p.baseURL).pathname.replace(/\/$/,''),path=u.pathname.slice(basePath.length);
  if(!u.pathname.startsWith(basePath+'/'))return null;
  if(path==='/.well-known/oauth-protected-resource'&&req.method==='GET')return json(metadataRecurso(p.baseURL));
  if(['/oauth/.well-known/oauth-authorization-server','/.well-known/oauth-authorization-server','/oauth/.well-known/openid-configuration','/.well-known/openid-configuration'].includes(path)&&req.method==='GET')return json({
    issuer:p.baseURL+'/oauth',authorization_endpoint:p.baseURL+'/oauth/authorize',token_endpoint:p.baseURL+'/oauth/token',registration_endpoint:p.baseURL+'/oauth/register',revocation_endpoint:p.baseURL+'/oauth/revoke',
    response_types_supported:['code'],grant_types_supported:['authorization_code','refresh_token'],token_endpoint_auth_methods_supported:['none'],revocation_endpoint_auth_methods_supported:['none'],
    code_challenge_methods_supported:['S256'],scopes_supported:[...ESCOPOS,'offline_access'],
  });
  if(!['/oauth/register','/oauth/authorize','/oauth/token','/oauth/revoke'].includes(path))return null;
  const method=path==='/oauth/authorize'?'GET':'POST';if(req.method!==method)return erro('invalid_request',405);
  if(u.search.length>12000||Number(req.headers.get('content-length')??0)>16000)return erro('invalid_request',413);
  const ip=(req.headers.get('x-forwarded-for')??'?').split(',')[0].trim();
  if(!await p.limite('oauth-global:'+path,200,60)||!await p.limite('oauth:'+path+':'+ip,path==='/oauth/register'?10:60,600))return erro('temporarily_unavailable',429);
  const s=await p.segredo();if(!s)return erro('temporarily_unavailable',503);
  try{
    if(path==='/oauth/register'){
      const raw=await req.text();if(raw.length>8000)return erro('invalid_client_metadata');const c=JSON.parse(raw);
      if(!c||!Array.isArray(c.redirect_uris)||c.redirect_uris.length<1||c.redirect_uris.length>3||!c.redirect_uris.every(redirectValido)||c.redirect_uris.join('').length>2048
        ||c.token_endpoint_auth_method&&c.token_endpoint_auth_method!=='none'||c.response_types&&JSON.stringify(c.response_types)!=='["code"]'
        ||c.grant_types&&(!Array.isArray(c.grant_types)||c.grant_types.some((g:unknown)=>!['authorization_code','refresh_token'].includes(g as string))))return erro('invalid_client_metadata');
      const nome=typeof c.client_name==='string'?c.client_name.trim():'Agente externo';if(!nome||nome.length>80||/[\u0000-\u001f<>]/.test(nome))return erro('invalid_client_metadata');
      const client_id=await clienteAssinado({nome,uris:c.redirect_uris,n:aleatorioB64u()},s);
      return json({client_id,client_id_issued_at:Math.floor(Date.now()/1000),client_name:nome,redirect_uris:c.redirect_uris,token_endpoint_auth_method:'none',grant_types:['authorization_code','refresh_token'],response_types:['code']},201);
    }
    const raw=req.method==='GET'?null:await req.text();if(raw&&raw.length>16000)return erro('invalid_request',413);
    const args=req.method==='GET'?u.searchParams:new URLSearchParams(raw??'');
    const clientId=exato(args,'client_id'),c=await lerCliente(clientId,s);if(!c)return erro('invalid_client',401);
    const resource=exato(args,'resource');if(resource&&resource!==p.baseURL)return erro('invalid_target');
    if(req.headers.has('authorization'))return erro('invalid_client',401); // clientes públicos, sem client_secret ou Basic
    const clienteHash=await sha256Hex(clientId!);
    if(path==='/oauth/authorize'){
      const redirect=exato(args,'redirect_uri');if(!redirect||!c.uris.includes(redirect))return erro('invalid_request');
      const state=exato(args,'state'),challenge=exato(args,'code_challenge');
      if(exato(args,'response_type')!=='code'||exato(args,'code_challenge_method')!=='S256'||!challenge||!/^[A-Za-z0-9_-]{43}$/.test(challenge)||!state||state.length<8||state.length>512)return erro('invalid_request');
      const scopes=(exato(args,'scope')??'bling:consultar').split(' ').filter(Boolean),offline=scopes.includes('offline_access');
      const escopos=[...new Set(scopes.filter(x=>x!=='offline_access'))];if(!escopos.length||escopos.some(x=>!(ESCOPOS as readonly string[]).includes(x)))return erro('invalid_scope');
      const codigo=aleatorioB64u();const r=await p.rpc('oauth_pair_iniciar',{p_codigo_hash:await sha256Hex(codigo),p_cliente_hash:clienteHash,p_redirect:redirect,p_challenge:challenge,p_state:state,p_nome:c.nome,p_escopos:escopos,p_offline:offline});
      if(r.error||r.data?.ok!==true)return erro('temporarily_unavailable',503);
      const destino=new URL(p.appURL);destino.hash='/autorizar-agente?c='+encodeURIComponent(codigo);
      return new Response(null,{status:302,headers:{...headers,Location:destino.toString()}});
    }
    if(path==='/oauth/revoke'){
      const token=exato(args,'token');if(!token||token.length>200)return json({});
      const access=separarToken(token);const r=await p.rpc('oauth_pair_revogar',{p_hash:await sha256Hex(access?access.token:token),p_cliente_hash:clienteHash,p_sal_hash:access?await sha256Hex(access.sal):null});
      return r.error?erro('temporarily_unavailable',503):json({});
    }
    const access=aleatorioB64u()+'.'+aleatorioB64u(),parts=separarToken(access)!,refresh='r1.'+aleatorioB64u()+'.'+aleatorioB64u();
    const hashes={p_token_hash:await sha256Hex(parts.token),p_sal_hash:await sha256Hex(parts.sal)};
    let r;
    if(exato(args,'grant_type')==='authorization_code'){
      const code=exato(args,'code'),verifier=exato(args,'code_verifier'),redirect=exato(args,'redirect_uri');
      if(!code||!/^[A-Za-z0-9_-]{43}$/.test(code)||!verifier||!/^[A-Za-z0-9._~-]{43,128}$/.test(verifier)||!redirect||!c.uris.includes(redirect))return erro('invalid_grant');
      const challenge=b64u(new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(verifier))));
      r=await p.rpc('oauth_pair_trocar',{p_codigo_hash:await sha256Hex(code),p_cliente_hash:clienteHash,p_redirect:redirect,p_challenge:challenge,...hashes,p_refresh_hash:await sha256Hex(refresh)});
    }else if(exato(args,'grant_type')==='refresh_token'){
      const old=exato(args,'refresh_token');if(!old||!/^r1\.[A-Za-z0-9_-]{43}\.[A-Za-z0-9_-]{43}$/.test(old))return erro('invalid_grant');
      r=await p.rpc('oauth_pair_renovar',{p_refresh_hash:await sha256Hex(old),p_cliente_hash:clienteHash,...hashes,p_novo_refresh_hash:await sha256Hex(refresh)});
    }else return erro('unsupported_grant_type');
    if(r.error)return erro('temporarily_unavailable',503);if(!r.data)return erro('invalid_grant');
    const expires=Math.floor((Date.parse(r.data.expira_em)-Date.now())/1000);if(!Number.isFinite(expires)||expires<1)return erro('invalid_grant');
    return json({access_token:access,token_type:'Bearer',expires_in:expires,scope:[...r.data.escopos,...(r.data.offline?['offline_access']:[])].join(' '),...(r.data.offline?{refresh_token:refresh}:{})});
  }catch{return erro('invalid_request')}
}
