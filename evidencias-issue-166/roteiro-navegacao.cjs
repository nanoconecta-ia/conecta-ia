const { chromium } = require('playwright');
// Uso: (cd painel && npx vite --port 5179) e depois: node evidencias-issue-166/roteiro-navegacao.cjs <pasta-saida>
const OUT = process.argv[2] || 'shots';
(async () => {
  const b = await chromium.launch();
  const errs = [];
  async function page(w, h, tag, recolhido) {
    const ctx = await b.newContext({ viewport: { width: w, height: h } });
    const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(tag + ': ' + e.message));
    await p.addInitScript((r) => { try { localStorage.setItem('conecta:menu', r ? 'recolhido' : 'aberto'); } catch {} }, recolhido);
    await p.goto('http://localhost:5179/?demo=1#/catalogo');
    await p.waitForTimeout(1500);
    return p;
  }
  // desktop
  let p = await page(1366, 860, 'desk', false);
  await p.screenshot({ path: `${OUT}/desktop-catalogo.png` });
  const grupos = await p.$$eval('details.menu-grupo', ds => ds.map(d => ({ t: d.querySelector('summary').textContent.trim(), open: d.open, itens: [...d.querySelectorAll('a')].map(a => a.getAttribute('href')) })));
  console.log(JSON.stringify(grupos));
  // visit every route and check something renders, no crash
  const rotas = grupos.flatMap(g => g.itens);
  for (const r of rotas) {
    await p.goto('http://localhost:5179/?demo=1' + r); await p.waitForTimeout(500);
    const info = await p.evaluate(() => ({ main: (document.querySelector('main')?.innerText || '').slice(0, 70).replace(/\n/g, ' | '), open: [...document.querySelectorAll('details.menu-grupo')].filter(d => d.open).map(d => d.querySelector('summary').textContent.trim()) }));
    console.log(r, '=>', JSON.stringify(info));
  }
  // collapsed
  p = await page(1366, 860, 'desk-recolhido', true);
  await p.screenshot({ path: `${OUT}/desktop-recolhido.png` });
  // mobile
  p = await page(390, 844, 'mobile', false);
  await p.screenshot({ path: `${OUT}/m390-catalogo.png` });
  await p.click('.menu-movel-acionar'); await p.waitForTimeout(500);
  await p.screenshot({ path: `${OUT}/m390-menu.png` });
  const sw = await p.evaluate(() => document.documentElement.scrollWidth);
  console.log('mobile scrollWidth', sw);
  console.log('errors', JSON.stringify(errs));
  await b.close();
})();
