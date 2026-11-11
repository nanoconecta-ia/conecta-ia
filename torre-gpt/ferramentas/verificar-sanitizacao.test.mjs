import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { verificar } from './verificar-sanitizacao.mjs';

async function pasta(arquivos) {
  const p = await mkdtemp(join(tmpdir(), 'torre-'));
  for (const [nome, conteudo] of Object.entries(arquivos)) { await mkdir(join(p, nome, '..'), { recursive: true }); await writeFile(join(p, nome), conteudo); }
  return p;
}

test('código limpo passa', async () => {
  const p = await pasta({ 'manifest.json': '{"manifest_version":3,"name":"Torre"}', 'sidepanel.js': 'const x = 1;\nexport default x;\n', 'sidepanel.html': '<p>ok</p>' });
  assert.deepEqual(await verificar(p), []); await rm(p, { recursive: true });
});

test('segredos, telefone e e-mail são barrados e o valor nunca é impresso por inteiro', async () => {
  const segredo = 'Bearer abcdefghijklmnop1234567890';
  const p = await pasta({ 'bridge.js': `fetch(u,{headers:{Authorization:"${segredo}"}});\nconst fone = "+55 11 91234-5678";\nconst mail = "cliente@exemplo.com";\n` });
  const a = await verificar(p);
  const tipos = a.map((x) => x.tipo);
  assert.ok(tipos.includes('Bearer com valor') && tipos.includes('telefone') && tipos.includes('e-mail'));
  assert.ok(a.every((x) => !x.trecho || !x.trecho.includes('abcdefghijklmnop1234567890')), 'valor completo não pode aparecer');
  await rm(p, { recursive: true });
});

test('atribuição de chave, JWT e prefixo conhecido são barrados', async () => {
  const p = await pasta({ 'a.js': 'const api_key = "supersecretvalue123";\nconst j = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghijklmnopqrstuv";\nconst k = "ghp_abcdefghijklmnopqrstuvwx";\n' });
  const tipos = (await verificar(p)).map((x) => x.tipo);
  assert.ok(tipos.includes('atribuição de segredo') && tipos.includes('JWT') && tipos.includes('prefixo de chave conhecida'));
  await rm(p, { recursive: true });
});

test('imagens, .env, cookies e arquivos grandes são barrados; README e ferramentas são ignorados', async () => {
  const p = await pasta({ 'captura.png': 'x', '.env': 'A=1', 'cookies.json': '{}', 'grande.js': 'a'.repeat(210 * 1024), 'README.md': 'Bearer abcdefghijklmnop1234567890', 'ferramentas/x.js': 'Bearer abcdefghijklmnop1234567890' });
  const a = await verificar(p);
  const por = Object.fromEntries(a.map((x) => [x.arquivo, x.tipo]));
  assert.match(por['captura.png'], /não permitido/); assert.match(por['.env'], /proibido/); assert.match(por['cookies.json'], /proibido/); assert.match(por['grande.js'], /200 KB/);
  assert.ok(!('README.md' in por) && !('ferramentas/x.js' in por));
  await rm(p, { recursive: true });
});
