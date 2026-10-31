// Nano Guardião, fase 3 — painel REAL + página SINTÉTICA de produto + rede SIMULADA (conecta-gateway interceptado):
// valores aprovados -> preencher campo a campo com clique -> conferência na tela -> desfazer. Nunca envia o formulário.
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
const APROVADOS = [
  { id: 'aaaaaaaa-0000-4000-8000-000000000001', campo: 'marca_peca', valor: 'TRIM GO AUTOPARTS', fonte: 'https://fab.exemplo/ci000016', aprovado_em: '2026-10-30T12:00:00Z' },
  { id: 'aaaaaaaa-0000-4000-8000-000000000002', campo: 'descricao_curta', valor: 'Bomba d’água com juntas para HR/K2500 2.5 8V Euro III', fonte: 'https://fab.exemplo/ci000016', aprovado_em: '2026-10-30T12:00:00Z' },
  { id: 'aaaaaaaa-0000-4000-8000-000000000003', campo: 'peso_kg', valor: '1.35', fonte: 'Catálogo TRIM GO 2026, p. 40', aprovado_em: '2026-10-30T12:00:00Z' },
  { id: 'aaaaaaaa-0000-4000-8000-000000000004', campo: 'categoria_sugerida', valor: 'Arrefecimento > Bombas d’água', fonte: 'Taxonomia aprovada', aprovado_em: '2026-10-30T12:00:00Z' },
  { id: 'aaaaaaaa-0000-4000-8000-000000000006', campo: 'espec:diametro_externo_mm', valor: '62', fonte: 'https://fab.exemplo/ci000016', aprovado_em: '2026-10-30T12:00:00Z' },
  { id: 'aaaaaaaa-0000-4000-8000-000000000007', campo: 'imagem', valor: 'https://cdn.exemplo/ci000016.jpg', fonte: 'busca_web', aprovado_em: '2026-10-30T12:00:00Z' },
  { id: 'aaaaaaaa-0000-4000-8000-000000000008', campo: 'seo_titulo', valor: 'Bomba d’água HR/K2500 2.5 8V | TRIM GO AUTOPARTS', fonte: 'Cadastro do ERP', aprovado_em: '2026-10-30T12:00:00Z' },
  { id: 'aaaaaaaa-0000-4000-8000-000000000005', campo: 'ncm_sugerido', valor: '8413.30.90', fonte: 'x', aprovado_em: '2026-10-30T12:00:00Z' },
];
let browser;
try {
  browser = await chromium.launch({ headless: true });
  for (const [w, h, servidorAntigo] of [[360, 1100, false], [420, 1100, false], [360, 900, true]]) {
    const erp = await browser.newPage(); await erp.goto(`${base}/produto`); await erp.addScriptTag({ url: `${base}/conteudo.js` });
    const p = await browser.newPage({ viewport: { width: w, height: h } }); const erros = []; p.on('pageerror', (e) => erros.push(e.message));
    const chamadas = [];
    await p.route('https://dsfzhsrudriqkumtlqwj.supabase.co/functions/v1/**', async (route) => {
      const c = route.request().postDataJSON() ?? {}, hd = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization,content-type,apikey' };
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: hd });
      chamadas.push(c.params?.name ?? c.acao);
      const res = (o) => route.fulfill({ status: 200, headers: hd, contentType: 'application/json', body: JSON.stringify({ jsonrpc: '2.0', id: c.id, result: { content: [{ type: 'text', text: JSON.stringify(o) }] } }) });
      if (c.params?.name === 'conecta.get_product') return res({ nome: 'Bomba d’água TRIM GO HR/K2500 2.5 8V Euro III com juntas', sku: 'CI000016', marca: 'TRIM GO AUTOPARTS', gtin: null, publicado: false, faltando_para_publicar: ['descrição'] });
      if (c.params?.name === 'conecta.get_validated_fields') return servidorAntigo
        ? route.fulfill({ status: 200, headers: hd, contentType: 'application/json', body: JSON.stringify({ jsonrpc: '2.0', id: c.id, error: { code: -32602, message: 'Ferramenta desconhecida.' } }) })
        : res({ sku: 'CI000016', campos: APROVADOS });
      return route.abort();
    });
    await p.goto(`${base}/painel.html`);
    await p.exposeFunction('__lerErp', () => erp.evaluate(() => window.__nanoGuardiaoLer()));
    await p.exposeFunction('__preencherErp', (a, v) => erp.evaluate(([a2, v2]) => window.__nanoGuardiaoPreencher(a2, v2), [a, v]));
    await p.evaluate(() => { let mem = { token: 'T'.repeat(43) + '.' + 'S'.repeat(43), loja_id: 'loja-1', expira_em: new Date(Date.now() + 3600e3).toISOString() };
      window.__nanoIniciar({ lerAba: () => window.__lerErp(), abrirAba: () => {}, guardar: async (v) => { mem = v; }, carregar: async () => mem, esperar: (ms) => new Promise((r) => setTimeout(r, 20)), baixar: () => {}, preencher: (a, v) => window.__preencherErp(a, v) }); });
    const r = `${w}px${servidorAntigo ? ' servidor antigo' : ''}`;
    await p.click('#ler');
    if (servidorAntigo) {
      await p.getByText(/ainda não tem a fase 3/).waitFor();
      assert.equal(await erp.inputValue('#dc'), '', `${r}: nada preenchido`);
      await p.close(); await erp.close(); continue;
    }
    const lista = p.locator('#aprovados');
    await lista.getByText('Peso líquido').waitFor();
    const txt = await lista.innerText();
    assert.match(txt, /Marca[\s\S]*Já está na tela/, `${r}: marca igual não vira ação`);
    assert.ok(!/8413/.test(txt), `${r}: NCM (fiscal) nunca aparece para preencher`);
    // preencher vazio (descrição curta) com um clique
    const desc = lista.locator('li', { hasText: 'Descrição curta' });
    await desc.getByRole('button', { name: 'Preencher na tela' }).click();
    await desc.getByText(/Preenchido e conferido na tela/).waitFor();
    assert.equal(await erp.inputValue('#dc'), APROVADOS[1].valor, `${r}: valor aprovado na tela do ERP`);
    assert.ok((await erp.evaluate(() => window.__eventos)).includes('dc'), `${r}: dispara "input" (telas React/Vue percebem)`);
    // peso: vazio -> preencher
    const peso = lista.locator('li', { hasText: 'Peso líquido' });
    await peso.getByRole('button', { name: 'Preencher na tela' }).click();
    await peso.getByText(/conferido/).waitFor();
    assert.equal(await erp.inputValue('#pl'), '1.35');
    // categoria: opção não existe na lista do ERP -> não mexe e explica
    const cat = lista.locator('li', { hasText: 'Categoria' });
    const confirmar = cat.getByRole('checkbox');
    if (await confirmar.count()) { assert.equal(await cat.getByRole('button', { name: 'Preencher na tela' }).isDisabled(), true, `${r}: substituir exige marcar a confirmação`); await confirmar.check(); }
    await cat.getByRole('button', { name: 'Preencher na tela' }).click();
    await cat.getByText(/não existe na lista do ERP/).waitFor();
    assert.equal(await erp.$eval('#cat', (e) => e.selectedOptions[0].textContent), 'Arrefecimento', `${r}: select intacto`);
    // especificação técnica (campo customizado), imagem aprovada e SEO
    for (const [rotulo, sel, valor] of [['Diâmetro externo (mm)', '#cc1', '62'], ['URL da imagem', '#img', 'https://cdn.exemplo/ci000016.jpg'], ['Título SEO', '#seot', 'Bomba d’água HR/K2500 2.5 8V | TRIM GO AUTOPARTS']]) {
      const item = lista.locator('li', { hasText: rotulo });
      await item.getByRole('button', { name: 'Preencher na tela' }).click();
      await item.getByText(/conferido/).waitFor();
      assert.equal(await erp.inputValue(sel), valor, `${r}: ${rotulo} preenchido`);
    }
    await mkdir(repo + 'evidencias-issue-166', { recursive: true }); await p.screenshot({ path: `${repo}evidencias-issue-166/guardiao-fase3-${w}.png`, fullPage: true });
    // desfazer a descrição
    await desc.getByRole('button', { name: 'Desfazer' }).click();
    await desc.getByText(/Desfeito/).waitFor();
    assert.equal(await erp.inputValue('#dc'), '', `${r}: desfazer volta ao valor anterior`);
    assert.match(await p.innerText('#historico'), /Descrição curta: desfeito[\s\S]*Descrição curta: preenchido e conferido/);
    // nunca salva/envia, nunca mexe em sensível
    assert.equal(await erp.evaluate(() => window.__enviado === true), false, `${r}: formulário nunca enviado`);
    assert.equal(await erp.inputValue('#pc'), '41,90'); assert.equal(await erp.inputValue('#ncm'), '8413.30.90');
    assert.ok(!chamadas.some((n) => /propose|report|save|salvar/i.test(String(n))), `${r}: preencher não chama escrita no servidor`);
    assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${r}: sem rolagem horizontal`);
    assert.deepEqual(erros, []); await p.close(); await erp.close();
  }
  console.log('fase 3 ok (360/420px): só aprovados (inclui espec técnica, imagem e SEO), um clique por campo, conferência na tela, substituir exige confirmação, select inexistente não mexe, desfazer, nunca salva; servidor antigo = aviso');
} finally { await browser?.close(); srv.close(); }
