// Cadeia local ponta a ponta com Chromium REAL: chamada MCP → gateway (composição) → fila → executor do dispositivo → Playwright → evidência.
import { test } from "node:test";
import assert from "node:assert/strict";
import { tratarMcpComLocal } from "../../supabase/functions/_shared/exec_local/gateway_local.ts";
import { FilaLocal } from "../../supabase/functions/_shared/exec_local/fila.ts";
import { gerarToken, sha256Hex } from "../../supabase/functions/_shared/conector/cripto.ts";
import { criarRunnerBrowser } from "./runner_browser.mjs";

const HOST = "teste.exemplo.com";
const rede = async (url) => new URL(url).pathname === "/redir"
  ? { status: 302, headers: { location: "https://10.0.0.5/admin" } }
  : { status: 200, headers: { "content-type": "text/html; charset=utf-8" }, body: "<title>Catálogo fictício</title><body><h1>Peça FIC0001</h1>" };
const tok = gerarToken(); const hash = await sha256Hex(tok.token);
const chave = { chave_id: "k1", loja_id: "lojaA", escopos: ["leitura"], criada_por: "dono", nome: "gemini" };
const log = [];
const runner = criarRunnerBrowser({ hostsPermitidos: [HOST], rede });
const fila = new FilaLocal({ agora: Date.now, revogada: async () => false, pausada: async () => false, consentimento: async () => null, auditar: async (e) => { log.push(e); }, runner });
const g = { validarChave: async (h) => (h === hash ? chave : null), limite: async () => true, contexto: () => ({}) };
let n = 0; const l = { fila, esperaMs: 20000, novoId: () => `t${++n}`, dispositivo: () => ({ dispositivo_id: "disp-lojaA", hosts_permitidos: [HOST] }) };
const laco = setInterval(() => { void fila.puxarEExecutar("lojaA", "disp-lojaA"); }, 20);
const chamar = async (url) => JSON.parse(JSON.parse((await tratarMcpComLocal({ metodo: "POST", cabecalhos: { authorization: `Bearer ${tok.token}` },
  corpo: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "browser__pagina__ler", arguments: { url } } }) }, g, l)).corpo).result.content[0].text);

test("MCP → Chromium real → evidência no retorno, com origem e auditoria", async () => {
  const r = await chamar(`https://${HOST}/peca`);
  assert.equal(r.estado, "CONCLUIDA"); assert.equal(r.origem, "executor_local");
  const saida = JSON.parse(r.evidencia.saida); assert.equal(saida.titulo, "Catálogo fictício"); assert.match(saida.texto, /Peça FIC0001/);
  assert.equal(saida.url, `https://${HOST}/peca`); assert.equal(log.at(-1).resultado, "CONCLUIDA"); assert.equal(log.at(-1).loja_id, "lojaA");
});
test("redirect para rede privada é bloqueado ao longo de toda a cadeia", async () => {
  const r = await chamar(`https://${HOST}/redir`);
  assert.notEqual(r.estado, "CONCLUIDA"); assert.ok(runner.bloqueios.some((b) => b.motivo.startsWith("host_interno:10.0.0.5")));
});
test("fim", () => clearInterval(laco));
