// Nano Guardião — Contexto Vivo (produto aberto no ERP → Nano): painel REAL com rede 100% SIMULADA. Prova: só com o interruptor ligado, sem permissão não manda nada,
// manda SÓ o SKU da tela (nunca loja/usuário), mostra o sucesso REAL do servidor, não repete o mesmo SKU, fecha quando a tela deixa de ser produto e orienta reconectar sem o escopo.
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const raiz = new URL('../', import.meta.url).pathname, repo = new URL('../../', import.meta.url).pathname;
const { chromium } = createRequire(repo + 'painel/package.json')('playwright');
execFileSync(process.execPath, [raiz + 'construir.mjs'], { stdio: 'ignore' });
const tipos = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css' };
const srv = createServer(async (q, r) => { const caminho = q.url === '/produto' ? raiz + 'testes/fixture-produto.html' : raiz + 'dist' + q.url.split('?')[0];
  try { const b = await readFile(caminho); r.writeHead(200, { 'content-type': tipos[caminho.slice(caminho.lastIndexOf('.'))] ?? 'text/plain' }); r.end(b); } catch { r.writeHead(404); r.end(); } });
await new Promise((ok) => srv.listen(0, '127.0.0.1', ok)); const base = `http://127.0.0.1:${srv.address().port}`;
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const erp = await browser.newPage(); await erp.goto(`${base}/produto`); await erp.addScriptTag({ url: `${base}/conteudo.js` });
  const leitura = await erp.evaluate(() => window.__nanoGuardiaoLer());
  const p = await browser.newPage({ viewport: { width: 380, height: 900 } }); const erros = []; p.on('pageerror', (e) => erros.push(e.message));
  const chamadas = []; let modo = 'ok';
  await p.route('https://dsfzhsrudriqkumtlqwj.supabase.co/functions/v1/**', async (route) => {
    const c = route.request().postDataJSON() ?? {};
    const h = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization,content-type,apikey' };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: h });
    const nome = c.params?.name, a = c.params?.arguments ?? {};
    const res = (o, erro = false) => route.fulfill({ status: 200, headers: h, contentType: 'application/json', body: JSON.stringify({ jsonrpc: '2.0', id: c.id, result: { content: [{ type: 'text', text: typeof o === 'string' ? o : JSON.stringify(o) }], isError: erro } }) });
    if (nome === 'conecta.set_active_product') {
      chamadas.push({ nome, args: a, auth: route.request().headers()['authorization'] });
      if (modo === 'sem-escopo') return res('Permissão negada: esta sessão não tem o escopo contexto:registrar. O lojista precisa parear de novo concedendo esse escopo.', true);
      return res({ ok: true, versao: chamadas.length + 2 });
    }
    return route.abort();
  });
  await p.goto(`${base}/painel.html`);
  let atual = leitura; let lidasSilenciosas = 0;
  await p.exposeFunction('__lerSilenciosa', () => { lidasSilenciosas++; return atual; });
  await p.evaluate((l) => { let mem = { token: 'T'.repeat(43) + '.' + 'S'.repeat(43), loja_id: 'loja-1', expira_em: new Date(Date.now() + 3600e3).toISOString() };
    window.__nanoIniciar({ lerAba: async () => l, lerAbaSilenciosa: () => window.__lerSilenciosa(), abrirAba: () => {}, guardar: async (v) => { mem = v; }, carregar: async () => mem, esperar: () => new Promise((r) => setTimeout(r, 20)), baixar: () => {} }); }, leitura);
  await p.locator('#loja').getByText('Conectado à loja').waitFor();
  // 1) desligado por padrão: nada é enviado
  assert.equal(await p.isChecked('#compartilhar-contexto'), false, 'o compartilhamento nasce DESLIGADO');
  await p.waitForTimeout(300); assert.equal(chamadas.length, 0); assert.equal(lidasSilenciosas, 0, 'desligado: nem lê a aba em segundo plano');
  // 2) liga: envia o SKU da tela, só ele
  await p.check('#compartilhar-contexto');
  await p.locator('#ctx-status').getByText(/Compartilhado com o Nano: produto .* \(versão 3\)/).waitFor();
  assert.equal(chamadas.length, 1); assert.equal(chamadas[0].args.acao, 'aberto'); assert.match(chamadas[0].args.sku, /^[A-Za-z0-9_.\/-]{1,60}$/);
  assert.deepEqual(Object.keys(chamadas[0].args).sort(), ['acao', 'sku'], 'vai só o SKU e a ação: nunca loja, usuário ou dados do produto');
  assert.match(chamadas[0].auth, /^Bearer /);
  // 3) mesmo SKU de novo: sem spam
  await p.waitForTimeout(4600); assert.equal(chamadas.length, 1, 'mesmo produto não é reenviado');
  // 4) a tela deixa de ser produto: fecha
  atual = { origem: leitura.origem, caminho: '/outra', titulo: 'Pedidos', campos: [] };
  await p.locator('#ctx-status').getByText('Nenhum produto aberto na tela; contexto limpo.').waitFor({ timeout: 8000 });
  assert.equal(chamadas.at(-1).args.acao, 'fechado');
  // 5) desligar interrompe a leitura em segundo plano
  await p.uncheck('#compartilhar-contexto'); const n = lidasSilenciosas; await p.waitForTimeout(4600); assert.equal(lidasSilenciosas, n, 'desligado: para de ler');
  assert.equal(await p.innerText('#ctx-status'), '');
  // 6) sessão antiga sem o escopo: mensagem de reconexão, nunca confirmação falsa
  modo = 'sem-escopo'; atual = leitura; await p.check('#compartilhar-contexto');
  await p.locator('#ctx-status').getByText(/Reconecte à loja para liberar/).waitFor();
  assert.doesNotMatch(await p.innerText('#ctx-status'), /Compartilhado com o Nano/);
  assert.deepEqual(erros, []);
  console.log('visual-contexto: ok');
} finally { await browser?.close(); srv.close(); }
