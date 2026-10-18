// Usa somente o Postgres descartável já criado pelo job banco. Nenhuma URL ou segredo remoto.
import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import assert from 'node:assert/strict';
assert.equal(process.env.PGHOST,'localhost');
const env={...process.env,PGDATABASE:'conecta_teste'};
const sql=q=>execFileSync('psql',['-XqAt','-v','ON_ERROR_STOP=1','-c',q],{env,encoding:'utf8'}).trim();
const asyncSql=async q=>(await promisify(execFile)('psql',['-XqAt','-v','ON_ERROR_STOP=1','-c',q],{env})).stdout.trim();
const L='acacacac-0000-0000-0000-000000000001',U='adadadad-0000-0000-0000-000000000001';
sql(`insert into lojas(id,nome,slug) values('${L}','Chat concorrência','chat-concorrencia');insert into usuarios_loja(loja_id,user_id,papel) values('${L}','${U}','lojista');insert into loja_recursos(loja_id,recurso,ativo) values('${L}','chat_persistente',true);`);
const iniciar=(idem,conv='null')=>`set role service_role;select public.chat_iniciar('${L}','${U}',${conv},'Consulta sintética','${idem}','compativel_openai');`;
try{
 const rs=await Promise.all(Array.from({length:8},()=>asyncSql(iniciar('idem-concorrencia-1')).then(JSON.parse)));
 assert.equal(rs.filter(r=>r.estado==='novo').length,1);assert.equal(rs.filter(r=>r.estado==='em_execucao').length,7);
 const t=rs.find(r=>r.estado==='novo');assert.equal(sql(`select count(*) from mensagens where conversa_id='${t.conversa_id}'`),'1');
 console.log('ok: 8 conexões simultâneas, uma única reserva e uma única pergunta');
 const outros=await Promise.all(Array.from({length:8},(_,i)=>asyncSql(iniciar('idem-outra-'+i,`'${t.conversa_id}'`)).then(JSON.parse)));
 assert.ok(outros.every(r=>r.estado==='em_execucao'));console.log('ok: perguntas diferentes respeitam a mesma reserva de conversa');
 sql(`set role service_role;select chat_responder('${L}','${U}','${t.pergunta_id}','${t.turno_token}','Resposta sintética','{"tokens":0,"simulado":true,"desfecho":"ok"}');`);
 const replay=await Promise.all(Array.from({length:8},()=>asyncSql(iniciar('idem-concorrencia-1')).then(JSON.parse)));
 assert.ok(replay.every(r=>r.estado==='concluido'&&r.resposta==='Resposta sintética'));assert.equal(sql(`select count(*) from mensagens where conversa_id='${t.conversa_id}'`),'2');console.log('ok: 8 recuperações devolvem a resposta sem duplicação');
 const novo=JSON.parse(sql(iniciar('idem-abandono-1',`'${t.conversa_id}'`)));
 sql(`update conversas set turno_ate=now()-interval '1 second' where id='${t.conversa_id}'`);
 const vencido=JSON.parse(sql(iniciar('idem-abandono-1',`'${t.conversa_id}'`)));assert.equal(vencido.estado,'interrompido');console.log('ok: turno de resultado incerto não dispara nova chamada automaticamente');
 assert.throws(()=>sql(`set role service_role;select chat_responder('${L}','${U}','${novo.pergunta_id}','${novo.turno_token}','tardia','{}');`));console.log('ok: resultado tardio não atravessa reserva expirada');
}finally{sql(`delete from lojas where id='${L}'`)}
