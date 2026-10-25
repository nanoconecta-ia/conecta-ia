// Testes dos adaptadores com streaming. Corpos SSE FALSOS + fetch simulado: nada de rede, nada de chave real.
// Ver o aviso no topo de adaptadores_stream.ts: o formato de cada provedor NÃO foi confirmado contra o serviço real.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ADAPTADORES_STREAM, lerEventosSse, type ChamadaStream } from "./adaptadores_stream.ts";
import { ADAPTADORES } from "./adaptadores.ts";
import { IaErro, type Mensagem } from "./tipos.ts";

const enc = new TextEncoder();
const CHAVE = "chave-secreta-de-teste-123";

function corpoSse(pedacos: (string | Uint8Array)[], depois: "fechar" | "pendurar" | "erro" = "fechar"): ReadableStream<Uint8Array> {
  let i = 0;
  return new ReadableStream<Uint8Array>({
    pull(ctrl) {
      if (i < pedacos.length) { const p = pedacos[i++]; ctrl.enqueue(typeof p === "string" ? enc.encode(p) : p); return; }
      if (depois === "pendurar") return new Promise(() => {});
      if (depois === "erro") { ctrl.error(new Error("rede caiu")); return; }
      ctrl.close();
    },
  });
}
const resposta = (pedacos: (string | Uint8Array)[], depois: "fechar" | "pendurar" | "erro" = "fechar", status = 200) =>
  new Response(corpoSse(pedacos, depois), { status, headers: { "content-type": "text/event-stream" } });
function fetchCom(r: () => Response | Promise<Response>) {
  const chamadas: { url: string; init: RequestInit }[] = [];
  const f = (async (url: string, init: RequestInit) => { chamadas.push({ url: String(url), init }); return r(); }) as typeof fetch;
  return Object.assign(f, { chamadas });
}
const ev = (obj: unknown, nome?: string) => `${nome ? `event: ${nome}\n` : ""}data: ${JSON.stringify(obj)}\n\n`;
const chamada = (f: typeof fetch, extra: Partial<ChamadaStream> = {}): ChamadaStream => ({
  chave: CHAVE, modelo: "modelo-x", sistema: "Você é o Nano.ia.", maxTokens: 256, fetch: f, baseUrl: "https://api.exemplo-llm.com/v1",
  ferramentas: [{ name: "buscar", description: "busca", input_schema: { type: "object", properties: { q: { type: "string" } }, required: ["q"] } }], ...extra,
});
const msgs: Mensagem[] = [{ role: "user", content: "olá" }];
const respJson = (corpo: unknown) => new Response(JSON.stringify(corpo));
const rejeita = (p: Promise<unknown>, status: number) => assert.rejects(p, (e) => e instanceof IaErro && e.status === status);

// ------------------------------------------------------------------------------------------------ parser SSE
test("parser SSE: \\r\\n, \\r solto, comentários, data multilinha, evento partido em vários chunks e fim sem linha em branco", async () => {
  const corpo = corpoSse([
    ": comentário de keep-alive\r\n", "event: a\r\ndata: lin", "ha1\r\ndata: linha2\r\n\r", "\ndata: sem-evento\n\n", "data:sem espaço\r\r", "event: final\ndata: x",
  ]);
  const lidos: unknown[] = [];
  for await (const e of lerEventosSse(corpo, undefined, 1000)) lidos.push(e);
  assert.deepEqual(lidos, [
    { event: "a", data: "linha1\nlinha2" }, { event: null, data: "sem-evento" }, { event: null, data: "sem espaço" }, { event: "final", data: "x" },
  ]);
});

test("parser SSE: caractere UTF-8 partido no meio de dois chunks é reconstruído", async () => {
  const bytes = enc.encode('data: {"t":"ação é útil"}\n\n');
  const corte = bytes.indexOf(0xc3) + 1; // no meio do "ç"
  const corpo = corpoSse([bytes.slice(0, corte), bytes.slice(corte)]);
  const lidos: string[] = [];
  for await (const e of lerEventosSse(corpo, undefined, 1000)) lidos.push(e.data);
  assert.deepEqual(lidos, ['{"t":"ação é útil"}']);
});

