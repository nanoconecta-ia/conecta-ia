// Apenas Postgres descartável do job banco; nenhuma URL ou credencial remota.
import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import assert from 'node:assert/strict';
assert.equal(process.env.PGHOST, 'localhost');
const env = { ...process.env, PGDATABASE: 'conecta_teste' };
const args = ['-XqAt', '-v', 'ON_ERROR_STOP=1', '-c'];
const sql = q => execFileSync('psql', [...args, q], { env, encoding: 'utf8' }).trim();
const asyncSql = async q => (await promisify(execFile)('psql', [...args, q], { env })).stdout.trim();
const loja = 'cf000000-0000-0000-0000-000000000001';
const usuario = 'cf000000-0000-0000-0000-000000000002';
const conversa = 'cf000000-0000-0000-0000-000000000003';
const sessao = i => `cf000000-0000-0000-0001-00000000000${i}`;
const dispositivo = i => `cf000000-0000-0000-0002-00000000000${i}`;
const reivindicar = i => `set role service_role; select public.chat_fila_reivindicar('${sessao(i)}');`;
try {
  sql(`insert into lojas(id,nome,slug) values('${loja}','Fila QR concorrência','fila-qr-concorrencia');
    insert into usuarios_loja(loja_id,user_id,papel) values('${loja}','${usuario}','lojista');
    insert into conversas(id,loja_id,user_id,titulo) values('${conversa}','${loja}','${usuario}','Sintética');`);
  for (const i of [1, 2]) {
    sql(`insert into pair_dispositivos(id,loja_id,usuario_id,nome,tipo)
      values('${dispositivo(i)}','${loja}','${usuario}','Agente ${i}','agente_externo');
      insert into pair_sessoes(id,loja_id,usuario_id,dispositivo_id,token_hash,sal_hash,escopos,expira_em,limite_ate)
      values('${sessao(i)}','${loja}','${usuario}','${dispositivo(i)}',repeat('${i}',64),repeat('${i + 2}',64),array['chat:responder'],now()+interval '1 hour',now()+interval '1 hour');`);
  }
  sql(`insert into mensagens(loja_id,user_id,conversa_id,papel,conteudo,idempotency_key)
    select '${loja}','${usuario}','${conversa}','usuario','Pergunta ' || i,'fila-qr-' || i from generate_series(1,8) i;
    select public.chat_fila_enfileirar('${loja}',id,300) from mensagens where conversa_id='${conversa}';`);
  const respostas = await Promise.all(Array.from({ length: 8 }, () => asyncSql(reivindicar(1)).then(JSON.parse)));
  const entregues = respostas.filter(r => r.ok && r.vazio === false);
  assert.equal(entregues.length, 1);
  assert.equal(respostas.filter(r => r.ok && r.vazio && r.ocupado).length, 7);
  assert.equal(sql(`select count(*) from chat_fila where sessao_id='${sessao(1)}' and estado='entregue'`), '1');
  assert.equal(sql(`select count(*) from chat_fila where loja_id='${loja}' and estado='pendente'`), '7');
  console.log('ok: 8 conexões da mesma sessão entregam só uma mensagem e preservam as demais');

  const outra = JSON.parse(sql(reivindicar(2)));
  assert.equal(outra.vazio, false);
  assert.notEqual(outra.fila_id, entregues[0].fila_id);
  assert.equal(JSON.parse(sql(reivindicar(1))).ocupado, true);
  console.log('ok: outra sessão retira mensagem distinta sem desbloquear a sessão ocupada');

  const resposta = JSON.parse(sql(`set role service_role; select public.chat_fila_responder('${sessao(1)}','${entregues[0].fila_id}','Resposta sintética');`));
  assert.equal(resposta.ok, true);
  const proxima = JSON.parse(sql(reivindicar(1)));
  assert.equal(proxima.vazio, false);
  assert.notEqual(proxima.fila_id, entregues[0].fila_id);
  console.log('ok: responder libera a sessão para uma nova entrega');

  sql(`update chat_fila set criado_em=now()-interval '2 minutes', prazo_em=now()-interval '1 second' where id='${proxima.fila_id}'`);
  const aposPrazo = JSON.parse(sql(reivindicar(1)));
  assert.equal(aposPrazo.vazio, false);
  assert.notEqual(aposPrazo.fila_id, proxima.fila_id);
  assert.equal(sql(`select estado from chat_fila where id='${proxima.fila_id}'`), 'expirada');
  assert.equal(sql(`select count(*) from chat_fila where sessao_id='${sessao(1)}' and estado='entregue'`), '1');
  console.log('ok: expirar a entrega libera a sessão sem deixar duas entregas ativas');
} finally {
  // Elimina as dependências da sessão antes da cascata da loja, inclusive em caso de falha.
  sql(`delete from chat_fila where loja_id='${loja}'; delete from lojas where id='${loja}';`);
}
