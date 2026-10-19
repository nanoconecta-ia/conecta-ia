// Adaptadores de provedor COM STREAMING (SSE): mesmo contrato do adaptador não-streaming (adaptadores.ts), mas entregam cada
// delta de texto a `aoTexto` assim que chega e devolvem o `Passo` final idêntico (blocos text/tool_use com input já parseado
// e tokens somados), para o laço `conversar` não mudar. Suportam cancelamento (AbortSignal => IaErro 499) e timeout de
// inatividade entre eventos (IaErro 504). Nunca registram chave, cabeçalhos nem corpo; redirect manual; mensagens de erro genéricas.
//
// ATENÇÃO — verificação: tudo aqui foi testado SOMENTE com corpos SSE falsos (fixtures escritas a partir do formato documentado
// de cada API) e fetch simulado. NÃO foi testado contra o serviço real de nenhum provedor (não há chave). Antes de ligar em
// produção, rodar uma chamada real por provedor e comparar o Passo com o do adaptador não-streaming.
import { IaErro, type Bloco, type Mensagem } from "./tipos.ts";
import { urlPublicaSegura } from "./plugin.ts";
import type { Chamada, Passo, ProvedorId } from "./adaptadores.ts";

export type ChamadaStream = Chamada & { inatividadeMs?: number };
export type AoTexto = (delta: string) => void;
export type AdaptadorStream = (c: ChamadaStream, msgs: Mensagem[], aoTexto: AoTexto, sinal?: AbortSignal) => Promise<Passo>;

const TEMPO_MS = 60_000;
const MAX_BUFFER = 2_000_000;

function erroHttp(status: number, corpo = ""): IaErro {
  if (status === 401 || status === 403 || /API_KEY_INVALID|API key not valid/i.test(corpo)) return new IaErro(401, "A chave de IA foi recusada pelo provedor. Confira a chave nas Integrações.");
  if (status === 429 || status === 529) return new IaErro(429, "O provedor de IA está sobrecarregado ou o limite da chave foi atingido. Tente em instantes.");
  if (status === 404) return new IaErro(502, "O provedor não encontrou o modelo informado. Confira o nome do modelo nas Integrações.");
  return new IaErro(502, "O provedor de IA devolveu um erro.");
}
const ERRO_401 = () => erroHttp(401), ERRO_429 = () => erroHttp(429), ERRO_404 = () => erroHttp(404), ERRO_GENERICO = () => erroHttp(500);

/** Erro anunciado DENTRO do stream (o HTTP já era 200): mapeia por tipo/código sem repetir a mensagem do provedor. */
function erroDeEvento(tipo: unknown, codigo: unknown): IaErro {
  const t = String(tipo ?? "").toLowerCase(), c = String(codigo ?? "").toLowerCase();
  if (/overloaded|rate_limit|resource_exhausted|too_many/.test(t) || /^(429|529)$/.test(c) || /rate/.test(c)) return ERRO_429();
  if (/authentication|permission|unauthenticated|invalid_api_key/.test(t) || /^(401|403)$/.test(c) || /invalid_api_key/.test(c)) return ERRO_401();
  if (/not_found/.test(t) || c === "404") return ERRO_404();
  return ERRO_GENERICO();
}

// ------------------------------------------------------------------------------------------------ leitor SSE
export interface EventoSse { event: string | null; data: string }

function lerPedaco(leitor: ReadableStreamDefaultReader<Uint8Array>, sinal: AbortSignal | undefined, ms: number): Promise<ReadableStreamReadResult<Uint8Array>> {
  return new Promise((resolve, reject) => {
    if (sinal?.aborted) { reject(new IaErro(499, "cancelado")); return; }
    const t = setTimeout(() => { limpar(); reject(new IaErro(504, "O provedor de IA parou de responder.")); }, ms);
    const aoCancelar = () => { limpar(); reject(new IaErro(499, "cancelado")); };
    const limpar = () => { clearTimeout(t); sinal?.removeEventListener("abort", aoCancelar); };
    sinal?.addEventListener("abort", aoCancelar, { once: true });
    leitor.read().then((r) => { limpar(); resolve(r); }, () => { limpar(); reject(new IaErro(502, "A conexão com o provedor de IA foi interrompida.")); });
  });
}