// ------------------------------------------------------------------------------------------------ Claude
const claudeEventos = (): string[] => [
  ev({ type: "message_start", message: { usage: { input_tokens: 10, output_tokens: 1 } } }, "message_start"),
  ev({ type: "ping" }, "ping"),
  ev({ type: "content_block_start", index: 0, content_block: { type: "text", text: "" } }, "content_block_start"),
  ev({ type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "Vou " } }, "content_block_delta"),
  ev({ type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "buscar." } }, "content_block_delta"),
  ev({ type: "content_block_stop", index: 0 }, "content_block_stop"),
  ev({ type: "content_block_start", index: 1, content_block: { type: "tool_use", id: "tu_1", name: "buscar", input: {} } }, "content_block_start"),
  ev({ type: "content_block_delta", index: 1, delta: { type: "input_json_delta", partial_json: '{"q":"cabe' } }, "content_block_delta"),
  ev({ type: "content_block_delta", index: 1, delta: { type: "input_json_delta", partial_json: 'çote HR"}' } }, "content_block_delta"),
  ev({ type: "content_block_stop", index: 1 }, "content_block_stop"),
  ev({ type: "message_delta", delta: { stop_reason: "tool_use" }, usage: { output_tokens: 7 } }, "message_delta"),
  ev({ type: "message_stop" }, "message_stop"),
];

test("Claude: texto em deltas, tool_use com JSON fragmentado, tokens somados — e Passo igual ao do adaptador não-streaming", async () => {
  const todo = claudeEventos().join("");
  // quebra em pedaços arbitrários (inclusive no meio de linhas)
  const pedacos = todo.match(/[\s\S]{1,37}/g)!;
  const f = fetchCom(() => resposta(pedacos));
  const deltas: string[] = [];
  const r = await ADAPTADORES_STREAM.claude(chamada(f), msgs, (d) => deltas.push(d));
  assert.deepEqual(deltas, ["Vou ", "buscar."]);
  const sem = await ADAPTADORES.claude(chamada(fetchCom(() => respJson({ content: [{ type: "text", text: "Vou buscar." }, { type: "tool_use", id: "tu_1", name: "buscar", input: { q: "cabeçote HR" } }], usage: { input_tokens: 10, output_tokens: 7 } }))), msgs);
  assert.deepEqual(r, sem);
  assert.equal(r.tokens, 17);
  const { url, init } = f.chamadas[0];
  assert.equal(url, "https://api.anthropic.com/v1/messages"); assert.equal(init.redirect, "manual");
  assert.equal(JSON.parse(String(init.body)).stream, true);
  assert.equal((init.headers as Record<string, string>)["x-api-key"], CHAVE);
});

test("Claude: tool_use sem argumentos vira {} e erro dentro do stream (overloaded) vira IaErro 429", async () => {
  const sem = [ev({ type: "message_start", message: { usage: { input_tokens: 1 } } }), ev({ type: "content_block_start", index: 0, content_block: { type: "tool_use", id: "t", name: "buscar", input: {} } }),
    ev({ type: "content_block_stop", index: 0 }), ev({ type: "message_delta", usage: { output_tokens: 2 } }), ev({ type: "message_stop" })];
  const r = await ADAPTADORES_STREAM.claude(chamada(fetchCom(() => resposta(sem))), msgs, () => {});
  assert.deepEqual(r.blocos, [{ type: "tool_use", id: "t", name: "buscar", input: {} }]);
  const erro = [ev({ type: "message_start", message: { usage: { input_tokens: 1 } } }), ev({ type: "content_block_start", index: 0, content_block: { type: "text", text: "" } }),
    ev({ type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "meio" } }), ev({ type: "error", error: { type: "overloaded_error", message: `segredo ${CHAVE}` } })];
  const deltas: string[] = [];
  await assert.rejects(ADAPTADORES_STREAM.claude(chamada(fetchCom(() => resposta(erro))), msgs, (d) => deltas.push(d)), (e) => {
    assert.ok(e instanceof IaErro && e.status === 429); assert.ok(!e.message.includes(CHAVE), "mensagem do provedor não é repetida"); return true;
  });
  assert.deepEqual(deltas, ["meio"], "o texto que chegou antes do erro foi entregue");
});

test("Claude: stream que termina sem message_stop é erro (não resposta pela metade); conexão que cai também", async () => {
  const meio = claudeEventos().slice(0, 5).join("");
  await rejeita(ADAPTADORES_STREAM.claude(chamada(fetchCom(() => resposta([meio]))), msgs, () => {}), 502);
  await rejeita(ADAPTADORES_STREAM.claude(chamada(fetchCom(() => resposta([meio], "erro"))), msgs, () => {}), 502);
});

