import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SourceTextModule, SyntheticModule, createContext } from 'node:vm';
import { gerar, SDK } from '../gerar-autocontido.mjs';
import { cifrar } from '../../supabase/functions/_shared/cripto.ts';

const root = new URL('../../', import.meta.url).pathname;
const codigo = await readFile(new URL('../../artifacts/assistente/index.ts', import.meta.url), 'utf8');
const chaveCifra = btoa('x'.repeat(32)); // exclusivamente sintética
const segredo = 'chave-sintetica-nao-valida';
const cifrada = await cifrar(segredo, chaveCifra);

async function ambiente({ papel = 'editor', loja = 'A', configurado = true, provedor = 'claude', falhaConfig = false, falhaRPC = false, statusIA = 200, limite = null, tokens = 0, tool = false } = {}) {
  let handler, chamadas = 0;
  const auditoria = [], rpcs = [], updates = [], consultas = [];
  const metadado = { provedor, ativa: true, principal: true, modelo: 'modelo-sintetico', base_url: 'https://api.openai.com/v1', limite_mensal_tokens: limite, tokens_mes: tokens, mes_ref: '2026-10-01', cifrada: segredo };
  function query(table) {
    const filtros = {};
    const q = {
      select() { return q; }, eq(k, v) { filtros[k] = v; return q; }, limit() { return q; },
      update(v) { updates.push(v); return q; }, insert(v) { auditoria.push(v); return Promise.resolve({ error: null }); },
      async maybeSingle() { return resultado(true); },
      then(ok, no) { return Promise.resolve(resultado(false)).then(ok, no); },
    };
    function resultado(single) {
      consultas.push({ table, filtros: { ...filtros } });
      if (table === 'lojas') return { data: papel !== 'sem_vinculo' && filtros.id === loja ? { id: loja, nome: 'Loja sintética' } : null };
      if (table === 'loja_chaves_ia') return { data: configurado ? [metadado] : [], error: falhaConfig ? {} : null };
      if (table === 'produto_enriquecimento' && single) return { data: { id: 'item', loja_id: loja, campo: 'marca', status: 'a_confirmar', fonte: 'documento sintético', coletado_em: '2026-10-18' } };
      if (table === 'produtos' && single) return { data: { id: 'produto', nome: 'Produto SIMULADO', sku: 'TEST-1', preco: 12, estoque: 3 } };
      return { data: [], count: 0, error: null };
    }
    return q;
  }
  const cliente = {
    auth: { getUser: async () => ({ data: { user: papel === 'anon' || papel === 'invalido' ? null : { id: 'user-' + papel } } }) },
    from: query,
    async rpc(fn, args) {
      rpcs.push({ fn, args });
      if (fn === 'pode_administrar_loja') return { data: papel === 'lojista', error: falhaRPC ? {} : null };
      if (fn === 'ia_chave_ativa') return { data: configurado && (!args.p_provedor || args.p_provedor === provedor) ? [{ provedor, cifrada, modelo: 'modelo-sintetico', base_url: metadado.base_url, limite, tokens_mes: tokens }] : [] };
      return { data: null, error: null };
    },
  };
  const rede = async (url, init) => {
    chamadas++;
    assert.ok([ 'https://api.anthropic.com/v1/messages', 'https://api.openai.com/v1/chat/completions', 'https://generativelanguage.googleapis.com/v1beta/models/modelo-sintetico:generateContent' ].includes(url));
    const body = JSON.parse(init.body);
    assert.equal(body.model ?? 'modelo-sintetico', 'modelo-sintetico'); // nome livre enviado pelo cliente é ignorado
    if (statusIA !== 200) return new Response('CORPO-SENSIVEL-NAO-RETORNAR', { status: statusIA });
    const uso = tool && chamadas === 1;
    if (provedor === 'claude') return Response.json({ content: uso ? [{ type: 'tool_use', id: 't1', name: 'ver_produto', input: { sku: 'TEST-1' } }] : [{ type: 'text', text: 'Resposta SIMULADA' }], usage: { input_tokens: 2, output_tokens: 3 } });
    if (provedor === 'gemini') return Response.json({ candidates: [{ content: { parts: uso ? [{ functionCall: { name: 'ver_produto', args: { sku: 'TEST-1' } } }] : [{ text: 'Resposta SIMULADA' }] } }], usageMetadata: { totalTokenCount: 5 } });
    return Response.json({ choices: [{ message: uso ? { tool_calls: [{ id: 't1', function: { name: 'ver_produto', arguments: '{"sku":"TEST-1"}' } }] } : { content: 'Resposta SIMULADA' } }], usage: { total_tokens: 5 } });
  };
  const ctx = createContext({ Response, Request, Headers, URL, TextEncoder, TextDecoder, Uint8Array, crypto, btoa, atob, AbortSignal, fetch: rede,
    Deno: { env: { get: (k) => k === 'CREDENCIAIS_CHAVE_CIFRA' ? chaveCifra : 'sintetico' }, serve: (f) => { handler = f; } } });
  const ext = new SyntheticModule(['createClient'], function () { this.setExport('createClient', () => cliente); }, { context: ctx });
  const modulo = new SourceTextModule(codigo, { context: ctx });
  assert.deepEqual(Array.from(modulo.moduleRequests, (r) => r.specifier), [SDK]);
  await modulo.link((specifier) => { assert.equal(specifier, SDK); return ext; });
  await modulo.evaluate();
  return { auditoria, rpcs, updates, consultas, chamadas: () => chamadas,
    async chamar(body, method = 'POST') {
      const r = await handler(new Request('http://localhost/assistente', { method, headers: { authorization: papel === 'anon' ? '' : 'Bearer sintetico', 'content-type': 'application/json' }, ...(method === 'POST' ? { body: JSON.stringify({ loja_id: loja, ...body }) } : {}) }));
      return { status: r.status, body: method === 'OPTIONS' ? {} : await r.json() };
    } };
}

