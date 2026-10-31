// Nano Guardião: (1) a extensão carrega no Chromium (manifest válido, service worker ativo); (2) a leitura numa página
// SINTÉTICA de produto respeita as regras (senha/oculto fora, sensíveis mascarados); (3) o painel na largura lateral mostra
// reconhecimento, pendências e sugestão de tags, sem preencher nada. Rede: só 127.0.0.1.
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const raiz = new URL('../', import.meta.url).pathname, repo = new URL('../../', import.meta.url).pathname;
const { chromium } = createRequire(repo + 'painel/package.json')('playwright');
execFileSync(process.execPath, [raiz + 'construir.mjs'], { stdio: 'ignore' });
const tipos = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css' };
const srv = createServer(async (q, r) => { const caminho = q.url === '/produto' ? raiz + 'testes/fixture-produto.html' : raiz + 'dist' + q.url.split('?')[0];
  try { const b = await readFile(caminho); r.writeHead(200, { 'content-type': tipos[caminho.slice(caminho.lastIndexOf('.'))] ?? 'text/plain' }); r.end(b); } catch { r.writeHead(404); r.end(); } });
await new Promise((ok) => srv.listen(0, '127.0.0.1', ok)); const base = `http://127.0.0.1:${srv.address().port}`;
let ctx, browser;
try {
  // 1) extensão carrega
  ctx = await chromium.launchPersistentContext('', { headless: false, args: ['--headless=new', `--disable-extensions-except=${raiz}dist`, `--load-extension=${raiz}dist`] });
  let sw = ctx.serviceWorkers()[0]; if (!sw) sw = await ctx.waitForEvent('serviceworker', { timeout: 10000 });
  const idExt = new URL(sw.url()).host;
  const pp = await ctx.newPage(); await pp.goto(`chrome-extension://${idExt}/painel.html`);
  assert.equal(await pp.title(), 'Nano.IA', 'painel lateral abre a partir da extensão');
  console.log('1. extensão carregada, service worker ativo, painel abre');
  await ctx.close(); ctx = null;

  // 2) leitura na página sintética + 3) painel
  browser = await chromium.launch({ headless: true });
  const erp = await browser.newPage(); await erp.goto(`${base}/produto`);
  await erp.addScriptTag({ url: `${base}/conteudo.js` });
  const leitura = await erp.evaluate(() => window.__nanoGuardiaoLer());
  const rot = leitura.campos.map((c) => c.rotulo);
  assert.ok(!rot.includes('Senha') && !rot.includes('Campo escondido') && !leitura.campos.some((c) => c.nome === 'csrf'), 'senha, oculto e hidden fora');
  for (const r of ['Preço de compra', 'Fornecedor', 'NCM']) assert.equal(leitura.campos.find((c) => c.rotulo === r).valor, '', `${r} mascarado`);
  assert.equal(leitura.caminho, '/produto');
  const valorAntes = await erp.inputValue('#gtin');
  console.log('2. leitura ok:', leitura.campos.length, 'campos, sensíveis mascarados');

  for (const [w, h] of [[360, 800], [420, 900]]) {
    const p = await browser.newPage({ viewport: { width: w, height: h } }); const erros = []; p.on('pageerror', (e) => erros.push(e.message));
    await p.goto(`${base}/painel.html`);
    await p.evaluate((l) => window.__nanoMostrar(l), leitura);
    const txt = await p.innerText('main');
    assert.match(txt, /Cadastro de produto reconhecido/); assert.match(txt, /a confirmar/);
    assert.match(txt, /GTIN\/EAN[\s\S]*fonte verificável/); assert.match(txt, /bomba/);
    for (const v of ['41,90', 'Distribuidora X', '8413.30.90', 'segredo']) assert.ok(!txt.includes(v), `${w}px: não mostra ${v}`);
    assert.equal(await p.isEnabled('#registrar'), true);
    const largos = await p.evaluate(() => [...document.querySelectorAll('body *')].filter((e) => e.getBoundingClientRect().right > innerWidth + 0.5).map((e) => `${e.tagName}.${e.className}#${e.id}:${Math.round(e.getBoundingClientRect().right)}`).slice(0, 6));
    assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${w}px: sem rolagem horizontal ${JSON.stringify(largos)}`);
    await mkdir(repo + 'evidencias-issue-166', { recursive: true }); await p.screenshot({ path: `${repo}evidencias-issue-166/guardiao-painel-${w}.png`, fullPage: true });
    assert.deepEqual(erros, []); await p.close();
  }
  assert.equal(await erp.inputValue('#gtin'), valorAntes, 'a página do ERP não foi alterada');
  console.log('3. painel ok em 360/420px; nada preenchido no ERP');
} finally { await ctx?.close(); await browser?.close(); srv.close(); }