/** Parser SSE: eventos partidos entre chunks, \r\n / \n / \r, comentários (":"), `data` multilinha e UTF-8 partido no meio do caractere. */
export async function* lerEventosSse(corpo: ReadableStream<Uint8Array>, sinal: AbortSignal | undefined, inatividadeMs = TEMPO_MS): AsyncGenerator<EventoSse> {
  const leitor = corpo.getReader();
  const dec = new TextDecoder("utf-8");
  let buf = "", evento: string | null = null, dados: string[] = [];
  const prontos: EventoSse[] = [];
  const linha = (l: string) => {
    if (l === "") { if (dados.length) prontos.push({ event: evento, data: dados.join("\n") }); evento = null; dados = []; return; }
    if (l[0] === ":") return;
    const i = l.indexOf(":");
    const campo = i === -1 ? l : l.slice(0, i);
    let valor = i === -1 ? "" : l.slice(i + 1);
    if (valor[0] === " ") valor = valor.slice(1);
    if (campo === "data") dados.push(valor); else if (campo === "event") evento = valor;
  };
  const processar = (final: boolean) => {
    for (;;) {
      const m = /\r\n|\n|\r/.exec(buf);
      if (!m) break;
      if (m[0] === "\r" && m.index + 1 === buf.length && !final) break; // pode ser o início de \r\n no próximo chunk
      const l = buf.slice(0, m.index);
      buf = buf.slice(m.index + m[0].length);
      linha(l);
    }
    if (final && buf !== "") { linha(buf); buf = ""; }
  };
  try {
    for (;;) {
      const r = await lerPedaco(leitor, sinal, inatividadeMs);
      if (r.done) break;
      buf += dec.decode(r.value, { stream: true });
      if (buf.length > MAX_BUFFER) throw new IaErro(502, "Resposta inesperada do provedor de IA.");
      processar(false);
      while (prontos.length) yield prontos.shift()!;
    }
    buf += dec.decode();
    processar(true);
    if (dados.length) prontos.push({ event: evento, data: dados.join("\n") });
    while (prontos.length) yield prontos.shift()!;
  } finally {
    leitor.cancel().catch(() => {});
  }
}

// ------------------------------------------------------------------------------------------------ requisição
async function abrirEventos(c: ChamadaStream, url: string, headers: Record<string, string>, corpo: unknown, sinal?: AbortSignal): Promise<{ eventos: AsyncGenerator<EventoSse>; encerrar: () => void }> {
  if (sinal?.aborted) throw new IaErro(499, "cancelado");
  const f = c.fetch ?? fetch;
  const ms = c.inatividadeMs ?? TEMPO_MS;
  const ctrl = new AbortController();
  const aoCancelar = () => ctrl.abort();
  sinal?.addEventListener("abort", aoCancelar, { once: true });
  const soltar = () => sinal?.removeEventListener("abort", aoCancelar);
  const t = setTimeout(() => ctrl.abort(), ms); // tempo para o provedor começar a responder
  let r: Response;
  try {
    r = await f(url, { method: "POST", redirect: "manual", headers: { "content-type": "application/json", accept: "text/event-stream", ...headers }, body: JSON.stringify(corpo), signal: ctrl.signal });
  } catch {
    clearTimeout(t); soltar();
    throw sinal?.aborted ? new IaErro(499, "cancelado") : new IaErro(504, "O provedor de IA não respondeu a tempo.");
  }
  clearTimeout(t);
  if (!r.ok) {
    soltar();
    const detalhe = r.status === 400 ? (await r.text().catch(() => "")).slice(0, 500) : "";
    throw erroHttp(r.status, detalhe);
  }
  if (!r.body) { soltar(); throw new IaErro(502, "Resposta inesperada do provedor de IA."); }
  return { eventos: lerEventosSse(r.body, sinal, ms), encerrar: () => { soltar(); ctrl.abort(); } };
}

const json = (s: string): any => { try { return JSON.parse(s); } catch { return undefined; } };
const interrompida = () => new IaErro(502, "A resposta do provedor de IA foi interrompida.");

