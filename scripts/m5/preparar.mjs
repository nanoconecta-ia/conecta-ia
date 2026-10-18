import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export function extrairAutenticacao(sql) {
  const bloco = sql.match(/^create function private\.autenticacao_recente\(p_segundos int\) returns boolean\nlanguage sql stable set search_path = '' as \$\$\n[\s\S]*?^\$\$;/m)?.[0];
  if (!bloco || !bloco.includes("auth.jwt() -> 'amr'")) throw Error('Contrato da função de autenticação mudou; revisar antes do M5.');
  return bloco;
}

export async function preparar(destino, referencia) {
  // Somente a função necessária ao M5. Nunca copiar migrations do produto: elas incluem cron com URLs de produção.
  const sql = extrairAutenticacao(await readFile(referencia, 'utf8'));
  const raiz = resolve(destino, 'supabase');
  const config = resolve(raiz, 'config.toml');
  let toml = await readFile(config, 'utf8');
  if (toml.includes('[functions.m5-eco]')) throw Error('Use um diretório M5 novo.');
  // A fixture usa TOTP real; habilitar explicitamente no stack descartável.
  const totp = '[auth.mfa.totp]\nenroll_enabled = true\nverify_enabled = true\n';
  toml = /^\[auth\.mfa\.totp\]/m.test(toml)
    ? toml.replace(/^\[auth\.mfa\.totp\][\s\S]*?(?=^\[|$(?![\s\S]))/m, totp)
    : toml + '\n' + totp;
  toml += '\n[functions.m5-eco]\nverify_jwt = false\n[functions.m5-estrito]\nverify_jwt = true\n[functions.assistente]\nverify_jwt = true\n';
  await writeFile(config, toml);
  await mkdir(resolve(raiz, 'migrations'), { recursive: true });
  // Fixture de teste, gerada só no diretório descartável; não é migração do produto.
  await writeFile(resolve(raiz, 'migrations/20200101000000_m5_fixture.sql'), `create schema if not exists private;\n${sql}\nrevoke all on function private.autenticacao_recente(int) from public, anon, authenticated;\ncreate function public.m5_recente(p_segundos int) returns boolean language sql stable security definer set search_path = '' as $$ select auth.uid() is not null and private.autenticacao_recente(p_segundos); $$;\nrevoke all on function public.m5_recente(int) from public, anon;\ngrant execute on function public.m5_recente(int) to authenticated;\n`);
  const eco = `const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'content-type': 'application/json' };\nDeno.serve(async (req) => { if (req.method === 'OPTIONS') return new Response(null, {status: 204, headers}); const auth = req.headers.get('authorization') ?? ''; const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(auth)); const sha256 = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join(''); return new Response(JSON.stringify({ tamanho: auth.length, sha256 }), {headers}); });\n`;
  for (const nome of ['m5-eco', 'm5-estrito']) {
    await mkdir(resolve(raiz, 'functions', nome), { recursive: true });
    await writeFile(resolve(raiz, 'functions', nome, 'index.ts'), eco);
  }
  const repo = fileURLToPath(new URL('../../', import.meta.url));
  await mkdir(resolve(raiz, 'functions/assistente'), { recursive: true });
  await writeFile(resolve(raiz, 'functions/assistente/index.ts'), await readFile(resolve(repo, 'artifacts/assistente/index.ts'), 'utf8'));
  console.log('Fixture M5 sem cron; SHA256 da função do #23: ' + createHash('sha256').update(sql).digest('hex'));
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await preparar(process.argv[2], process.argv[3]);
