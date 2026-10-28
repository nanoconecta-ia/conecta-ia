// Service worker do app instalável: troca de versão apaga o cache antigo e recarrega as janelas abertas UMA vez; navegação ignora o cache HTTP; offline mostra a última casca.
// Roda o sw.js REAL num ambiente simulado (sem navegador, sem rede).
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const fonte=readFileSync(new URL('../../painel/public/sw.js',import.meta.url),'utf8');
function ambiente({ caches: iniciais = [], janelas = 1, rede = 'ok' } = {}) {
  const ouvintes = {}, guardado = new Map(iniciais.map((k) => [k, new Map()])), navegou = [], chamadasFetch = [];
  const cacheDe = (k) => ({ addAll: async () => { if (!guardado.has(k)) guardado.set(k, new Map()); }, put: async (u, v) => { guardado.get(k).set(u, v); }, match: async (u) => guardado.get(k)?.get(u) });
  const self = {
    location: { origin: 'https://exemplo.test' },
    addEventListener: (t, f) => { ouvintes[t] = f; },
    skipWaiting: async () => {},
    clients: { claim: async () => {}, matchAll: async () => Array.from({ length: janelas }, (_, i) => ({ url: `https://exemplo.test/#/j${i}`, navigate: async (u) => { navegou.push(u); } })) },
  };
  const ctx = { self, caches: { open: async (k) => { if (!guardado.has(k)) guardado.set(k, new Map()); return cacheDe(k); }, keys: async () => [...guardado.keys()], delete: async (k) => guardado.delete(k), match: async (u) => { for (const m of guardado.values()) if (m.has(u)) return m.get(u); } },
    fetch: async (r, init) => { chamadasFetch.push(init); if (rede === 'cai') throw new TypeError('offline'); return { ok: true, clone() { return this; } }; },
    Response: { error: () => 'ERRO' }, URL, Promise };
  vm.createContext(ctx);vm.runInContext(fonte, ctx);
  const evento = (extra) => { const e = { waitUntil: (p) => { e.p = p; }, ...extra }; return e; };
  return { ouvintes, guardado, navegou, chamadasFetch, evento };
}
// 1) estava na v1: apaga, assume e recarrega cada janela uma vez
{ const a = ambiente({ caches: ['conecta-casca-v1'], janelas: 2 });
  const e = a.evento();a.ouvintes.activate(e);await e.p;
  assert.deepEqual([...a.guardado.keys()].filter((k) => k === 'conecta-casca-v1'), [], 'cache da versão antiga apagado');
  assert.equal(a.navegou.length, 2, 'cada janela aberta é recarregada uma vez'); }
// 2) primeira instalação: nada a recarregar
{ const a = ambiente({ caches: [] });
  const i = a.evento();a.ouvintes.install(i);await i.p;
  const e = a.evento();a.ouvintes.activate(e);await e.p;
  assert.equal(a.navegou.length, 0, 'primeira instalação não recarrega'); }
// 3) mesma versão já instalada: não recarrega de novo (sem laço de recarga)
{ const a = ambiente({ caches: ['conecta-casca-v2'], janelas: 1 });
  const e = a.evento();a.ouvintes.activate(e);await e.p;
  assert.equal(a.navegou.length, 0, 'mesma versão não recarrega'); }
// 4) navegação: vai à rede sem o cache HTTP; cai a rede => última casca
{ const a = ambiente({ caches: ['conecta-casca-v2'] });
  let resposta; const e = { request: { method: 'GET', mode: 'navigate', url: 'https://exemplo.test/' }, respondWith: (p) => { resposta = p; } };
  a.ouvintes.fetch(e);await resposta;
  assert.equal(a.chamadasFetch[0].cache, 'no-store', 'navegação ignora o cache HTTP'); }
{ const a = ambiente({ caches: ['conecta-casca-v2'], rede: 'cai' });
  a.guardado.get('conecta-casca-v2').set('./', 'CASCA-GUARDADA');
  let resposta; const e = { request: { method: 'GET', mode: 'navigate', url: 'https://exemplo.test/' }, respondWith: (p) => { resposta = p; } };
  a.ouvintes.fetch(e);assert.equal(await resposta, 'CASCA-GUARDADA', 'offline mostra a última casca'); }
// 5) outros domínios e escritas não são tocados
{ const a = ambiente(); let respondeu = false;
  a.ouvintes.fetch({ request: { method: 'GET', mode: 'cors', url: 'https://outro.test/x' }, respondWith: () => { respondeu = true; } });
  a.ouvintes.fetch({ request: { method: 'POST', mode: 'navigate', url: 'https://exemplo.test/' }, respondWith: () => { respondeu = true; } });
  assert.equal(respondeu, false); }
console.log('sw-atualiza: OK (troca de versão recarrega uma vez, sem laço; navegação sem cache HTTP; offline usa a última casca)');