// ------------------------------------------------------------------------------------------------ OpenAI-compatível
test("OpenAI: texto + duas chamadas fragmentadas por index, usage no fim, [DONE] — e Passo igual ao não-streaming", async () => {
  const chunk = (delta: unknown, extra: Record<string, unknown> = {}) => ev({ choices: [{ index: 0, delta, ...extra }] });
  const corpo = [
    chunk({ role: "assistant", content: "Vou " }), chunk({ content: "buscar." }),
    chunk({ tool_calls: [{ index: 0, id: "call_a", type: "function", function: { name: "buscar", arguments: "" } }] }),
    chunk({ tool_calls: [{ index: 1, id: "call_b", type: "function", function: { name: "buscar", arguments: '{"q":"jun' } }] }),
    chunk({ tool_calls: [{ index: 0, function: { arguments: '{"q":"cabe' } }] }),
    chunk({ tool_calls: [{ index: 1, function: { arguments: 'ta"}' } }] }),
    chunk({ tool_calls: [{ index: 0, function: { arguments: 'çote"}' } }] }),
    chunk({}, { finish_reason: "tool_calls" }),
    ev({ choices: [], usage: { prompt_tokens: 20, completion_tokens: 9, total_tokens: 29 } }),
    "data: [DONE]\n\n",
  ].join("");
  const f = fetchCom(() => resposta(corpo.match(/[\s\S]{1,41}/g)!));
  const deltas: string[] = [];
  const r = await ADAPTADORES_STREAM.compativel_openai(chamada(f), msgs, (d) => deltas.push(d));
  assert.deepEqual(deltas, ["Vou ", "buscar."]);
  const sem = await ADAPTADORES.compativel_openai(chamada(fetchCom(() => respJson({ choices: [{ message: { content: "Vou buscar.", tool_calls: [
    { id: "call_a", function: { name: "buscar", arguments: '{"q":"cabeçote"}' } }, { id: "call_b", function: { name: "buscar", arguments: '{"q":"junta"}' } }] } }], usage: { total_tokens: 29 } }))), msgs);
  assert.deepEqual(r, sem);
  const { url, init } = f.chamadas[0];
  assert.equal(url, "https://api.exemplo-llm.com/v1/chat/completions"); assert.equal(init.redirect, "manual");
  const enviado = JSON.parse(String(init.body));
  assert.equal(enviado.stream, true); assert.deepEqual(enviado.stream_options, { include_usage: true });
  assert.equal((init.headers as Record<string, string>).authorization, `Bearer ${CHAVE}`);
});

test("OpenAI: argumentos inválidos viram {}, erro no meio do stream mapeia o código e endereço inseguro é recusado antes de qualquer chamada", async () => {
  const ruim = [ev({ choices: [{ delta: { tool_calls: [{ index: 0, id: "x", function: { name: "buscar", arguments: "{quebrado" } }] } }] }), ev({ choices: [{ delta: {}, finish_reason: "tool_calls" }] }), "data: [DONE]\n\n"];
  const r = await ADAPTADORES_STREAM.compativel_openai(chamada(fetchCom(() => resposta(ruim))), msgs, () => {});
  assert.deepEqual(r.blocos, [{ type: "tool_use", id: "x", name: "buscar", input: {} }]);
  const erro = [ev({ choices: [{ delta: { content: "oi" } }] }), ev({ error: { code: 429, message: `limite ${CHAVE}` } })];
  await assert.rejects(ADAPTADORES_STREAM.compativel_openai(chamada(fetchCom(() => resposta(erro))), msgs, () => {}), (e) => e instanceof IaErro && e.status === 429 && !e.message.includes(CHAVE));
  const f = fetchCom(() => resposta([]));
  await rejeita(ADAPTADORES_STREAM.compativel_openai(chamada(f, { baseUrl: "http://localhost:11434/v1" }), msgs, () => {}), 400);
  assert.equal(f.chamadas.length, 0);
  await rejeita(ADAPTADORES_STREAM.compativel_openai(chamada(fetchCom(() => resposta([ev({ choices: [{ delta: { content: "só isso" } }] })]))), msgs, () => {}), 502); // sem [DONE] nem finish_reason
});