// ------------------------------------------------------------------------------------------------ Claude
export const chamarClaudeStream: AdaptadorStream = async (c, msgs, aoTexto, sinal) => {
  const { eventos, encerrar } = await abrirEventos(c, "https://api.anthropic.com/v1/messages", { "x-api-key": c.chave, "anthropic-version": "2023-06-01" },
    { model: c.modelo, max_tokens: c.maxTokens, system: c.sistema, messages: msgs, tools: c.ferramentas.length ? c.ferramentas : undefined, stream: true }, sinal);
  try {
    const blocos: (Bloco | undefined)[] = [];
    const parcial: Record<number, string> = {};
    let tin = 0, tout = 0, fim = false, respostaId: string | undefined, modelo: string | undefined;
    for await (const ev of eventos) {
      const j = json(ev.data);
      if (!j || typeof j !== "object") continue;
      switch (j.type ?? ev.event) {
        case "message_start": respostaId = j.message?.id; modelo = j.message?.model; tin = j.message?.usage?.input_tokens ?? 0; tout = j.message?.usage?.output_tokens ?? 0; break;
        case "content_block_start": {
          const b = j.content_block;
          if (b?.type === "text") { blocos[j.index] = { type: "text", text: b.text ?? "" }; if (b.text) aoTexto(b.text); }
          else if (b?.type === "tool_use") { blocos[j.index] = { type: "tool_use", id: b.id, name: b.name, input: {} }; parcial[j.index] = ""; }
          break;
        }
        case "content_block_delta": {
          const d = j.delta, bl = blocos[j.index];
          if (d?.type === "text_delta" && bl?.type === "text" && typeof d.text === "string") { bl.text += d.text; if (d.text) aoTexto(d.text); }
          else if (d?.type === "input_json_delta" && bl?.type === "tool_use") parcial[j.index] += d.partial_json ?? "";
          break;
        }
        case "content_block_stop": {
          const bl = blocos[j.index];
          if (bl?.type === "tool_use") { const acc = (parcial[j.index] ?? "").trim(); (bl as { input: unknown }).input = acc ? (json(acc) ?? {}) : {}; }
          break;
        }
        case "message_delta": tout = j.usage?.output_tokens ?? tout; break;
        case "message_stop": fim = true; break;
        case "error": throw erroDeEvento(j.error?.type, j.error?.code);
        default: break; // ping etc.
      }
    }
    if (!fim) throw interrompida();
    return { blocos: blocos.filter((b): b is Bloco => !!b && !(b.type === "text" && b.text === "")), tokens: tin + tout, respostaId, modelo };
  } finally { encerrar(); }
};

// ------------------------------------------------------------------------------------------------ Compatível com OpenAI
const textoDe = (c: string | Bloco[]) => typeof c === "string" ? c : c.filter((b): b is Extract<Bloco, { type: "text" }> => b.type === "text").map((b) => b.text).join("\n");

export const chamarOpenAIStream: AdaptadorStream = async (c, msgs, aoTexto, sinal) => {
  if (!c.baseUrl || !urlPublicaSegura(c.baseUrl)) throw new IaErro(400, "Endereço do provedor não é permitido (use https público, sem porta, usuário ou parâmetros).");
  const m: Record<string, unknown>[] = [{ role: "system", content: c.sistema }];
  for (const x of msgs) {
    if (typeof x.content === "string") { m.push({ role: x.role, content: x.content }); continue; }
    if (x.role === "assistant") {
      const usos = x.content.filter((b): b is Extract<Bloco, { type: "tool_use" }> => b.type === "tool_use");
      m.push({ role: "assistant", content: textoDe(x.content) || null, ...(usos.length ? { tool_calls: usos.map((u) => ({ id: u.id, type: "function", function: { name: u.name, arguments: JSON.stringify(u.input ?? {}) } })) } : {}) });
    } else {
      for (const b of x.content) if (b.type === "tool_result") m.push({ role: "tool", tool_call_id: b.tool_use_id, content: b.content });
      const t = textoDe(x.content); if (t) m.push({ role: "user", content: t });
    }
  }
  const tools = c.ferramentas.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.input_schema } }));
  const { eventos, encerrar } = await abrirEventos(c, `${c.baseUrl.replace(/\/+$/, "")}/chat/completions`, { authorization: `Bearer ${c.chave}` },
    { model: c.modelo, messages: m, max_tokens: c.maxTokens, tools: tools.length ? tools : undefined, stream: true, stream_options: { include_usage: true } }, sinal);
  try {
    let texto = "", tokens = 0, terminou = false, respostaId: string | undefined, modelo: string | undefined;
    const chamadas = new Map<number, { id?: string; nome: string; args: string }>();
    for await (const ev of eventos) {
      if (ev.data.trim() === "[DONE]") { terminou = true; break; }
      const j = json(ev.data);
      if (!j || typeof j !== "object") continue;
      if (j.error) throw erroDeEvento(j.error.type, j.error.code);
      respostaId ??= j.id; modelo ??= j.model;
      if (j.usage?.total_tokens != null) tokens = j.usage.total_tokens;
      const ch = j.choices?.[0];
      if (!ch) continue;
      const d = ch.delta;
      if (typeof d?.content === "string" && d.content) { texto += d.content; aoTexto(d.content); }
      for (const tc of d?.tool_calls ?? []) {
        const i: number = typeof tc.index === "number" ? tc.index : (!tc.id && chamadas.size > 0 ? chamadas.size - 1 : chamadas.size);
        const atual = chamadas.get(i) ?? { nome: "", args: "" };
        if (tc.id && !atual.id) atual.id = tc.id;
        if (tc.function?.name) atual.nome += tc.function.name;
        if (typeof tc.function?.arguments === "string") atual.args += tc.function.arguments;
        chamadas.set(i, atual);
      }
      if (ch.finish_reason) terminou = true;
    }
    if (!terminou) throw interrompida();
    const blocos: Bloco[] = [];
    if (texto) blocos.push({ type: "text", text: texto });
    for (const [i, t] of [...chamadas.entries()].sort((a, b) => a[0] - b[0])) {
      blocos.push({ type: "tool_use", id: t.id ?? `t${i}`, name: t.nome, input: (t.args.trim() ? json(t.args) : {}) ?? {} });
    }
    return { blocos, tokens, respostaId, modelo };
  } finally { encerrar(); }
};

