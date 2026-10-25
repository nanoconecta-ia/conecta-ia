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
  const ctx = { usuario: null, admin: { from: () => ({}), rpc: async () => ({ data: null, error: null }) }, lojaId: "L", plugins: [plugin(), plugin({ id: "2", nome: "Off", ativo: false })], credencial: async () => "c", fetch: f };
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

// --- Gemini e compatível com OpenAI (Llama) ---------------------------------------------------------
test("gemini: functionCall -> functionResponse (devolve a parte original e usa o nome da ferramenta)", async () => {
  const pedidos: { url: string; headers: any; corpo: any }[] = [];
  const f = (async (url: string, init: RequestInit) => {
    pedidos.push({ url, headers: init.headers, corpo: JSON.parse(String(init.body)) });
    if (pedidos.length === 1) return resp({ usageMetadata: { totalTokenCount: 30 }, candidates: [{ content: { parts: [{ thought: true, text: "pensando" }, { functionCall: { name: "ver_produto", args: { sku: "80692" } }, thoughtSignature: "sig" }] } }] });
    return resp({ usageMetadata: { totalTokenCount: 12 }, candidates: [{ content: { parts: [{ text: "Sem estoque." }] } }] });
  }) as unknown as typeof fetch;
  const r = await conversar({ provedor: "gemini", chave: "g-chave", modelo: "gemini-x", sistema: "S", mensagens: [{ role: "user", content: "e o 80692?" }], ferramentas: FERRAMENTAS, executar: async () => ({ estoque: 0 }), fetch: f });
  assert.equal(r.texto, "Sem estoque."); assert.equal(r.tokens, 42); assert.deepEqual(r.ferramentasUsadas, ["ver_produto"]);
  assert.match(pedidos[0].url, /generativelanguage\.googleapis\.com\/v1beta\/models\/gemini-x:generateContent$/);
  assert.equal(pedidos[0].headers["x-goog-api-key"], "g-chave"); assert.ok(!pedidos[0].url.includes("g-chave"));
  const decl = pedidos[0].corpo.tools[0].functionDeclarations;
  assert.ok(!("parameters" in decl.find((d: any) => d.name === "resumo_loja")), "ferramenta sem parâmetros não envia schema vazio");
  assert.ok("parameters" in decl.find((d: any) => d.name === "ver_produto"));
  const c2 = pedidos[1].corpo.contents;
  assert.equal(c2[1].role, "model"); assert.equal(c2[1].parts[0].thoughtSignature, "sig"); // parte original preservada
  assert.equal(c2[2].role, "user"); assert.deepEqual(c2[2].parts[0].functionResponse, { name: "ver_produto", response: { resultado: { estoque: 0 } } });
});

test("gemini: sem candidatos (bloqueio) e chave inválida viram erros genéricos", async () => {
  const vazio = (async () => resp({ candidates: [] })) as unknown as typeof fetch;
  await assert.rejects(conversar({ provedor: "gemini", chave: "k", modelo: "m", sistema: "s", mensagens: [], ferramentas: [], executar: async () => 1, fetch: vazio }), (e: unknown) => e instanceof IaErro && e.status === 502);
  const ruim = (async () => new Response('{"error":{"message":"API key not valid. segredo-xyz"}}', { status: 400 })) as unknown as typeof fetch;
  await assert.rejects(conversar({ provedor: "gemini", chave: "k", modelo: "m", sistema: "s", mensagens: [], ferramentas: [], executar: async () => 1, fetch: ruim }), (e: unknown) => e instanceof IaErro && e.status === 401 && !e.message.includes("segredo-xyz"));
});

test("compatível OpenAI (Llama): tool_calls -> mensagens role=tool, URL e cabeçalho corretos", async () => {
  const pedidos: { url: string; headers: any; corpo: any }[] = [];
  const f = (async (url: string, init: RequestInit) => {
    pedidos.push({ url, headers: init.headers, corpo: JSON.parse(String(init.body)) });
    if (pedidos.length === 1) return resp({ usage: { total_tokens: 20 }, choices: [{ message: { content: null, tool_calls: [{ id: "call_1", type: "function", function: { name: "resumo_loja", arguments: "{}" } }] } }] });
    return resp({ usage: { total_tokens: 9 }, choices: [{ message: { content: "4 produtos." } }] });
  }) as unknown as typeof fetch;
  const r = await conversar({ provedor: "compativel_openai", baseUrl: "https://api.groq.com/openai/v1/", chave: "gsk-1", modelo: "llama-x", sistema: "S", mensagens: [{ role: "user", content: "resumo" }], ferramentas: FERRAMENTAS, executar: async () => ({ produtos: 4 }), fetch: f });
  assert.equal(r.texto, "4 produtos."); assert.equal(r.tokens, 29);
  assert.equal(pedidos[0].url, "https://api.groq.com/openai/v1/chat/completions"); assert.equal(pedidos[0].headers.authorization, "Bearer gsk-1");
  assert.equal(pedidos[0].corpo.messages[0].role, "system"); assert.equal(pedidos[0].corpo.tools[0].type, "function");
  const m = pedidos[1].corpo.messages;
  assert.equal(m.at(-2).tool_calls[0].id, "call_1"); assert.equal(m.at(-1).role, "tool"); assert.equal(m.at(-1).tool_call_id, "call_1");
});