// ------------------------------------------------------------------------------------------------ Gemini
test("Gemini: textos em vários eventos viram UM bloco, functionCall guarda a parte original (_g), usage e Passo igual ao não-streaming", async () => {
  const fc = { functionCall: { name: "buscar", args: { q: "junta" } }, thoughtSignature: "assinatura" };
  const corpo = [
    ev({ candidates: [{ content: { parts: [{ text: "Vou " }] } }] }), ev({ candidates: [{ content: { parts: [{ thought: true, text: "pensando" }, { text: "buscar." }] } }] }),
    ev({ candidates: [{ content: { parts: [fc] }, finishReason: "STOP" }], usageMetadata: { totalTokenCount: 42 } }),
  ].join("");
  const f = fetchCom(() => resposta(corpo.match(/[\s\S]{1,29}/g)!));
  const deltas: string[] = [];
  const r = await ADAPTADORES_STREAM.gemini(chamada(f), msgs, (d) => deltas.push(d));
  assert.deepEqual(deltas, ["Vou ", "buscar."], "pensamento interno não vai para o usuário");
  const sem = await ADAPTADORES.gemini(chamada(fetchCom(() => respJson({ candidates: [{ content: { parts: [{ text: "Vou buscar." }, fc] } }], usageMetadata: { totalTokenCount: 42 } }))), msgs);
  assert.deepEqual(r, sem);
  assert.equal((r.blocos[1] as { _g?: unknown })._g !== undefined, true);
  const { url, init } = f.chamadas[0];
  assert.equal(url, "https://generativelanguage.googleapis.com/v1beta/models/modelo-x:streamGenerateContent?alt=sse");
  assert.equal((init.headers as Record<string, string>)["x-goog-api-key"], CHAVE); assert.equal(init.redirect, "manual");
  assert.ok(!url.includes(CHAVE), "chave nunca vai na URL");
});

test("Gemini: UTF-8 partido entre chunks, erro no meio do stream e resposta vazia/bloqueada", async () => {
  const bytes = enc.encode(ev({ candidates: [{ content: { parts: [{ text: "ação é útil" }] } }] }));
  const corte = bytes.indexOf(0xc3) + 1;
  const deltas: string[] = [];
  const r = await ADAPTADORES_STREAM.gemini(chamada(fetchCom(() => resposta([bytes.slice(0, corte), bytes.slice(corte)]))), msgs, (d) => deltas.push(d));
  assert.deepEqual(deltas, ["ação é útil"]); assert.deepEqual(r.blocos, [{ type: "text", text: "ação é útil" }]);
  await rejeita(ADAPTADORES_STREAM.gemini(chamada(fetchCom(() => resposta([ev({ error: { code: 429, status: "RESOURCE_EXHAUSTED", message: CHAVE } })]))), msgs, () => {}), 429);
  await rejeita(ADAPTADORES_STREAM.gemini(chamada(fetchCom(() => resposta([ev({ promptFeedback: { blockReason: "SAFETY" } })]))), msgs, () => {}), 502);
});

// ------------------------------------------------------------------------------------------------ HTTP, cancelamento e timeout
test("erros HTTP seguem o mapeamento do adaptador não-streaming e nunca expõem a chave", async () => {
  for (const [status, esperado] of [[401, 401], [403, 401], [429, 429], [529, 429], [404, 502], [500, 502], [503, 502]] as const) {
    for (const p of ["claude", "gemini", "compativel_openai"] as const) {
      await assert.rejects(ADAPTADORES_STREAM[p](chamada(fetchCom(() => new Response(`erro com ${CHAVE}`, { status }))), msgs, () => {}),
        (e) => e instanceof IaErro && e.status === esperado && !e.message.includes(CHAVE), `${p} ${status}`);
    }
  }
  await assert.rejects(ADAPTADORES_STREAM.gemini(chamada(fetchCom(() => new Response("API key not valid", { status: 400 }))), msgs, () => {}), (e) => e instanceof IaErro && e.status === 401);
  await rejeita(ADAPTADORES_STREAM.claude(chamada((async () => { throw new Error("DNS"); }) as typeof fetch), msgs, () => {}), 504);
});

