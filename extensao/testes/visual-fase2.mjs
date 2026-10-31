// Nano Guardião, fase 2 — painel REAL com rede 100% SIMULADA (pair e conecta-gateway interceptados; nada sai da máquina):
// conectar à loja (Conecta Pair) -> aprovação -> ler a tela -> comparar com o espelho -> propor com fonte (Fila de aprovação).
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
const SAL = 'S'.repeat(43);
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const erp = await browser.newPage(); await erp.goto(`${base}/produto`); await erp.addScriptTag({ url: `${base}/conteudo.js` });
  const leitura = await erp.evaluate(() => window.__nanoGuardiaoLer());
  for (const [w, h] of [[360, 900], [420, 900]]) {
    const p = await browser.newPage({ viewport: { width: w, height: h } }); const erros = []; p.on('pageerror', (e) => erros.push(e.message));
    const chamadas = [], abertas = [];
    await p.route('https://dsfzhsrudriqkumtlqwj.supabase.co/functions/v1/**', async (route) => {
      const u = new URL(route.request().url()), c = route.request().postDataJSON() ?? {}, auth = route.request().headers()['authorization'];
      const h = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization,content-type,apikey' };
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: h });
      const json = (o, s = 200) => route.fulfill({ status: s, headers: h, contentType: 'application/json', body: JSON.stringify(o) });
      chamadas.push({ caminho: u.pathname, corpo: c, auth });
      if (u.pathname.endsWith('/pair') && c.acao === 'iniciar') return json({ codigo: 'c'.repeat(43), url: 'https://painel.exemplo/#/parear?c=ccc', verificacao: 'K7Q-42P', segredo: 's'.repeat(43), sal: SAL, expira_em: new Date(Date.now() + 120000).toISOString() });
      if (u.pathname.endsWith('/pair') && c.acao === 'consultar') return json(!abertas.length ? { estado: 'pendente' } : { estado: 'resgatado', loja_id: 'loja-1', escopos: ['produtos:ler', 'enriquecimento:propor'], sessao_expira_em: new Date(Date.now() + 8 * 3600e3).toISOString() });
      if (u.pathname.endsWith('/conecta-gateway')) {
        const nome = c.params?.name, a = c.params?.arguments ?? {};
        const res = (o) => json({ jsonrpc: '2.0', id: c.id, result: { content: [{ type: 'text', text: JSON.stringify(o) }] } });
        if (nome === 'conecta.get_product') return res({ nome: 'Bomba d’água TRIM GO HR/K2500 2.5 8V Euro III com juntas', sku: a.sku, marca: 'TRIM GO', gtin: null, descricao_curta: null, publicado: false, faltando_para_publicar: ['descrição', 'GTIN', 'peso', 'imagem principal aprovada'] });
        if (nome === 'conecta.propose_enrichment') return res({ ok: true, status: 'a_confirmar' });
        return json({ jsonrpc: '2.0', id: c.id, error: { code: -32602, message: 'Ferramenta desconhecida.' } });
      }
      return route.abort();
    });
    await p.goto(`${base}/painel.html`);
    await p.exposeFunction('__abrirAba', (url) => abertas.push(url));
    await p.evaluate((l) => { let mem = null; window.__nanoIniciar({ lerAba: async () => l, abrirAba: (u) => window.__abrirAba(u), guardar: async (v) => { mem = v; }, carregar: async () => mem, esperar: (ms) => new Promise((r) => setTimeout(r, 20)), baixar: () => {} }); }, leitura);
    const r = `${w}px`;
    await p.click('#conectar');
    await p.getByText('Aguardando sua aprovação').waitFor();
    assert.match(await p.innerText('#loja'), /K7Q-42P[\s\S]*propor/, `${r}: código de verificação e escopos visíveis`);
    await p.click('#abrir-aprovacao'); await p.waitForTimeout(50);
    assert.deepEqual(abertas, ['https://painel.exemplo/#/parear?c=ccc'], `${r}: abre a aprovação no painel`);
    await p.locator('#loja').getByText('Conectado à loja').waitFor();
    await p.click('#ler');
    await p.getByText('Ainda não publicado').waitFor();
    const espTxt = await p.innerText('#espelho');
    assert.match(espTxt, /GTIN\/EAN difere do espelho|Marca difere do espelho/, `${r}: divergência tela x espelho`);
    assert.match(espTxt, /Falta para publicar: descrição, GTIN, peso/);
    // proposta sem fonte é barrada no próprio painel; com fonte vai para a Fila
    const li = p.locator('#pendencias li[data-canonico="descricaoCurta"]');
    await li.getByRole('button', { name: 'Propor com fonte' }).click();
    await li.getByLabel('Valor').fill('Bomba d’água com juntas para HR/K2500 2.5 8V');
    await li.getByLabel('Fonte (link ou documento)').fill('x');
    await li.getByRole('button', { name: 'Enviar proposta' }).click();
    await li.getByText(/Informe a fonte/).waitFor();
    await mkdir(repo + 'evidencias-issue-166', { recursive: true }); await p.screenshot({ path: `${repo}evidencias-issue-166/guardiao-fase2-${w}.png`, fullPage: true });
    await li.getByLabel('Fonte (link ou documento)').fill('https://fabricante.exemplo/ci000016');
    await li.getByRole('button', { name: 'Enviar proposta' }).click();
    await li.getByText(/Proposta enviada à Fila de aprovação/).waitFor();
    // SEO a partir da sugestão (pré-preenchida, editável) e especificação técnica de campo customizado
    const sugSeo = p.locator('#sugestoes li', { hasText: 'Título SEO' });
    await sugSeo.getByRole('button', { name: 'Propor para a Fila' }).click();
    assert.ok((await sugSeo.getByLabel('Valor').inputValue()).length <= 70, `${r}: título SEO sugerido até 70`);
    await sugSeo.getByRole('button', { name: 'Enviar proposta' }).click();
    await sugSeo.getByText(/Proposta enviada/).waitFor();
    const esp = p.locator('#especs li', { hasText: 'Diâmetro externo (mm)' });
    await esp.getByRole('button', { name: 'Propor com fonte' }).click();
    await esp.getByLabel('Valor').fill('62'); await esp.getByLabel('Fonte (link ou documento)').fill('https://fab.exemplo/ci000016');
    await esp.getByRole('button', { name: 'Enviar proposta' }).click();
    await esp.getByText(/Proposta enviada/).waitFor();
    const iniciar = chamadas.find((x) => x.corpo.acao === 'iniciar');
    assert.equal(iniciar.corpo.tipo, 'navegador'); assert.deepEqual(iniciar.corpo.escopos, ['produtos:ler', 'enriquecimento:propor']);
    const gw = chamadas.filter((x) => x.caminho.endsWith('/conecta-gateway'));
    assert.ok(gw.every((x) => /^Bearer [A-Za-z0-9_-]{43}\.S{43}$/.test(x.auth)), `${r}: token <metade>.<sal> em toda chamada`);
    assert.ok(gw.every((x) => !('loja_id' in (x.corpo.params?.arguments ?? {}))), `${r}: nunca manda loja_id (a sessão decide)`);
    const prop = gw.find((x) => x.corpo.params.name === 'conecta.propose_enrichment' && x.corpo.params.arguments.campo === 'descricao_curta');
    assert.deepEqual(prop.corpo.params.arguments, { sku: 'CI000016', campo: 'descricao_curta', valor: 'Bomba d’água com juntas para HR/K2500 2.5 8V', fonte: 'https://fabricante.exemplo/ci000016' });
    const props = gw.filter((x) => x.corpo.params.name === 'conecta.propose_enrichment').map((x) => x.corpo.params.arguments.campo);
    assert.deepEqual(props, ['descricao_curta', 'seo_titulo', 'espec:diametro_externo_mm'], `${r}: proposta sem fonte não saiu; SEO e espec com o campo certo`);
    const txt = await p.innerText('main'); for (const v of ['41,90', 'Distribuidora X', '8413.30.90']) assert.ok(!txt.includes(v), `${r}: não mostra ${v}`);
    assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${r}: sem rolagem horizontal`);
    assert.deepEqual(erros, []); await p.close();
  }
  console.log('fase 2 ok (360/420px): pareamento com código, espelho com divergência, proposta só com fonte, token e escopos corretos, nada no ERP');
} finally { await browser?.close(); srv.close(); }
