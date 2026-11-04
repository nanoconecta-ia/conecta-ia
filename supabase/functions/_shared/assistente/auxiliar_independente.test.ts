import { test } from "node:test";
import assert from "node:assert/strict";
import { IaErro } from "../ia/claude.ts";
import { podeTrocarParaAuxiliar, urlAuxiliarPermitida, executarAuxiliarPublico } from "./auxiliar_independente.ts";

const k = { provedor: "compativel_openai", ativa: true, failover: true, base_url: "https://api.groq.com/openai/v1", modelo: "modelo-free-configurado" };
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
  assert.equal(podeTrocarParaAuxiliar(c, { ...k, failover: false }), false);
  assert.equal(podeTrocarParaAuxiliar(c, { ...k, ativa: false }), false);
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
