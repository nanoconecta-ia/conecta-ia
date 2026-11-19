// Teste real em Chromium: as duas PWAs devem instalar com manifestos, ícones,
// workers e escopos distintos. Sem autenticação ou alteração de produção.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
const root = new URL('../../', import.meta.url).pathname, painel = root + 'painel/';
const require = createRequire(painel + 'package.json'), { chromium } = require('playwright');
const porta = 4186, base = 'http://127.0.0.1:' + porta;
const servidor = spawn(process.execPath, [painel + 'node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', String(porta), '--strictPort'], { cwd: painel, stdio: 'ignore' });
let browser;
try {
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(base + '/')).ok) break; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const manifestos = [];
  const instalacoes = [
    { pagina: '/', manifesto: 'mobis.webmanifest', worker: 'sw.js', scope: '/' },
    { pagina: '/conecta.html', manifesto: 'manifest.webmanifest', worker: 'sw-conecta.js', scope: '/conecta.html' },
  ];
  for (const item of instalacoes) {
    const resposta = await fetch(base + '/' + item.manifesto);
    assert.equal(resposta.status, 200, 'manifesto ausente ' + item.manifesto);
    const m = await resposta.json();
    manifestos.push(m);
    for (const campo of ['id','name', 'short_name', 'start_url', 'scope', 'display', 'background_color', 'theme_color']) assert.ok(m[campo], item.manifesto + ': campo ausente ' + campo);
    assert.equal(m.display, 'standalone');
    const tamanhos = new Set(m.icons.map((i) => i.sizes));
    assert.ok(tamanhos.has('192x192') && tamanhos.has('512x512'));
    assert.ok(m.icons.some((i) => i.purpose === 'maskable'));
    for (const icone of m.icons) {
      const icon = await fetch(new URL(icone.src, base + '/' + item.manifesto));
      assert.equal(icon.status, 200, item.manifesto + ': ícone ' + icone.src);
      assert.equal(icon.headers.get('content-type'), icone.type, item.manifesto + ': tipo incorreto ' + icone.src);
    }
    assert.equal((await fetch(base + '/' + item.worker)).status, 200, item.worker);
  }
  assert.notEqual(manifestos[0].id, manifestos[1].id, 'identidades instaladas são independentes');

  browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  for (const item of instalacoes) {
    const page = await ctx.newPage();
    await page.goto(base + item.pagina);
    const link = await page.locator('link[rel=manifest]').getAttribute('href');
    assert.equal(link, './' + item.manifesto, 'manifesto correto em ' + item.pagina);
    const registro = await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      return (await navigator.serviceWorker.getRegistrations()).map((r) => ({ scope: new URL(r.scope).pathname, worker: new URL((r.active || r.waiting || r.installing).scriptURL).pathname }));
    });
    assert.ok(registro.some((x) => x.scope === item.scope && x.worker === '/' + item.worker), 'worker independente ausente: ' + item.worker + ' ' + JSON.stringify(registro));
    const cdp = await ctx.newCDPSession(page);
    const { installabilityErrors } = await cdp.send('Page.getInstallabilityErrors');
    assert.deepEqual(installabilityErrors, [], 'Chrome recusou instalação ' + item.manifesto + ': ' + JSON.stringify(installabilityErrors));
    await page.close();
  }
  const final = await ctx.newPage();
  await final.goto(base + '/conecta.html');
  const regs = await final.evaluate(() => navigator.serviceWorker.getRegistrations().then((rs) => rs.map((r) => new URL(r.scope).pathname)));
  assert.ok(regs.includes('/') && regs.includes('/conecta.html'), 'os dois workers precisam coexistir');
  await ctx.close();
  console.log('pwa-instalavel OK: Chrome validou as duas PWAs, manifestos, instalação e escopos independentes');
} finally {
  await browser?.close();
  servidor.kill();
}