test("cancelamento: AbortSignal no meio do stream => IaErro 499 e o stream é fechado; já cancelado nem chama o fetch", async () => {
  const cancelado = { n: 0 };
  const corpo = new ReadableStream<Uint8Array>({
    start(c) { c.enqueue(enc.encode(ev({ type: "message_start", message: { usage: { input_tokens: 1 } } }) + ev({ type: "content_block_start", index: 0, content_block: { type: "text", text: "" } }) + ev({ type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "primeiro" } }))); },
    pull() { return new Promise(() => {}); }, cancel() { cancelado.n++; },
  });
  const ac = new AbortController();
  const recebidos: string[] = [];
  await rejeita(ADAPTADORES_STREAM.claude(chamada(fetchCom(() => new Response(corpo))), msgs, (d) => { recebidos.push(d); ac.abort(); }, ac.signal), 499);
  assert.deepEqual(recebidos, ["primeiro"]); assert.equal(cancelado.n, 1);

  const f = fetchCom(() => resposta([]));
  const jaCancelado = new AbortController(); jaCancelado.abort();
  await rejeita(ADAPTADORES_STREAM.gemini(chamada(f), msgs, () => {}, jaCancelado.signal), 499);
  assert.equal(f.chamadas.length, 0);

  // cancelar enquanto espera o provedor começar a responder
  const ac2 = new AbortController();
  const lento = ((_u: string, init: RequestInit) => new Promise((_ok, no) => init.signal!.addEventListener("abort", () => no(new Error("abortado"))))) as unknown as typeof fetch;
  const p = ADAPTADORES_STREAM.compativel_openai(chamada(lento), msgs, () => {}, ac2.signal);
  setTimeout(() => ac2.abort(), 10);
  await rejeita(p, 499);
});

test("timeout de inatividade: sem eventos por inatividadeMs => IaErro 504 (e também se o provedor nem começa a responder)", async () => {
  const f = fetchCom(() => resposta([ev({ type: "message_start", message: { usage: { input_tokens: 1 } } })], "pendurar"));
  const t0 = Date.now();
  await rejeita(ADAPTADORES_STREAM.claude(chamada(f, { inatividadeMs: 40 }), msgs, () => {}), 504);
  assert.ok(Date.now() - t0 < 2000, "não esperou o timeout padrão de 60 s");
  const semResposta = ((_u: string, init: RequestInit) => new Promise((_ok, no) => init.signal!.addEventListener("abort", () => no(new Error("abortado"))))) as unknown as typeof fetch;
  await rejeita(ADAPTADORES_STREAM.gemini(chamada(semResposta, { inatividadeMs: 30 }), msgs, () => {}), 504);
});

test("o laço de conversa existente continua compatível: o Passo do streaming alimenta o mesmo formato de blocos", async () => {
  const r = await ADAPTADORES_STREAM.claude(chamada(fetchCom(() => resposta(claudeEventos()))), msgs, () => {});
  const usos = r.blocos.filter((b) => b.type === "tool_use");
  assert.equal(usos.length, 1); assert.deepEqual((usos[0] as { input: unknown }).input, { q: "cabeçote HR" });
});

test("streaming: corte por tamanho/bloqueio vira Passo.parada nos 3 provedores (e fim normal não marca nada)", async () => {
  const claude = (stop: string) => [ev({ type: "message_start", message: { id: "m1", model: "c", usage: { input_tokens: 1, output_tokens: 0 } } }, "message_start"), ev({ type: "content_block_start", index: 0, content_block: { type: "text", text: "Mantidos como" } }, "content_block_start"),
    ev({ type: "content_block_stop", index: 0 }, "content_block_stop"), ev({ type: "message_delta", delta: { stop_reason: stop }, usage: { output_tokens: 3 } }, "message_delta"), ev({ type: "message_stop" }, "message_stop")].join("");
  const openai = (fim: string) => ev({ choices: [{ index: 0, delta: { content: "Mantidos como" }, finish_reason: fim }] }) + "data: [DONE]\n\n";
  const gemini = (fim: string) => ev({ candidates: [{ content: { parts: [{ text: "Mantidos como" }] }, finishReason: fim }] });
  const rodar = async (prov: "claude" | "compativel_openai" | "gemini", corpo: string) => ADAPTADORES_STREAM[prov](chamada(fetchCom(() => resposta([corpo]))), msgs, () => {});
  assert.equal((await rodar("claude", claude("max_tokens"))).parada, "limite_tamanho");
  assert.equal((await rodar("claude", claude("end_turn"))).parada, undefined);
  assert.equal((await rodar("compativel_openai", openai("length"))).parada, "limite_tamanho");
  assert.equal((await rodar("compativel_openai", openai("content_filter"))).parada, "bloqueado");
  assert.equal((await rodar("compativel_openai", openai("stop"))).parada, undefined);
  assert.equal((await rodar("gemini", gemini("MAX_TOKENS"))).parada, "limite_tamanho");
  assert.equal((await rodar("gemini", gemini("SAFETY"))).parada, "bloqueado");
  assert.equal((await rodar("gemini", gemini("STOP"))).parada, undefined);
});
