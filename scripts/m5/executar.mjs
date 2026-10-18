// Integração REAL local (GoTrue, PostgREST, edge-runtime). Nenhuma chamada externa de IA/Bling.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import { exigirLocal } from './limites.mjs';

const status = JSON.parse(await readFile(process.argv[2], 'utf8'));
const url = exigirLocal(status.API_URL);
const anon = status.ANON_KEY, service = status.SERVICE_ROLE_KEY;
assert.ok(anon && service, 'Chaves exclusivamente do stack local são obrigatórias.');
const resultados = [], usuarios = [];
const registrar = (id, evidencia) => { resultados.push({ id, estado: 'passou', evidencia }); console.log(`${id}: passou — ${evidencia}`); };
const sha = (s) => createHash('sha256').update(s).digest('hex');
const jwt = (t) => JSON.parse(Buffer.from(t.split('.')[1], 'base64url').toString());
async function api(path, body, token, method = 'POST', key = anon) {
  assert.ok(path.startsWith('/') && !path.startsWith('//'));
  return fetch(url + path, { method, redirect: 'error', headers: { apikey: key, 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(30000) });
}
async function ok(r, etapa) { assert.ok(r.ok, `${etapa}: HTTP ${r.status}`); return r.json(); }
function amr(t) { const a = jwt(t).amr; assert.ok(Array.isArray(a) && a.length > 0); assert.ok(a.every((e) => typeof e.method === 'string' && Number.isInteger(e.timestamp))); return a; }
async function login() {
  const email = `m5-${randomUUID()}@example.test`, password = `M5-sintetico-${randomUUID()}!`;
  const user = await ok(await api('/auth/v1/admin/users', { email, password, email_confirm: true }, service, 'POST', service), 'criar usuário sintético');
  usuarios.push(user.id);
  return ok(await api('/auth/v1/token?grant_type=password', { email, password }), 'login por senha');
}
function totp(secret) {
  let bits = ''; for (const c of secret.toUpperCase().replace(/=+$/, '')) { const n = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'.indexOf(c); assert.ok(n >= 0); bits += n.toString(2).padStart(5, '0'); }
  const bytes = []; for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const h = createHmac('sha1', Buffer.from(bytes)).update(counter).digest(), off = h[19] & 15;
  return ((h.readUInt32BE(off) & 0x7fffffff) % 1000000).toString().padStart(6, '0');
}
try {
  const sessao = await login(); const antes = amr(sessao.access_token);
  assert.ok(antes.some((a) => a.method === 'password'));
  assert.equal(await ok(await api('/rest/v1/rpc/m5_recente', { p_segundos: 300 }, sessao.access_token), 'RPC amr real'), true);
  registrar('M5-1', 'JWT real: amr numérico; função original do #23 retorna true via PostgREST.');

  const segunda = await login();
  const fator = await ok(await api('/auth/v1/factors', { factor_type: 'totp', friendly_name: 'm5-sintetico' }, segunda.access_token), 'MFA enroll');
  const desafio = await ok(await api(`/auth/v1/factors/${fator.id}/challenge`, {}, segunda.access_token), 'MFA challenge');
  const mfa = await ok(await api(`/auth/v1/factors/${fator.id}/verify`, { challenge_id: desafio.id, code: totp(fator.totp.secret) }, segunda.access_token), 'MFA verify');
  const metodos = amr(mfa.access_token).map((a) => a.method);
  assert.equal(jwt(mfa.access_token).aal, 'aal2'); assert.ok(metodos.some((m) => /totp|mfa/i.test(m)));
  registrar('M5-3-MFA', 'MFA TOTP real com dados sintéticos; aal2 e métodos confirmados.');
  resultados.push({ id: 'M5-3-OAuth', estado: 'nao_executado', evidencia: 'Sem provedor OAuth local configurado; não conectar credenciais remotas. M5 permanece parcial.' });

  for (const [id, token] of [['M5-4', 'token-opaco.' + 's'.repeat(64)], ['M5-5', Buffer.from('{"alg":"HS256"}').toString('base64url') + '.' + Buffer.from('{"exp":1}').toString('base64url') + '.assinatura-invalida']]) {
    const r = await ok(await api('/functions/v1/m5-eco', {}, token), id);
    assert.equal(r.sha256, sha('Bearer ' + token)); assert.equal(r.tamanho, token.length + 7);
    registrar(id, 'verify_jwt=false preserva bearer opaco/inválido, conferido por hash; sem registrar token.');
  }
  assert.equal((await api('/functions/v1/m5-eco', {})).status, 200);
  for (const n of [100, 3000]) {
    const token = 'x'.repeat(n); const r = await ok(await api('/functions/v1/m5-eco', {}, token), 'cabeçalho longo');
    assert.equal(r.sha256, sha('Bearer ' + token)); assert.equal(r.tamanho, n + 7);
  }
  const preflight = await fetch(url + '/functions/v1/m5-eco', { method: 'OPTIONS', headers: { origin: 'http://localhost:5173', 'access-control-request-method': 'POST', 'access-control-request-headers': 'authorization,apikey,content-type' }, redirect: 'error' });
  assert.ok(preflight.ok); assert.ok(preflight.headers.get('access-control-allow-headers')?.includes('authorization'));
  registrar('M5-6', 'Preflight e cabeçalhos de 100/3000 caracteres aceitos.');
  for (const f of ['assistente', 'm5-estrito']) for (const token of [undefined, 'token-opaco.sal']) assert.equal((await api('/functions/v1/' + f, {}, token)).status, 401);
  assert.equal((await api('/functions/v1/m5-estrito', {}, sessao.access_token)).status, 200);
  registrar('M5-7', 'verify_jwt=true rejeita sem JWT/opaco no artefato assistente; controle aceita JWT real. Só gateway LOCAL.');

  console.log('M5-2: aguardando 310 s para testar refresh após a janela real de 5 min.');
  await new Promise((r) => setTimeout(r, 310000));
  const refresh = await ok(await api('/auth/v1/token?grant_type=refresh_token', { refresh_token: sessao.refresh_token }), 'refresh');
  assert.deepEqual(amr(refresh.access_token), antes);
  assert.equal(await ok(await api('/rest/v1/rpc/m5_recente', { p_segundos: 300 }, refresh.access_token), 'RPC após refresh'), false);
  registrar('M5-2', 'Após >5 min, refresh não avança amr e não renova autenticação recente.');
} catch (e) {
  resultados.push({ id: 'falha', estado: 'falhou', evidencia: e instanceof assert.AssertionError ? e.message : 'Erro no teste local; consultar etapa, sem corpos/tokens.' });
  process.exitCode = 1;
} finally {
  for (const id of usuarios) { try { await api('/auth/v1/admin/users/' + id, undefined, service, 'DELETE', service); } catch { process.exitCode = 1; } }
  await writeFile(process.argv[3], JSON.stringify({ ambiente: 'supabase-local-sintetico', m5_completo: false, limite: 'OAuth e gateway de nuvem pendentes; nenhuma prova de produção.', resultados }, null, 2));
}