test('artefato reproduzível e manifesto sem deriva', async () => {
  const a = await gerar(root), b = await gerar(root);
  assert.equal(a.codigo, codigo); assert.equal(a.codigo, b.codigo); assert.equal(a.manifesto, b.manifesto);
  assert.equal(a.manifesto, await readFile(new URL('../../artifacts/assistente/manifesto.json', import.meta.url), 'utf8'));
});

test('gerador rejeita ciclos, imports externos inesperados e default export', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'autocontido-'));
  try {
    await mkdir(join(dir, 'supabase/functions/assistente'), { recursive: true });
    const entry = join(dir, 'supabase/functions/assistente/index.ts');
    await writeFile(entry, 'import { x } from "https://exemplo.invalid/x.ts"; export const y = x;');
    await assert.rejects(gerar(dir), /externo não permitido/);
    await writeFile(entry, 'export default 42;');
    await assert.rejects(gerar(dir), /Exports não suportados/);
    await writeFile(entry, 'import { x } from "./index.ts"; export const y = x;');
    await assert.rejects(gerar(dir), /circular/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('gerador preserva aliases, reexports e nomes repetidos em módulos distintos', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'autocontido-escopo-'));
  try {
    await writeFile(join(dir, 'index.ts'), 'import { valor as a } from "./a.ts";\nimport { valor as b } from "./b.ts";\nglobalThis.resultado = [a, b];');
    await writeFile(join(dir, 'a.ts'), 'export const valor: number = 1;');
    await writeFile(join(dir, 'b.ts'), 'export { valor } from "./c.ts";');
    await writeFile(join(dir, 'c.ts'), 'export const valor: number = 2;');
    const r = await gerar(dir, 'index.ts');
    const ctx = createContext({});
    const ext = new SyntheticModule(['createClient'], function () { this.setExport('createClient', null); }, { context: ctx });
    const m = new SourceTextModule(r.codigo, { context: ctx }); await m.link(() => ext); await m.evaluate();
    assert.equal(JSON.stringify(ctx.resultado), '[1,2]');
  } finally { await rm(dir, { recursive: true, force: true }); }
});

for (const papel of ['anon', 'invalido', 'sem_vinculo']) test(`segurança: ${papel} não lista provedores nem chama IA`, async () => {
  const a = await ambiente({ papel });
  assert.equal((await a.chamar({ acao: 'provedores' })).status, papel === 'sem_vinculo' ? 404 : 401);
  assert.equal(a.chamadas(), 0); assert.equal(a.rpcs.length, 0);
});

