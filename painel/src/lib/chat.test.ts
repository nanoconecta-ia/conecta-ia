import { test } from "node:test";
import assert from "node:assert/strict";
import { chamarFuncao, enviarMensagem, mensagemDeStatus, MENSAGEM_REDE, type ManipuladoresChat } from "./chat.ts";

const sse = (texto: string, status = 200) => new Response(new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode(texto)); c.close(); } }), { status, headers: { "content-type": "text/event-stream" } });

test("chat: despacha cada tipo de evento do contrato e manda JWT + apikey", async () => {
  const visto: string[] = []; let cab: Record<string, string> = {};
  const m: ManipuladoresChat = {
    conversa: (d) => visto.push("conversa:" + d.id), estado: (e) => visto.push("estado:" + e), texto: (t) => visto.push("texto:" + t),
    ferramentaInicio: (d) => visto.push("fi:" + d.nome), ferramentaFim: (d) => visto.push("ff:" + d.decisao), proposta: (d) => visto.push("prop:" + d.hash),
    uso: (d) => visto.push("uso:" + d.tokens), aviso: (d) => visto.push("aviso:" + d.mensagem), fim: () => visto.push("fim"),
  };
  const f = (async (_u: string, init: RequestInit) => { cab = init.headers as Record<string, string>; return sse(
    'event: conversa\ndata: {"id":"c1","titulo":"x"}\n\nevent: estado\ndata: {"estado":"interpretando"}\n\nevent: texto\ndata: {"delta":"Oi"}\n\n' +
    'event: ferramenta_inicio\ndata: {"id":"t1","nome":"ver_produto","risco":"LOW"}\n\nevent: ferramenta_fim\ndata: {"id":"t1","nome":"ver_produto","decisao":"permitida","ok":true,"resumo":"ok"}\n\n' +
    'event: proposta\ndata: {"id":"p1","versao":1,"hash":"abc","titulo":"t","risco":"MEDIUM"}\n\nevent: aviso\ndata: {"mensagem":"usei o Gemini","provedor":"gemini"}\n\nevent: futuro\ndata: {quebrado\n\nevent: uso\ndata: {"provedor":"claude","modelo":"m","tokens":12,"custo_estimado":null}\n\nevent: fim\ndata: {}\n\n'); }) as unknown as typeof fetch;
  await enviarMensagem({ loja_id: "l", texto: "oi" }, "JWT", m, undefined, f);
  assert.deepEqual(visto, ["conversa:c1", "estado:interpretando", "texto:Oi", "fi:ver_produto", "ff:permitida", "prop:abc", "aviso:usei o Gemini", "uso:12", "fim"]);
  assert.equal(cab.Authorization, "Bearer JWT"); assert.ok(cab.apikey);
});

test("chat: 404 = função não implantada, mensagem honesta; 503 e 401 também", async () => {
  const f = (s: number, corpo = "{}") => (async () => new Response(corpo, { status: s })) as unknown as typeof fetch;
  await assert.rejects(enviarMensagem({ loja_id: "l", texto: "x" }, "t", {}, undefined, f(404)), /não foi implantada/);
  await assert.rejects(enviarMensagem({ loja_id: "l", texto: "x" }, "t", {}, undefined, f(503, '{"erro":"Sem chave"}')), /Sem chave/);
  await assert.rejects(enviarMensagem({ loja_id: "l", texto: "x" }, "t", {}, undefined, f(401)), /sessão expirou/);
});

test("chat: falha de rede e evento ilegível não inventam resposta", async () => {
  await assert.rejects(enviarMensagem({ loja_id: "l", texto: "x" }, "t", {}, undefined, (async () => { throw new TypeError("Failed to fetch"); }) as unknown as typeof fetch), new RegExp(MENSAGEM_REDE.slice(0, 20)));
  const erros: string[] = [];
  await enviarMensagem({ loja_id: "l", texto: "x" }, "t", { erro: (e) => erros.push(e) }, undefined, (async () => sse("event: texto\ndata: {quebrado\n\n")) as unknown as typeof fetch);
  assert.equal(erros.length, 1);
});

test("chat: abortar não vira erro para a tela", async () => {
  const ac = new AbortController(); ac.abort();
  await enviarMensagem({ loja_id: "l", texto: "x" }, "t", {}, ac.signal, (async () => { const e = new Error("abort"); e.name = "AbortError"; throw e; }) as unknown as typeof fetch);
});

test("funcao: chamarFuncao devolve dados ou mensagem de status", async () => {
  const ok = await chamarFuncao("conector-aprovacoes", { acao: "x" }, "t", (async () => new Response('{"ok":true}')) as unknown as typeof fetch);
  assert.deepEqual(ok, { ok: true, status: 200, dados: { ok: true } });
  const conflito = await chamarFuncao("conector-aprovacoes", {}, "t", (async () => new Response('{"erro":"versao_ou_hash_divergente"}', { status: 409 })) as unknown as typeof fetch);
  assert.equal(conflito.ok, false); assert.match(conflito.erro!, /versao_ou_hash_divergente/);
  assert.match(mensagemDeStatus(404), /não foi implantada/);
  assert.equal(mensagemDeStatus(404, "Proposta não encontrada."), "Proposta não encontrada.");   // 404 com mensagem do servidor não é "não implantada"
  assert.equal(mensagemDeStatus(422, "Risco alto exige confirmação."), "Risco alto exige confirmação.");
});
