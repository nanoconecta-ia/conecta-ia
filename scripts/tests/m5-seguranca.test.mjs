import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { exigirLocal } from '../m5/limites.mjs';
import { extrairAutenticacao } from '../m5/preparar.mjs';
test('M5 recusa endpoints remotos, redirecionamento e outras portas', () => {
  for (const url of ['https://producao.supabase.co', 'http://localhost:54321', 'http://127.0.0.1:54322', 'http://127.0.0.1:54321@outro.invalid', 'http://127.0.0.1:54321/?projeto=remoto']) assert.throws(() => exigirLocal(url));
  assert.equal(exigirLocal('http://127.0.0.1:54321'), 'http://127.0.0.1:54321');
});
test('M5 só extrai função amr; não copia cron ou SQL arbitrário', () => {
  const sql = "create function private.autenticacao_recente(p_segundos int) returns boolean\nlanguage sql stable set search_path = '' as $$\nselect auth.jwt() -> 'amr';\n$$;\nselect cron.schedule('producao');";
  assert.ok(!extrairAutenticacao(sql).includes('cron'));
  assert.throws(() => extrairAutenticacao('create function alterada() returns int;'));
});
test('workflow M5 é manual, sem segredo, deploy, runner pago ou pull_request_target', async () => {
  const s = (await readFile(new URL('../../.github/workflows/m5-supabase-local.yml', import.meta.url), 'utf8')).replace(/^\s*#.*$/gm, '');
  assert.match(s, /workflow_dispatch:/); assert.match(s, /runs-on: ubuntu-24.04/); assert.match(s, /contents: read/);
  assert.ok(!/secrets\.|pull_request_target|functions deploy|supabase link|db push|self-hosted|id-token: write/.test(s));
});