// ------------------------------------------------------------------------------------------------ Gemini
type ParteG = Record<string, unknown>;
const pareceVazio = (s: Record<string, unknown> | undefined) => !s || !s.properties || Object.keys(s.properties as object).length === 0;

export const chamarGeminiStream: AdaptadorStream = async (c, msgs, aoTexto, sinal) => {
  const nomeDe = new Map<string, string>();
  const contents = msgs.map((m) => {
    if (typeof m.content === "string") return { role: m.role === "user" ? "user" : "model", parts: [{ text: m.content }] };
    const parts: ParteG[] = [];
    for (const b of m.content) {
      if (b.type === "text") parts.push({ text: b.text });
      else if (b.type === "tool_use") { nomeDe.set(b.id, b.name); parts.push((b as { _g?: ParteG })._g ?? { functionCall: { name: b.name, args: b.input ?? {} } }); }
      else {
        let resposta: unknown = b.content; try { resposta = JSON.parse(b.content); } catch { /* texto */ }
        parts.push({ functionResponse: { name: nomeDe.get(b.tool_use_id) ?? "ferramenta", response: b.is_error ? { erro: resposta } : { resultado: resposta } } });
      }
    }
    return { role: m.role === "user" ? "user" : "model", parts };
  });
  const decl = c.ferramentas.map((t) => {
    const { additionalProperties: _a, ...schema } = t.input_schema as Record<string, unknown>;
    return pareceVazio(schema) ? { name: t.name, description: t.description } : { name: t.name, description: t.description, parameters: schema };
  });
  const { eventos, encerrar } = await abrirEventos(c, `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(c.modelo)}:streamGenerateContent?alt=sse`, { "x-goog-api-key": c.chave },
    { systemInstruction: { parts: [{ text: c.sistema }] }, contents, tools: decl.length ? [{ functionDeclarations: decl }] : undefined, generationConfig: { maxOutputTokens: c.maxTokens } }, sinal);
  try {
    const blocos: Bloco[] = [];
    let n = 0, tokens = 0, respostaId: string | undefined, modelo: string | undefined, viuPartes = false, textoAtual: Extract<Bloco, { type: "text" }> | null = null;
    for await (const ev of eventos) {
      const j = json(ev.data);
      if (!j || typeof j !== "object") continue;
      if (j.error) throw erroDeEvento(j.error.status, j.error.code);
      respostaId ??= j.responseId; modelo ??= j.modelVersion;
      if (j.usageMetadata?.totalTokenCount != null) tokens = j.usageMetadata.totalTokenCount;
      const partes = j.candidates?.[0]?.content?.parts;
      if (!Array.isArray(partes)) continue;
      viuPartes = true;
      for (const p of partes as ParteG[]) {
        if (p.thought === true) continue;
        if (typeof p.text === "string") {
          if (p.text) aoTexto(p.text);
          if (textoAtual) textoAtual.text += p.text;
          else if (p.text) { textoAtual = { type: "text", text: p.text }; blocos.push(textoAtual); }
        } else if (p.functionCall) {
          const fc = p.functionCall as { name: string; args?: unknown };
          textoAtual = null; // texto depois de uma chamada abre um novo bloco
          blocos.push({ type: "tool_use", id: `g${++n}`, name: fc.name, input: fc.args ?? {}, _g: p } as Bloco);
        }
      }
    }
    if (!viuPartes) throw new IaErro(502, "O provedor não devolveu resposta (o conteúdo pode ter sido bloqueado). Reformule a pergunta.");
    return { blocos, tokens, respostaId, modelo };
  } finally { encerrar(); }
};

export const ADAPTADORES_STREAM: Record<ProvedorId, AdaptadorStream> = { claude: chamarClaudeStream, gemini: chamarGeminiStream, compativel_openai: chamarOpenAIStream };