test('segurança: loja alheia é 404 e não chega ao serviço/provedor', async () => {
  const a = await ambiente(); assert.equal((await a.chamar({ loja_id: 'B', texto: 'oi', provedor: 'claude' })).status, 404);
  assert.equal(a.rpcs.length, 0); assert.equal(a.chamadas(), 0);
});

test('metadados não expõem segredo; erro fecha os três estados', async () => {
  const a = await ambiente(); const r = await a.chamar({ acao: 'provedores' });
  assert.equal(r.body.provedores.length, 3); assert.ok(!JSON.stringify(r.body).includes(segredo));
  assert.ok(!a.rpcs.some((r) => r.fn === 'ia_chave_ativa'));
  const b = await ambiente({ falhaConfig: true });
  assert.ok((await b.chamar({ acao: 'provedores' })).body.provedores.every((p) => p.estado === 'indisponivel'));
});

for (const acao of ['decidir', 'decidir_imagem']) for (const decisao of ['aprovar', 'rejeitar']) test(`M6: editor ${acao}/${decisao} é 403 sem escrita`, async () => {
  const a = await ambiente(); assert.equal((await a.chamar({ acao, id: 'item', decisao })).status, 403);
  assert.equal(a.updates.length, 0); assert.equal(a.auditoria.length, 0);
});
test('M6: falha na RPC nega lojista; lojista aprovado mantém auditoria', async () => {
  const a = await ambiente({ papel: 'lojista', falhaRPC: true });
  assert.equal((await a.chamar({ acao: 'decidir', id: 'item', decisao: 'aprovar' })).status, 403);
  const b = await ambiente({ papel: 'lojista' });
  assert.equal((await b.chamar({ acao: 'decidir', id: 'item', decisao: 'aprovar' })).status, 200);
  assert.equal(b.auditoria[0].user_id, 'user-lojista');
});

for (const provedor of ['claude', 'gemini', 'compativel_openai']) test(`seletor: ${provedor} usa adaptador existente e ferramenta (rede SIMULADA)`, async () => {
  const a = await ambiente({ provedor, tool: true });
  const r = await a.chamar({ acao: 'perguntar', texto: 'produto TEST-1?', provedor, modelo: 'modelo-caro-nao-permitido' });
  assert.equal(r.status, 200); assert.equal(r.body.provedor, provedor); assert.equal(r.body.ia, true);
  assert.equal(a.chamadas(), 2); assert.equal(a.rpcs.find((r) => r.fn === 'ia_chave_ativa').args.p_provedor, provedor);
  assert.ok(a.consultas.some((q) => q.table === 'produtos' && q.filtros.loja_id === 'A'));
  assert.equal(a.auditoria[0].depois.provedor, provedor); assert.equal(a.auditoria[0].depois.modelo, 'modelo-sintetico');
});

test('não configurado, enum inválido e limite não fazem fallback', async () => {
  for (const [op, body, esperado] of [[{ configurado: false }, { provedor: 'claude' }, 409], [{}, { provedor: 'outro' }, 400], [{ limite: 10, tokens: 10 }, { provedor: 'claude' }, 429]]) {
    const a = await ambiente(op); assert.equal((await a.chamar({ texto: 'oi', ...body })).status, esperado); assert.equal(a.chamadas(), 0);
  }
});
for (const statusIA of [401, 429, 503]) test(`falha ${statusIA} do provedor não troca fornecedor nem expõe corpo`, async () => {
  const a = await ambiente({ statusIA }); const r = await a.chamar({ texto: 'oi', provedor: 'claude' });
  assert.ok(r.status >= 400); assert.equal(a.chamadas(), 1); assert.ok(!JSON.stringify(r.body).includes('CORPO-SENSIVEL'));
});
test('resumo local explicitamente não chama IA nem obtém chave', async () => {
  const a = await ambiente(); const r = await a.chamar({ texto: 'resumo da loja', sem_ia: true });
  assert.equal(r.status, 200); assert.equal(a.chamadas(), 0); assert.ok(!a.rpcs.some((r) => r.fn === 'ia_chave_ativa'));
});
