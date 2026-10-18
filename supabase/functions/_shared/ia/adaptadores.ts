// Adaptadores de provedor: convertem o formato canônico (blocos no estilo Messages API) de/para cada API.
// Canônico: mensagem {role, content: string | Bloco[]}; tool_use {id,nome,input}; tool_result {tool_use_id,content}.
// Nunca registram chave nem corpo de erro. Erros viram IaErro com mensagem genérica.
import { IaErro, type Bloco, type Ferramenta, type Mensagem } from "./tipos.ts";
import { urlPublicaSegura } from "./plugin.ts";

export type ProvedorId = "claude" | "gemini" | "compativel_openai";
export interface Chamada { chave: string; modelo: string; sistema: string; ferramentas: Ferramenta[]; maxTokens: number; baseUrl?: string; fetch?: typeof fetch }
export interface Passo { blocos: Bloco[]; tokens: number }

const TEMPO_MS = 60_000;

function erroHttp(status: number, corpo = ""): IaErro {
  if (status === 401 || status === 403 || /API_KEY_INVALID|API key not valid/i.test(corpo)) return new IaErro(401, "A chave de IA foi recusada pelo provedor. Confira a chave nas Integrações.");
  if (status === 429 || status === 529) return new IaErro(429, "O provedor de IA está sobrecarregado ou o limite da chave foi atingido. Tente em instantes.");
  if (status === 404) return new IaErro(502, "O provedor não encontrou o modelo informado. Confira o nome do modelo nas Integrações.");
  return new IaErro(502, "O provedor de IA devolveu um erro.");
}
async function enviar(f: typeof fetch, url: string, headers: Record<string, string>, corpo: unknown): Promise<unknown> {
  let r: Response;
  try {
    r = await f(url, { method: "POST", redirect: "manual", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(corpo), signal: AbortSignal.timeout(TEMPO_MS) });
  } catch {
    throw new IaErro(504, "O provedor de IA não respondeu a tempo.");
  }
  if (!r.ok) throw erroHttp(r.status, r.status === 400 ? (await r.text().catch(() => "")).slice(0, 500) : "");
  const j = await r.json().catch(() => null);
  if (!j || typeof j !== "object") throw new IaErro(502, "Resposta inesperada do provedor de IA.");
  return j;
}
const textoDe = (c: string | Bloco[]) => typeof c === "string" ? c : c.filter((b): b is Extract<Bloco, { type: "text" }> => b.type === "text").map((b) => b.text).join("\n");
const pareceVazio = (s: Record<string, unknown> | undefined) => !s || !s.properties || Object.keys(s.properties as object).length === 0;

// Claude (Messages API) ------------------------------------------------------------------------------
export async function chamarClaude(c: Chamada, msgs: Mensagem[]): Promise<Passo> {
  const j = await enviar(c.fetch ?? fetch, "https://api.anthropic.com/v1/messages",
    { "x-api-key": c.chave, "anthropic-version": "2023-06-01" },
    { model: c.modelo, max_tokens: c.maxTokens, system: c.sistema, messages: msgs, tools: c.ferramentas.length ? c.ferramentas : undefined }) as
    { content?: Bloco[]; usage?: { input_tokens?: number; output_tokens?: number } };
  if (!Array.isArray(j.content)) throw new IaErro(502, "Resposta inesperada do provedor de IA.");
  return { blocos: j.content, tokens: (j.usage?.input_tokens ?? 0) + (j.usage?.output_tokens ?? 0) };
}

// Gemini (Google AI Studio / Gemini API) ---------------------------------------------------------------
type ParteG = Record<string, unknown>;
export async function chamarGemini(c: Chamada, msgs: Mensagem[]): Promise<Passo> {
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
  const j = await enviar(c.fetch ?? fetch, `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(c.modelo)}:generateContent`,
    { "x-goog-api-key": c.chave },
    { systemInstruction: { parts: [{ text: c.sistema }] }, contents, tools: decl.length ? [{ functionDeclarations: decl }] : undefined, generationConfig: { maxOutputTokens: c.maxTokens } }) as
    { candidates?: { content?: { parts?: ParteG[] } }[]; usageMetadata?: { totalTokenCount?: number } };
  const partes = j.candidates?.[0]?.content?.parts;
  if (!Array.isArray(partes)) throw new IaErro(502, "O provedor não devolveu resposta (o conteúdo pode ter sido bloqueado). Reformule a pergunta.");
  const blocos: Bloco[] = [];
  let n = 0;
  for (const p of partes) {
    if (p.thought === true) continue;
    if (typeof p.text === "string") blocos.push({ type: "text", text: p.text });
    else if (p.functionCall) {
      const fc = p.functionCall as { name: string; args?: unknown };
      blocos.push({ type: "tool_use", id: `g${++n}`, name: fc.name, input: fc.args ?? {}, _g: p } as Bloco);
    }
  }
  return { blocos, tokens: j.usageMetadata?.totalTokenCount ?? 0 };
}

// Compatível com OpenAI (Llama via Groq/Together/OpenRouter/llama.cpp/Ollama expostos em https, DeepSeek, OpenAI) ----------
export async function chamarOpenAI(c: Chamada, msgs: Mensagem[]): Promise<Passo> {
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
  const j = await enviar(c.fetch ?? fetch, `${c.baseUrl.replace(/\/+$/, "")}/chat/completions`, { authorization: `Bearer ${c.chave}` },
    { model: c.modelo, messages: m, max_tokens: c.maxTokens, tools: tools.length ? tools : undefined }) as
    { choices?: { message?: { content?: string | null; tool_calls?: { id: string; function: { name: string; arguments?: string } }[] } }[]; usage?: { total_tokens?: number } };
  const msg = j.choices?.[0]?.message;
  if (!msg) throw new IaErro(502, "Resposta inesperada do provedor de IA.");
  const blocos: Bloco[] = [];
  if (msg.content) blocos.push({ type: "text", text: msg.content });
  for (const t of msg.tool_calls ?? []) {
    let entrada: unknown = {}; try { entrada = JSON.parse(t.function.arguments || "{}"); } catch { /* argumentos inválidos: ferramenta recebe {} */ }
    blocos.push({ type: "tool_use", id: t.id, name: t.function.name, input: entrada });
  }
  return { blocos, tokens: j.usage?.total_tokens ?? 0 };
}

export const ADAPTADORES: Record<ProvedorId, (c: Chamada, m: Mensagem[]) => Promise<Passo>> = { claude: chamarClaude, gemini: chamarGemini, compativel_openai: chamarOpenAI };
