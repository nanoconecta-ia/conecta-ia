// Chama somente o assistente. Chaves GPT/Bling permanecem cifradas no servidor. Não executar sem autorização específica.
import assert from 'node:assert/strict';
const REF='dsfzhsrudriqkumtlqwj',loja=process.env.CHAT_LOJA_ID,jwt=process.env.CHAT_USUARIO_JWT,anon=process.env.CHAT_ANON_KEY;
const sku=process.env.CHAT_SKU;
assert.ok(process.argv.includes('--executar-real')&&process.argv.includes(`--confirmar-projeto=${REF}`)&&process.argv.includes(`--confirmar-loja=${loja}`),'Autorizações específicas do teste real ausentes.');
assert.match(loja??'',/^[a-f0-9-]{36}$/i);assert.ok(jwt&&anon&&sku&&sku.length<=80,'Informe ambiente protegido: JWT, chave pública, loja e SKU.');
// Não gerar uma nova chave num retry: a mesma deve ser fornecida novamente para recuperar resultado incerto.
const idem=process.env.CHAT_IDEMPOTENCY_KEY;assert.ok(idem&&idem.length>=8&&idem.length<=120,'Defina uma chave de idempotência única e preserve-a em retentativas.');
const url=`https://${REF}.supabase.co/functions/v1/assistente`,h={apikey:anon,authorization:`Bearer ${jwt}`,'content-type':'application/json'};
const post=async body=>{const r=await fetch(url,{method:'POST',redirect:'manual',signal:AbortSignal.timeout(240000),headers:h,body:JSON.stringify({loja_id:loja,...body})});if(!r.ok)throw Error('etapa recusada');return r.json()};
try{
 const config=await post({acao:'chat_config'});assert.equal(config.versao,'chat_operacional_v1');assert.equal(config.persistente,true);assert.equal(config.bling,true);
 const body={acao:'chat_perguntar',provedor:'compativel_openai',consentimento_ia:true,texto:`Consulte exclusivamente o produto SKU ${sku}. Informe preço, estoque, origem e data dos dados.`,idempotency_key:idem};
 const r=await post(body);assert.equal(r.simulado,false);assert.equal(r.ambiente,'real');assert.equal(r.host_provedor,'api.openai.com');assert.ok(typeof r.resposta_id==='string'&&r.resposta_id.length>0);assert.equal(r.desfecho,'ok');
 const prova=r.evidencias?.find(e=>e.origem==='api_bling'&&e.simulado===false&&e.dados?.sku===sku);assert.ok(prova,'Sem prova de leitura REAL da API Bling; espelho não aprova este marco.');
 const historico=await post({acao:'chat_mensagens',conversa_id:r.conversa_id});assert.ok(historico.mensagens.some(m=>m.metadados?.resposta_id===r.resposta_id),'Histórico persistente não comprovado.');
 const auditoria=await post({acao:'chat_comprovantes',conversa_id:r.conversa_id});
 const hash=r.chamadas?.find(c=>c.origem==='api_bling')?.hash;assert.ok(hash);
 assert.ok(auditoria.registros.some(a=>a.acao==='chat.turno_concluido'&&a.depois?.resposta_id===r.resposta_id),'Auditoria do turno não comprovada.');
 assert.ok(auditoria.registros.some(a=>a.acao==='chat.bling_consulta'&&a.depois?.hash===hash),'Auditoria da consulta Bling não comprovada.');
 const replay=await post({...body,conversa_id:r.conversa_id});assert.equal(replay.reutilizada,true);assert.equal(replay.resposta_id,r.resposta_id);
 console.log(JSON.stringify({tipo:'PILOTO_REAL',projeto:REF,loja,conversa_id:r.conversa_id,provedor:r.provedor,modelo:r.modelo,resposta_id:r.resposta_id,tokens:r.tokens,origem:prova.origem,quando:prova.consultado_em,hash_evidencia:hash,historico_confirmado:true,replay_confirmado:true,auditoria_confirmada:true},null,2));
}catch{console.error('Piloto NÃO aprovado. Preserve CHAT_IDEMPOTENCY_KEY antes de qualquer tentativa. Não são impressos tokens nem dados do produto.');process.exitCode=1}
