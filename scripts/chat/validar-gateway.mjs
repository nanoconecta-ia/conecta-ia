// Não executar sem autorização específica. Só controles de leitura: não chama GPT nem Bling.
import assert from 'node:assert/strict';
const REF='dsfzhsrudriqkumtlqwj',loja=process.env.CHAT_LOJA_ID,jwt=process.env.CHAT_USUARIO_JWT,anon=process.env.CHAT_ANON_KEY;
assert.ok(process.argv.includes('--executar-nuvem')&&process.argv.includes(`--confirmar-projeto=${REF}`),'Confirmação específica de projeto ausente.');
assert.match(loja??'',/^[a-f0-9-]{36}$/i);assert.ok(jwt&&anon,'Informe JWT de usuário e chave pública em ambiente protegido.');
const base=`https://${REF}.supabase.co/functions/v1`,evidencias=[];
async function req(nome,op,status){const r=await fetch(`${base}/assistente`,{redirect:'manual',signal:AbortSignal.timeout(20000),...op});assert.equal(r.status,status,nome);evidencias.push({controle:nome,status:r.status});return r}
const body=JSON.stringify({loja_id:loja,acao:'chat_config'}),headers={apikey:anon,'content-type':'application/json'};
try{
 await req('sem login',{method:'POST',headers,body},401);
 await req('bearer opaco',{method:'POST',headers:{...headers,authorization:'Bearer '+ 'x'.repeat(3000)},body},401);
 const pre=await req('CORS preflight',{method:'OPTIONS',headers:{Origin:'https://painel.invalid','Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'authorization,apikey,content-type'}},200);
 assert.match(pre.headers.get('access-control-allow-headers')??'',/authorization/i);
 const r=await req('JWT válido e loja acessível',{method:'POST',headers:{...headers,authorization:`Bearer ${jwt}`},body},200);
 const data=await r.json();assert.equal(data.versao,'chat_operacional_v1');assert.equal(typeof data.persistente,'boolean');
 await req('método indevido',{method:'GET',headers:{...headers,authorization:`Bearer ${jwt}`}},405);
 console.log(JSON.stringify({tipo:'GATEWAY_NUVEM_REAL',projeto:REF,loja,quando:new Date().toISOString(),controles:evidencias},null,2));
}catch{console.error('Gateway não validado. Tokens, respostas e cabeçalhos não são registrados.');process.exitCode=1}
