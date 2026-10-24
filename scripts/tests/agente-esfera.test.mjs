// Esfera do agente (movimento em repouso, respeito a prefers-reduced-motion) e acesso ao agente no celular.
// Painel REAL compilado + sessão FALSA no navegador; TODA chamada ao Supabase é interceptada e respondida com dado sintético (nenhuma rede de produção, nenhuma escrita).
// Uso: node scripts/tests/agente-esfera.test.mjs   (compila o painel em painel/dist antes, se ainda não existir)
import { createRequire } from 'node:module';
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
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
  const movimento = (p) => p.evaluate(() => { const a = document.getAnimations().filter((x) => x.effect && x.effect.target?.closest?.('.esfera, .esfera-caixa')); return { total: a.length, rodando: a.filter((x) => x.playState === 'running').length }; });
  const verifica = (ok, msg) => { if (!ok) falhas.push(msg); console.log((ok ? 'ok      ' : 'FALHOU  ') + msg); };

  // 1) Esfera em repouso no celular: precisa ter movimento discreto
  let p = await novaPagina(390, 844); await ir(p, '/assistente');
  await p.getByRole('img', { name: /Conector IA/ }).first().waitFor();
  const m = await movimento(p);
  verifica(m.rodando > 0, `esfera em repouso (celular) tem animação rodando: ${m.rodando} de ${m.total}`);
  verifica(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'assistente no celular sem rolagem horizontal');
  const campo = p.getByLabel(/Pergunte/).first();
  verifica(await campo.count() > 0 && await campo.isVisible().catch(() => false), 'campo de mensagem visível no celular');
  // movimento visível de verdade: duas capturas da esfera com 2,5 s de intervalo precisam ser diferentes
  const caixaEsfera = p.locator('.esfera-caixa').first();
  const foto = async () => createHash('sha1').update(await caixaEsfera.screenshot()).digest('hex');
  const f1 = await foto(); await p.waitForTimeout(2500); const f2 = await foto();
  verifica(f1 !== f2, 'esfera em repouso muda de aparência ao longo do tempo (movimento discreto)');
  await caixaEsfera.screenshot({ path: `${SAIDA}/esfera-repouso-t2.png` });
  // a barra fixa de baixo não pode cobrir o fim do conteúdo quando a página rola até o fim
  await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const sobreposicao = await p.evaluate(() => { const barra = document.querySelector('.barra-status'); const ultimo = [...document.querySelectorAll('main *')].filter((e) => e.getBoundingClientRect().height > 0).map((e) => e.getBoundingClientRect().bottom).reduce((a, b) => Math.max(a, b), 0); return { barraTopo: barra ? Math.round(barra.getBoundingClientRect().top) : null, fimDoConteudo: Math.round(ultimo) }; });
  verifica(sobreposicao.barraTopo === null || sobreposicao.fimDoConteudo <= sobreposicao.barraTopo + 1, `barra inferior não cobre o fim do conteúdo (barra em ${sobreposicao.barraTopo}px, conteúdo termina em ${sobreposicao.fimDoConteudo}px)`);
  await p.screenshot({ path: `${SAIDA}/assistente-celular.png`, fullPage: true });
  await p.context().close();

  // 2) prefers-reduced-motion: sem movimento (a preferência do aparelho é respeitada)
  p = await novaPagina(390, 844, true); await ir(p, '/assistente'); await p.getByRole('img', { name: /Conector IA/ }).first().waitFor();
  const r = await movimento(p); verifica(r.rodando === 0, `com movimento reduzido nada anima: ${r.rodando} rodando`);
  const cx = p.locator('.esfera-caixa').first(); const g1 = createHash('sha1').update(await cx.screenshot()).digest('hex'); await p.waitForTimeout(1500);
  verifica(g1 === createHash('sha1').update(await cx.screenshot()).digest('hex'), 'com movimento reduzido a esfera fica estática (preferência respeitada)');
  await p.context().close();

  // 2b) estados reais continuam distintos: ativo anima, erro congela (galeria de estados do Design System)
  p = await novaPagina(1024, 900); await ir(p, '/design');
  const estados = await p.evaluate(() => Object.fromEntries([...document.querySelectorAll('.esfera[data-estado]')].map((e) => [e.dataset.estado, e.getAnimations({ subtree: true }).filter((a) => a.playState === 'running').length])));
  verifica((estados.interpretando ?? 0) > 0 && (estados.executando ?? 0) > 0 && (estados.aguardando_aprovacao ?? 1) === 0 && (estados.bloqueado ?? 1) === 0, `estados reais preservados (rodando por estado: ${JSON.stringify(estados)})`);
  await p.context().close();

  // 3) Acesso ao agente: em tela que não é chat, botão visível no celular, abre e fecha o painel do agente
  p = await novaPagina(390, 844); await ir(p, '/catalogo');
  const botao = p.getByRole('button', { name: /Agente lateral/ });
  verifica(await botao.isVisible(), 'botão do agente visível no celular (tela de catálogo)');
  const caixa = await botao.boundingBox(); verifica(!!caixa && caixa.x >= 0 && caixa.x + caixa.width <= 390 && caixa.width >= 40 && caixa.height >= 40, `botão do agente dentro da tela e com alvo de toque grande (${caixa && Math.round(caixa.width)}x${caixa && Math.round(caixa.height)})`);
  await botao.click(); await p.getByRole('complementary', { name: 'Agente' }).waitFor();
  verifica(await p.getByRole('complementary', { name: 'Agente' }).isVisible(), 'agente abre');
  await p.screenshot({ path: `${SAIDA}/agente-aberto-celular.png` });
  await p.keyboard.press('Escape');
  verifica(!(await p.getByRole('complementary', { name: 'Agente' }).isVisible()), 'agente fecha com Esc');
  await p.context().close();

  // 4) Na página do assistente o agente é a própria página: há um atalho claro para voltar/abrir?
  p = await novaPagina(390, 844); await ir(p, '/assistente');
  const atalho = await p.getByRole('button', { name: /Agente lateral/ }).count();
  verifica(atalho === 0, `na página do assistente não há segundo agente (sem duplicar chat): botões de dock = ${atalho}`);
  await p.context().close();
} finally { await browser?.close(); servidor.kill(); }
if (falhas.length) { console.error('\n' + falhas.length + ' falha(s):\n- ' + falhas.join('\n- ')); process.exit(1); }
console.log('\ntodas as verificações passaram');
