import { test } from "node:test";
import assert from "node:assert/strict";
import { conversar, IaErro } from "./claude.ts";
import { chamarPlugin, urlPublicaSegura, type PluginRegistro } from "./plugin.ts";
import { executarFerramenta, FERRAMENTAS } from "./ferramentas.ts";

const resp = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status });

test("conversar: laço de ferramenta (tool_use -> tool_result -> texto) e soma de tokens", async () => {
  const corpos: any[] = [];
  const f = (async (_u: string, init: RequestInit) => {
    corpos.push(JSON.parse(String(init.body)));
    if (corpos.length === 1) return resp({ stop_reason: "tool_use", usage: { input_tokens: 10, output_tokens: 5 }, content: [{ type: "tool_use", id: "t1", name: "resumo_loja", input: {} }] });
    return resp({ stop_reason: "end_turn", usage: { input_tokens: 20, output_tokens: 7 }, content: [{ type: "text", text: "4 produtos." }] });
  }) as unknown as typeof fetch;
  const r = await conversar({ chave: "sk-teste", modelo: "m", sistema: "s", mensagens: [{ role: "user", content: "resumo" }], ferramentas: FERRAMENTAS, executar: async () => ({ produtos: 4 }), fetch: f });
  assert.equal(r.texto, "4 produtos."); assert.equal(r.tokens, 42); assert.deepEqual(r.ferramentasUsadas, ["resumo_loja"]);
  const ultimo = corpos[1].messages.at(-1);
  assert.equal(ultimo.role, "user"); assert.equal(ultimo.content[0].type, "tool_result"); assert.equal(ultimo.content[0].tool_use_id, "t1");
});

test("conversar: erro da ferramenta volta como is_error, sem derrubar o chat", async () => {
  let n = 0;
  const f = (async (_u: string, init: RequestInit) => {
    n++;
    if (n === 1) return resp({ stop_reason: "tool_use", content: [{ type: "tool_use", id: "t1", name: "x", input: {} }] });
    assert.equal(JSON.parse(String(init.body)).messages.at(-1).content[0].is_error, true);
    return resp({ stop_reason: "end_turn", content: [{ type: "text", text: "ok" }] });
  }) as unknown as typeof fetch;
  const r = await conversar({ chave: "k", modelo: "m", sistema: "s", mensagens: [], ferramentas: [], executar: async () => { throw new Error("falhou"); }, fetch: f });
  assert.equal(r.texto, "ok");
});

test("conversar: limita passos e não fica em laço infinito", async () => {
  const f = (async () => resp({ stop_reason: "tool_use", content: [{ type: "tool_use", id: "t", name: "x", input: {} }] })) as unknown as typeof fetch;
  const r = await conversar({ chave: "k", modelo: "m", sistema: "s", mensagens: [], ferramentas: [], executar: async () => 1, fetch: f, maxPassos: 3 });
  assert.equal(r.passos, 3); assert.match(r.texto, /Não consegui concluir/);
});

test("conversar: erros do provedor viram mensagens genéricas, sem eco do corpo nem da chave", async () => {
  for (const [st, esperado] of [[401, 401], [429, 429], [500, 502]] as const) {
    const f = (async () => new Response("segredo sk-teste vazou", { status: st })) as unknown as typeof fetch;
    await assert.rejects(conversar({ chave: "sk-teste", modelo: "m", sistema: "s", mensagens: [], ferramentas: [], executar: async () => 1, fetch: f }),
      (e: unknown) => e instanceof IaErro && e.status === esperado && !e.message.includes("sk-teste"));
  }
});

test("urlPublicaSegura: só https público", () => {
  for (const ok of ["https://api.exemplo.com.br/hook", "https://a.b.com/x/y"]) assert.equal(urlPublicaSegura(ok), true, ok);
  for (const ruim of ["http://a.com/x", "https://localhost/x", "https://127.0.0.1/x", "https://10.0.0.1/x", "https://[::1]/x", "https://a.internal/x", "https://u:p@a.com/x", "https://a.com/x?token=1", "https://a.com:8443/x", "https://intranet/x", "ftp://a.com"])
    assert.equal(urlPublicaSegura(ruim), false, ruim);
});

const plugin = (p: Partial<PluginRegistro> = {}): PluginRegistro => ({ id: "1", nome: "Forn", tipo: "api", url: "https://exemplo.com.br/hook", capacidades: ["enriquecer"], risco: "LOW", ativo: true, ...p });

test("chamarPlugin: guardas (desligado, tipo, capacidade, risco, URL)", async () => {
  const f = (async () => resp({ ok: 1 })) as unknown as typeof fetch;
  assert.equal((await chamarPlugin(plugin({ ativo: false }), null, "enriquecer", {}, f)).ok, false);
  assert.equal((await chamarPlugin(plugin({ tipo: "mcp" }), null, "enriquecer", {}, f)).ok, false);
  assert.equal((await chamarPlugin(plugin(), null, "imagem", {}, f)).ok, false);
  assert.equal((await chamarPlugin(plugin({ risco: "MEDIUM" }), null, "enriquecer", {}, f)).ok, false);
  assert.equal((await chamarPlugin(plugin({ url: "https://10.0.0.5/x" }), null, "enriquecer", {}, f)).ok, false);
});

test("chamarPlugin: envia contrato v1 com credencial, não segue redirect, devolve dado", async () => {
  let visto: any;
  const f = (async (_u: string, init: RequestInit) => { visto = init; return resp({ ncm: "8413" }); }) as unknown as typeof fetch;
  const r = await chamarPlugin(plugin(), "cred-123", "enriquecer", { sku: "X" }, f);
  assert.deepEqual(r, { ok: true, dados: { ncm: "8413" } });
  assert.equal(visto.redirect, "manual"); assert.equal(visto.headers.authorization, "Bearer cred-123");
  assert.deepEqual(JSON.parse(visto.body), { sdk: "1", capacidade: "enriquecer", entrada: { sku: "X" } });
  const redir = (async () => new Response("", { status: 302 })) as unknown as typeof fetch;
  assert.equal((await chamarPlugin(plugin(), null, "enriquecer", {}, redir)).ok, false);
});

test("ferramentas: chamar_plugin só alcança plugin ativo da loja; resultado vem marcado como dado a conferir", async () => {
  const f = (async () => resp({ marca: "X" })) as unknown as typeof fetch;
  const ctx = { usuario: null, lojaId: "L", plugins: [plugin(), plugin({ id: "2", nome: "Off", ativo: false })], credencial: async () => "c", fetch: f };
  const ok: any = await executarFerramenta("chamar_plugin", { plugin: "forn", capacidade: "enriquecer" }, ctx);
  assert.deepEqual(ok, { dados_do_plugin_a_conferir: { marca: "X" } });
  assert.ok((await executarFerramenta("chamar_plugin", { plugin: "Off", capacidade: "enriquecer" }, ctx) as any).erro);
  assert.ok((await executarFerramenta("chamar_plugin", { plugin: "inexistente", capacidade: "x" }, ctx) as any).erro);
  assert.deepEqual(await executarFerramenta("listar_plugins", {}, ctx), [{ nome: "Forn", tipo: "api", capacidades: ["enriquecer"], risco: "LOW" }]);
  assert.ok((await executarFerramenta("apagar_tudo", {}, ctx) as any).erro);
});

test("ferramentas: nenhuma ferramenta do agente escreve (catálogo é só leitura)", () => {
  const nomes = FERRAMENTAS.map((x) => x.name);
  assert.ok(!nomes.some((n) => /grav|salv|publ|aprov|escrev|apag|delet|atualiz/.test(n)), nomes.join());
});
