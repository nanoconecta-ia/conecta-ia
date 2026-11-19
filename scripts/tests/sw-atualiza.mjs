// Homologação isolada dos DOIS service workers reais sem navegador e sem rede externa.
// Nunca deve atualizar a vitrine recarregando janelas do painel (nem vice-versa).
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const ler = (nome) => readFileSync(new URL('../../painel/public/' + nome, import.meta.url), 'utf8');
const LOJA = ler('sw.js'), PAINEL = ler('sw-conecta.js');
const versao = (fonte) => fonte.match(/const CACHE = "([^"]+)"/)?.[1];
const versaoLoja = versao(LOJA), versaoPainel = versao(PAINEL);
assert.ok(versaoLoja?.startsWith('mobis-loja-casca-v'));
assert.ok(versaoPainel?.startsWith('conecta-admin-casca-v'));
assert.notEqual(versaoLoja, versaoPainel);

function ambiente(fonte, { iniciais = [], rede = 'ok', scope = 'https://exemplo.test/' } = {}) {
  const ouvintes = {};
  const guardado = new Map(iniciais.map((k) => [k, new Map()]));
  const chamadasFetch = [];
  let recarregamentos = 0;
  const cacheDe = (k) => ({
    addAll: async (items) => {
      if (!guardado.has(k)) guardado.set(k, new Map());
      for (const item of items) guardado.get(k).set(item, 'CASCA-' + item);
    },
    put: async (u, v) => { guardado.get(k).set(u, v); },
    match: async (u) => guardado.get(k)?.get(u),
  });
  const self = {
    location: { origin: 'https://exemplo.test' },
    registration: { scope },
    addEventListener: (t, f) => { ouvintes[t] = f; },
    skipWaiting: async () => {},
    clients: { claim: async () => {}, matchAll: async () => [{ navigate: async () => { recarregamentos++; } }] },
  };
  const caches = {
    open: async (k) => { if (!guardado.has(k)) guardado.set(k, new Map()); return cacheDe(k); },
    keys: async () => [...guardado.keys()],
    delete: async (k) => guardado.delete(k),
    match: async (u) => { for (const m of guardado.values()) if (m.has(u)) return m.get(u); },
  };
  const fetch = async (_r, opts) => {
    chamadasFetch.push(opts);
    if (rede === 'cai') throw new TypeError('sem rede');
    return { ok: true, clone() { return this; } };
  };
  vm.runInNewContext(fonte, { self, caches, fetch, Response: { error: () => 'ERRO' }, URL, Promise });
  const evento = (extra = {}) => ({ waitUntil(p) { this.p = p; }, ...extra });
  return { ouvintes, guardado, chamadasFetch, evento, get recarregamentos() { return recarregamentos; } };
}

async function iniciarEAtivar(a) {
  let e = a.evento(); a.ouvintes.install(e); await e.p;
  e = a.evento(); a.ouvintes.activate(e); await e.p;
}

for (const [nome, fonte, atual, outro, scope] of [
  ['loja', LOJA, versaoLoja, versaoPainel, 'https://exemplo.test/'],
  ['painel', PAINEL, versaoPainel, versaoLoja, 'https://exemplo.test/conecta.html'],
]) {
  const antigo = nome === 'loja' ? 'mobis-loja-casca-v0' : 'conecta-admin-casca-v0';
  const a = ambiente(fonte, { iniciais: [antigo, outro, 'cache-externo'], scope });
  await iniciarEAtivar(a);
  assert.ok(a.guardado.has(atual), nome + ': cache atual instalado');
  assert.ok(!a.guardado.has(antigo), nome + ': cache antigo eliminado');
  assert.ok(a.guardado.has(outro), nome + ': cache do outro aplicativo preservado');
  assert.ok(a.guardado.has('cache-externo'), nome + ': caches de terceiros preservados');
  assert.equal(a.recarregamentos, 0, nome + ': não navega ou fecha nenhuma janela');

  const b = ambiente(fonte, { iniciais: [atual], scope });
  await iniciarEAtivar(b);
  assert.equal(b.recarregamentos, 0, nome + ': mesmo worker não recarrega janelas');

  // Enquanto online, navegação aprovada deve ignorar cache HTTP; offline usa somente sua casca.
  const caminho = nome === 'loja' ? '/' : '/conecta.html';
  const c = ambiente(fonte, { iniciais: [atual], scope });
  let resposta;
  let e = c.evento({ request: { method: 'GET', mode: 'navigate', url: 'https://exemplo.test' + caminho }, respondWith(p) { resposta = p; } });
  c.ouvintes.fetch(e);
  assert.ok(resposta, nome + ': navegação correta foi interceptada');
  await resposta;
  assert.equal(c.chamadasFetch[0]?.cache, 'no-store', nome + ': navegação rede-primeiro');

  const off = ambiente(fonte, { iniciais: [atual], rede: 'cai', scope });
  off.guardado.get(atual).set(nome === 'loja' ? './' : './conecta.html', 'ULTIMA-CASCA');
  resposta = undefined;
  e = off.evento({ request: { method: 'GET', mode: 'navigate', url: 'https://exemplo.test' + caminho }, respondWith(p) { resposta = p; } });
  off.ouvintes.fetch(e);
  assert.equal(await resposta, 'ULTIMA-CASCA', nome + ': fallback offline isolado');

  // Rotas do outro aplicativo e chamadas à API jamais entram no interceptador.
  const ignorados = nome === 'loja' ? ['/conecta.html'] : ['/', '/index.html'];
  for (const caminhoIgnorado of [...ignorados, '/functions/v1/conector-mcp']) {
    let interceptou = false;
    c.ouvintes.fetch({ request: { method: 'GET', mode: 'navigate', url: 'https://exemplo.test' + caminhoIgnorado }, respondWith() { interceptou = true; } });
    assert.equal(interceptou, false, nome + ': não intercepta ' + caminhoIgnorado);
  }
  let escreveu = false;
  c.ouvintes.fetch({ request: { method: 'POST', mode: 'navigate', url: 'https://exemplo.test' + caminho }, respondWith() { escreveu = true; } });
  assert.equal(escreveu, false, nome + ': não intercepta escritas');
}
console.log('sw-atualiza: OK (dois PWAs: caches separados, sem recarga cruzada, offline isolado e navegação rede-primeiro)');