test("compatível OpenAI: recusa endereço interno/http, argumentos inválidos viram {} sem quebrar", async () => {
  const f = (async () => resp({ choices: [{ message: { content: "x" } }] })) as unknown as typeof fetch;
  for (const base of ["http://api.exemplo.com/v1", "https://localhost/v1", "https://10.0.0.1/v1", "https://exemplo.com:8080/v1", undefined])
    await assert.rejects(conversar({ provedor: "compativel_openai", baseUrl: base, chave: "k", modelo: "m", sistema: "s", mensagens: [], ferramentas: [], executar: async () => 1, fetch: f }), (e: unknown) => e instanceof IaErro && e.status === 400, String(base));
  let n = 0;
  const g = (async () => (++n === 1 ? resp({ choices: [{ message: { tool_calls: [{ id: "c", function: { name: "resumo_loja", arguments: "{quebrado" } }] } }] }) : resp({ choices: [{ message: { content: "ok" } }] }))) as unknown as typeof fetch;
  let recebido: unknown = "nada";
  const r = await conversar({ provedor: "compativel_openai", baseUrl: "https://a.exemplo.com/v1", chave: "k", modelo: "m", sistema: "s", mensagens: [], ferramentas: [], executar: async (_n, e) => { recebido = e; return 1; }, fetch: g });
  assert.equal(r.texto, "ok"); assert.deepEqual(recebido, {});
});

test("conversar: ferramenta solicitada que FALHA não conta como concluída; resposta completa quando o provedor terminou", async () => {
  let n = 0;
  const f = (async () => { n++; return n === 1 ? resp({ stop_reason: "tool_use", content: [{ type: "tool_use", id: "t1", name: "consultar", input: {} }] }) : resp({ stop_reason: "end_turn", content: [{ type: "text", text: "Não consegui consultar." }] }); }) as unknown as typeof fetch;
  const r = await conversar({ chave: "k", modelo: "m", sistema: "s", mensagens: [], ferramentas: [], executar: async () => { throw new Error("Consulta Bling desligada nesta loja."); }, fetch: f });
  assert.deepEqual(r.ferramentasUsadas, ["consultar"], "solicitada");
  assert.deepEqual(r.ferramentasConcluidas, [], "não concluída");
  assert.deepEqual(r.falhas, [{ nome: "consultar", motivo: "Consulta Bling desligada nesta loja." }]);
  assert.equal(r.completa, true);
});

test("conversar: o conteúdo devolvido ao modelo diz que a ferramenta NÃO foi concluída e que nada foi verificado", async () => {
  let enviado = "";
  let n = 0;
  const f = (async (_u: string, init: RequestInit) => { n++; if (n === 2) enviado = String(init.body); return n === 1 ? resp({ stop_reason: "tool_use", content: [{ type: "tool_use", id: "t1", name: "consultar", input: {} }] }) : resp({ stop_reason: "end_turn", content: [{ type: "text", text: "ok" }] }); }) as unknown as typeof fetch;
  await conversar({ chave: "k", modelo: "m", sistema: "s", mensagens: [], ferramentas: [], executar: async () => { throw new Error("Limite temporário"); }, fetch: f });
  assert.match(enviado, /FERRAMENTA NÃO CONCLUÍDA: Limite temporário/); assert.match(enviado, /não afirme ausência, execução ou resultado/);
});

test("conversar: corte por tamanho/bloqueio do provedor marca a resposta como INCOMPLETA nos 3 provedores", async () => {
  const casos: { provedor: "claude" | "gemini" | "compativel_openai"; corpo: unknown; esperado: string }[] = [
    { provedor: "claude", corpo: { stop_reason: "max_tokens", content: [{ type: "text", text: "Preço, Custo e Estoque: Mantidos como" }] }, esperado: "limite_tamanho" },
    { provedor: "gemini", corpo: { candidates: [{ finishReason: "MAX_TOKENS", content: { parts: [{ text: "Preço, Custo e Estoque: Mantidos como" }] } }] }, esperado: "limite_tamanho" },
    { provedor: "compativel_openai", corpo: { choices: [{ finish_reason: "length", message: { content: "Preço, Custo e Estoque: Mantidos como" } }] }, esperado: "limite_tamanho" },
    { provedor: "gemini", corpo: { candidates: [{ finishReason: "SAFETY", content: { parts: [{ text: "parcial" }] } }] }, esperado: "bloqueado" },
  ];
  for (const c of casos) {
    const f = (async () => resp(c.corpo)) as unknown as typeof fetch;
    const r = await conversar({ provedor: c.provedor, baseUrl: "https://api.exemplo-llm.com/v1", chave: "k", modelo: "m", sistema: "s", mensagens: [], ferramentas: [], executar: async () => ({}), fetch: f });
    assert.equal(r.completa, false, c.provedor); assert.equal(r.parada, c.esperado, c.provedor); assert.ok(r.texto.length > 0);
  }
  const ok = await conversar({ provedor: "gemini", chave: "k", modelo: "m", sistema: "s", mensagens: [], ferramentas: [], executar: async () => ({}), fetch: (async () => resp({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: "fim" }] } }] })) as unknown as typeof fetch });
  assert.equal(ok.completa, true); assert.equal(ok.parada, undefined);
});

test("persona: o agente se chama Nano.ia (nunca Genesis), fala natural e específico, sem expor provedor", async () => {
  const { SISTEMA } = await import("./ferramentas.ts");
  assert.match(SISTEMA, /Nano\.ia/); assert.doesNotMatch(SISTEMA, /g[eê]nesis|g[eê]nese/i);
  assert.match(SISTEMA, /ESPEC[ÍI]FICO/); assert.match(SISTEMA, /natural/i); assert.match(SISTEMA, /Nunca cite o nome do provedor/);
});
