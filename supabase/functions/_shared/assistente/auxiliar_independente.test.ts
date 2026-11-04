import { test } from "node:test";
import assert from "node:assert/strict";
import { IaErro } from "../ia/claude.ts";
import { podeTrocarParaAuxiliar, urlAuxiliarPermitida, executarAuxiliarPublico, cotaAuxiliarPermitida } from "./auxiliar_independente.ts";

const k = { provedor: "compativel_openai", ativa: true, base_url: "https://api.groq.com/openai/v1", modelo: "modelo-free-configurado", limite_mensal_tokens: 5000, tokens_mes: 0, mes_ref: "2026-11-01" };
const c = { origem: "openrouter_free", erro: new IaErro(429, "limite"), iniciouChamadaProvedor: true,
  consentimento: true, texto: "O que é turbocompressor?", anexos: 0,
  textoTransmitido: false, tentativasFerramenta: 0, propostasCriadas: 0 };

test("roteador independente: so falha do OpenRouter e consulta publica explicitamente autorizada", () => {
  assert.equal(podeTrocarParaAuxiliar(c, k), true);
  for (const s of [429, 502, 504]) assert.equal(podeTrocarParaAuxiliar({ ...c, erro: new IaErro(s, "falha") }, k), true);
  for (const s of [400, 401, 403, 409, 503]) assert.equal(podeTrocarParaAuxiliar({ ...c, erro: new IaErro(s, "falha") }, k), false);
  assert.equal(podeTrocarParaAuxiliar({ ...c, origem: "gemini" }, k), false);
  assert.equal(podeTrocarParaAuxiliar({ ...c, consentimento: false }, k), false);
  assert.equal(podeTrocarParaAuxiliar({ ...c, iniciouChamadaProvedor: false }, k), false);
  assert.equal(podeTrocarParaAuxiliar({ ...c, textoTransmitido: true }, k), false);
  assert.equal(podeTrocarParaAuxiliar({ ...c, anexos: 1 }, k), false);
  assert.equal(podeTrocarParaAuxiliar({ ...c, tentativasFerramenta: 1 }, k), false);
  assert.equal(podeTrocarParaAuxiliar({ ...c, propostasCriadas: 1 }, k), false);
  assert.equal(podeTrocarParaAuxiliar({ ...c, texto: "Qual é o custo da peça CI000016?" }, k), false);
  assert.equal(podeTrocarParaAuxiliar(c, { ...k, limite_mensal_tokens: null }), false);
  assert.equal(podeTrocarParaAuxiliar(c, { ...k, ativa: false }), false);
});

test("cota conservadora: 1 mil a 50 mil tokens por mes e bloqueio ao esgotar", () => {
  const hoje = new Date("2026-11-04T12:00:00Z");
  const base = { limite_mensal_tokens: 5000, tokens_mes: 50, mes_ref: "2026-11-01" };
  assert.equal(cotaAuxiliarPermitida(base, hoje), true);
  assert.equal(cotaAuxiliarPermitida({ ...base, tokens_mes: 5000 }, hoje), false);
  assert.equal(cotaAuxiliarPermitida({ ...base, limite_mensal_tokens: 0 }, hoje), false);
  assert.equal(cotaAuxiliarPermitida({ ...base, limite_mensal_tokens: 50001 }, hoje), false);
  assert.equal(cotaAuxiliarPermitida({ ...base, limite_mensal_tokens: null }, hoje), false);
  assert.equal(cotaAuxiliarPermitida({ ...base, mes_ref: "2026-10-01", tokens_mes: 9000 }, hoje), true);
});

test("provedor independente: URL HTTPS exata e nao OpenRouter nem destino interno", () => {
  assert.equal(urlAuxiliarPermitida("https://api.groq.com/openai/v1"), true);
  assert.equal(urlAuxiliarPermitida("https://api.cerebras.ai/v1"), true);
  for (const u of ["https://openrouter.ai/api/v1", "http://api.groq.com/openai/v1",
    "https://api.groq.com.evil.test/openai/v1", "https://api.groq.com/openai/v1?x=1",
    "https://user@api.groq.com/openai/v1", "http://127.0.0.1:11434/v1"]) assert.equal(urlAuxiliarPermitida(u), false, u);
});

test("executor nunca faz rede com texto privado ou URL nao autorizada", async () => {
  let chamou = false;
  const fakeFetch = (async () => { chamou = true; throw new Error("rede nao permitida"); }) as typeof fetch;
  const p = { texto: "Meu cliente comprou CI000016", baseUrl: k.base_url, modelo: k.modelo, chave: "falsa", fetch: fakeFetch };
  assert.equal(await executarAuxiliarPublico(p), null);
  assert.equal(chamou, false);
  assert.equal(await executarAuxiliarPublico({ ...p, texto: c.texto, baseUrl: "https://openrouter.ai/api/v1" }), null);
  assert.equal(chamou, false);
});

test("executor entrega glossario sem contexto ERP com uma chamada simulada", async () => {
  let chamadas = 0;
  const fakeFetch = (async (url: string | URL | Request, init?: RequestInit) => {
    chamadas += 1;
    assert.equal(String(url), "https://api.groq.com/openai/v1/chat/completions");
    const body = JSON.parse(String(init?.body));
    assert.equal(body.model, k.modelo);
    assert.equal(body.messages.length, 2);
    assert.equal(body.messages[1].content, c.texto);
    assert.equal(body.tools, undefined);
    assert.doesNotMatch(JSON.stringify(body), /CI000016|fornecedor|custo|pedido|nome da loja/i);
    return new Response(JSON.stringify({
      id: "resposta-sintetica", model: k.modelo, usage: { total_tokens: 17 },
      choices: [{ finish_reason: "stop", message: { content: "O turbocompressor usa energia dos gases de escapamento para comprimir o ar admitido." } }],
    }), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  const r = await executarAuxiliarPublico({ texto: c.texto, baseUrl: k.base_url, modelo: k.modelo, chave: "chave-sintetica", fetch: fakeFetch });
  assert.equal(chamadas, 1);
  assert.equal(r?.tokens, 17);
  assert.match(r?.texto ?? "", /turbocompressor/);
  assert.equal(r?.provedor, "compativel_openai");
});
