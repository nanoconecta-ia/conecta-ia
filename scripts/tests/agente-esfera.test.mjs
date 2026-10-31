// Nano.IA sem esfera: ícone estático, privacidade e acesso integrado ao chat.
// Painel REAL compilado + sessão FALSA no navegador; TODA chamada ao Supabase é interceptada e respondida com dado sintético (nenhuma rede de produção, nenhuma escrita).
// Uso: node scripts/tests/agente-esfera.test.mjs   (compila o painel em painel/dist antes, se ainda não existir)
import { createRequire } from 'node:module';
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
const root = new URL('../../', import.meta.url).pathname, painel = root + 'painel/';
const require = createRequire(painel + 'package.json'), { chromium } = require('playwright');
if (!existsSync(painel + 'dist/index.html')) execFileSync(process.execPath, [painel + 'node_modules/vite/bin/vite.js', 'build'], { cwd: painel, stdio: 'ignore' });
const PORTA = process.env.PORTA_TESTE || '4182', SAIDA = process.env.SAIDA_EVIDENCIAS || root + 'evidencias-agente';
mkdirSync(SAIDA, { recursive: true });
const servidor = spawn(process.execPath, [painel + 'node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', PORTA, '--strictPort'], { cwd: painel, stdio: 'ignore' });
const REF = 'dsfzhsrudriqkumtlqwj', LOJA = { id: 'aaaaaaaa-0000-0000-0000-000000000001', nome: 'Loja de teste', slug: 'teste', modo_venda: 'whatsapp', ambiente: 'teste', perfil_ramo: 'autopecas' };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: 'u-teste', role: 'authenticated', exp: 4102444800, aud: 'authenticated' })}.sintetico`;
const sessao = { access_token: jwt, refresh_token: 'sintetico', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user: { id: 'u-teste', email: 'teste@exemplo.invalid', aud: 'authenticated', role: 'authenticated' } };
let browser; const falhas = [];
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch(`http://127.0.0.1:${PORTA}/`)).ok) break; } catch {} await new Promise((r) => setTimeout(r, 100)); }
  browser = await chromium.launch();
  const novaPagina = async (largura, altura, reduzir = false) => {
    const ctx = await browser.newContext({ viewport: { width: largura, height: altura }, reducedMotion: reduzir ? 'reduce' : 'no-preference', hasTouch: largura < 600 });
    await ctx.addInitScript(([ref, s]) => { try { localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(s)); localStorage.setItem('conecta.tema', 'claro'); } catch {} }, [REF, sessao]);
    const p = await ctx.newPage();
    await p.route('**/*', (rota) => {
      const u = new URL(rota.request().url());
      if (u.hostname === '127.0.0.1') return rota.continue();
      if (u.hostname !== `${REF}.supabase.co`) return rota.abort();
      const metodo = rota.request().method();
      const cab = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'content-type': 'application/json' };
      if (metodo === 'OPTIONS') return rota.fulfill({ status: 204, headers: cab });
      if (metodo !== 'GET' && !u.pathname.startsWith('/functions/') && u.pathname !== '/rest/v1/rpc/pode_administrar_loja') { falhas.push(`escrita inesperada ${metodo} ${u.pathname}`); return rota.abort(); }
      if (u.pathname.startsWith('/rest/v1/lojas')) return rota.fulfill({ status: 200, headers: cab, body: JSON.stringify([LOJA]) });
      if (u.pathname.startsWith('/rest/v1/')) return rota.fulfill({ status: 200, headers: cab, body: '[]' });
      return rota.fulfill({ status: 200, headers: cab, body: JSON.stringify({ ok: true, historico: [], conversas: [] }) });
    });
    return p;
  };
  const ir = async (p, caminho) => { await p.goto(`http://127.0.0.1:${PORTA}/#${caminho}`, { waitUntil: 'networkidle' }); await p.waitForSelector('main', { timeout: 8000 }); };

  const verifica = (ok, msg) => { if (!ok) falhas.push(msg); console.log((ok ? 'ok      ' : 'FALHOU  ') + msg); };

  // 1) Identidade estática e status legível, sem esfera.
   let p = await novaPagina(390, 844); await ir(p, '/assistente');
   await p.getByRole('img', { name: 'Nano.IA' }).waitFor();
   verifica((await p.locator('.esfera,.esfera-caixa,.balao-genesis').count()) === 0,'nenhuma esfera no chat');
   verifica(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'assistente no celular sem rolagem horizontal');
  const campo = p.getByLabel(/Pergunte/).first();
  verifica(await campo.count() > 0 && await campo.isVisible().catch(() => false), 'campo de mensagem visível no celular');
  // interface em modo conversa: compositor visível sem rolar, esfera discreta, configurações recolhidas, consentimento nunca marcado sozinho
  const dim = await p.evaluate(() => { const c = document.querySelector('.chat-compositor'); const e = document.querySelector('.agente-identidade-icone'); const abas = document.querySelector('.abas'); const r = c?.getBoundingClientRect(); const barra = document.querySelector('.barra-status')?.getBoundingClientRect(); return { compositorBase: r ? Math.round(r.bottom) : null, barraTopo: barra ? Math.round(barra.top) : null, icone: e ? Math.round(e.getBoundingClientRect().width) : null, configAberta: abas ? (abas.dataset.esq === 'aberto' || abas.dataset.dir === 'aberto') : null, consentimentoMarcado: [...document.querySelectorAll('.chat-compositor input[type=checkbox]')].some((i) => i.checked && /Enviar esta pergunta/.test(i.closest('label')?.textContent ?? '')) }; });
  verifica(dim.compositorBase !== null && dim.compositorBase <= dim.barraTopo + 1, `compositor visível na primeira tela, acima da barra inferior (base ${dim.compositorBase}px, barra em ${dim.barraTopo}px)`);
  verifica(dim.icone !== null && dim.icone <= 48, 'ícone estático acessível no cabeçalho');
  verifica(dim.configAberta === false, 'abas laterais (conversas e modelo) recolhidas por padrão');
  verifica(dim.consentimentoMarcado === false, 'consentimento de envio ao provedor nunca vem marcado');
  await p.getByRole('button', { name: 'Modelo e privacidade' }).click(); await p.waitForTimeout(350); verifica(await p.getByLabel('Modelo de IA').isVisible(), 'seletor de modelo acessível ao abrir a aba lateral'); await p.screenshot({ path: `${SAIDA}/assistente-aba-modelo-celular.png` });
  await p.getByRole('button', { name: 'Recolher modelo e privacidade' }).click();
  await p.getByRole('button', { name: 'Conversas', exact: true }).click(); await p.waitForTimeout(350); verifica(await p.getByRole('complementary', { name: 'Conversas' }).isVisible(), 'aba de conversas abre'); await p.screenshot({ path: `${SAIDA}/assistente-aba-conversas-celular.png` });
  await p.getByRole('button', { name: 'Recolher conversas' }).click();
  await p.waitForTimeout(350); await p.screenshot({ path: `${SAIDA}/assistente-conversa-celular.png` });
  // O estado operacional é apresentado como texto, sem animação decorativa.
   verifica(await p.getByText('Pronto para ajudar').count() > 0,'estado do agente exposto em texto');
   // a barra fixa de baixo não pode cobrir o fim do conteúdo quando a página rola até o fim
  await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const sobreposicao = await p.evaluate(() => { const barra = document.querySelector('.barra-status'); const oculto = (e) => { const d = e.closest('details:not([open])'); return !!d && e !== d && !e.closest('summary'); }; const vis = [...document.querySelectorAll('main *')].filter((e) => e.getBoundingClientRect().height > 0 && !oculto(e)).map((e) => ({ e, b: e.getBoundingClientRect().bottom })).sort((x, y) => y.b - x.b)[0]; return { barraTopo: barra ? Math.round(barra.getBoundingClientRect().top) : null, fimDoConteudo: Math.round(vis?.b ?? 0), quem: vis ? vis.e.tagName + '.' + String(vis.e.className).slice(0, 30) : '' }; });
  verifica(sobreposicao.barraTopo === null || sobreposicao.fimDoConteudo <= sobreposicao.barraTopo + 1, `barra inferior não cobre o fim do conteúdo (barra em ${sobreposicao.barraTopo}px, conteúdo termina em ${sobreposicao.fimDoConteudo}px, elemento ${sobreposicao.quem})`);
  await p.screenshot({ path: `${SAIDA}/assistente-celular.png`, fullPage: true });
  await p.context().close();

  // 1b) desktop: o compositor também fica no rodapé e a conversa ocupa a área principal
  p = await novaPagina(1280, 800); await ir(p, '/assistente'); await p.getByRole('img', { name: 'Nano.IA' }).waitFor();
  const d = await p.evaluate(() => ({ overflowX: document.documentElement.scrollWidth > innerWidth, compositor: !!document.querySelector('.chat-compositor'), base: Math.round(document.querySelector('.chat-compositor').getBoundingClientRect().bottom), barra: Math.round(document.querySelector('.barra-status').getBoundingClientRect().top) }));
  verifica(!d.overflowX && d.compositor && d.base <= d.barra + 1, `desktop: sem rolagem horizontal e compositor acima da barra (${d.base}px / ${d.barra}px)`);
  await p.getByRole('button', { name: 'Conversas', exact: true }).click(); await p.getByRole('button', { name: 'Modelo e privacidade' }).click(); await p.waitForTimeout(350);
  verifica(await p.getByRole('complementary', { name: 'Modelo e privacidade' }).isVisible(), 'desktop: aba de modelo abre ao lado da conversa'); await p.screenshot({ path: `${SAIDA}/assistente-abas-desktop.png` });
  await p.screenshot({ path: `${SAIDA}/assistente-conversa-desktop.png` });
  await p.context().close();

  // 2) Preferência de movimento reduzido não reintroduz a esfera.
   p = await novaPagina(390, 844, true); await ir(p, '/assistente');
   await p.getByRole('img', { name: 'Nano.IA' }).waitFor();
   verifica((await p.locator('.esfera,.esfera-caixa').count()) === 0,'sem esfera com movimento reduzido');
   await p.context().close();

   // 2b) identidade padronizada também no Design System.
   p = await novaPagina(1024, 900); await ir(p, '/design');
   verifica((await p.locator('.esfera,.esfera-caixa').count()) === 0,'Design System sem esferas');
   await p.context().close();

   // 3) Acesso ao agente: em tela que não é chat, botão visível no celular, abre e fecha o painel do agente
  p = await novaPagina(390, 844); await ir(p, '/catalogo');
  const botao = p.locator('.workspace-mobile-tabs').getByRole('button', { name: 'Nano.IA', exact: true });
  verifica(await botao.isVisible(), 'botão do agente visível no celular (tela de catálogo)');
  const caixa = await botao.boundingBox(); verifica(!!caixa && caixa.x >= 0 && caixa.x + caixa.width <= 390 && caixa.width >= 40 && caixa.height >= 40, `botão do agente dentro da tela e com alvo de toque grande (${caixa && Math.round(caixa.width)}x${caixa && Math.round(caixa.height)})`);
  await botao.click(); await p.getByRole('complementary', { name: 'Nano.ia', exact: true }).waitFor();
  verifica(await p.getByRole('complementary', { name: 'Nano.ia', exact: true }).isVisible(), 'agente abre');
  await p.screenshot({ path: `${SAIDA}/agente-aberto-celular.png` });
  await p.keyboard.press('Escape');
  verifica(!(await p.getByRole('complementary', { name: 'Nano.ia', exact: true }).isVisible()), 'agente fecha com Esc');
  await p.context().close();

  // 4) Na página do assistente o agente é a própria página: há um atalho claro para voltar/abrir?
  p = await novaPagina(390, 844); await ir(p, '/assistente');
  const atalho = await p.getByRole('button', { name: 'Abrir painel Nano.IA' }).count();
  verifica(atalho === 0, `na página do assistente não há segundo agente (sem duplicar chat): botões de dock = ${atalho}`);
  await p.context().close();
} finally { await browser?.close(); servidor.kill(); }
if (falhas.length) { console.error('\n' + falhas.length + ' falha(s):\n- ' + falhas.join('\n- ')); process.exit(1); }
console.log('\ntodas as verificações passaram');
