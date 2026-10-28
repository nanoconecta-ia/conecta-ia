import { test } from "node:test";
import assert from "node:assert/strict";
import { executar } from "../../supabase/functions/_shared/exec_local/executor.ts";
import { destinoPermitido, hostInterno } from "./guarda_rede.mjs";
import { criarRunnerBrowser } from "./runner_browser.mjs";

const HOST = "teste.exemplo.com";
const PAGINA = `<!doctype html><title>Página fictícia</title><body><h1>Peça de teste</h1><p>SKU FIC0001 — dado fictício</p><script>document.body.append(" renderizado-por-js")</script></body>`;
const rede = async (url) => {
  const u = new URL(url);
  if (u.pathname === "/redir") return { status: 302, headers: { location: "https://169.254.169.254/latest/meta-data" } };
  if (u.pathname === "/pendura") return new Promise(() => {});
  return { status: 200, headers: { "content-type": "text/html; charset=utf-8" }, body: PAGINA };
};
const S = { sessao_id: "s1", loja_id: "l1", dispositivo_id: "d1", agente: "qualquer", escopos: ["consulta"], hosts_permitidos: [HOST] };
const T = (path) => ({ tarefa_id: "t" + path, capacidade: "browser.pagina.ler", params: { url: `https://${HOST}${path}` } });
const mkPortas = (runner, over = {}) => { const log = []; return { log, agora: () => Date.now(), revogada: async () => false, pausada: async () => false, consentimento: async () => null,
  auditar: async (e) => { log.push(e); }, runner, ...over }; };
const executablePath = process.env.CHROMIUM_PATH || undefined;

test("guarda de rede: bloqueia internos, ofuscados, http, credencial e host fora da lista", () => {
  for (const h of ["localhost", "127.0.0.1", "10.1.2.3", "192.168.0.5", "172.20.0.1", "169.254.169.254", "2130706433", "0x7f.1", "[::1]", "fd00::1", "srv.internal", "a.local"]) assert.ok(hostInterno(h.replace(/^\[|\]$/g, "")) || /0x/.test(h), h);
  assert.equal(destinoPermitido("http://teste.exemplo.com/", [HOST]).ok, false);
  assert.equal(destinoPermitido("https://u:p@teste.exemplo.com/", [HOST]).ok, false);
  assert.equal(destinoPermitido("https://outro.com/", [HOST]).ok, false);
  assert.equal(destinoPermitido("https://teste.exemplo.com/x", [HOST]).ok, true);
});

test("Chromium REAL lê o DOM (inclusive JS) e devolve evidência com origem, hora, hash e auditoria", async () => {
  const runner = criarRunnerBrowser({ hostsPermitidos: [HOST], rede, executablePath }); const p = mkPortas(runner);
  const v = await executar(S, T("/peca"), p);
  assert.equal(v.estado, "CONCLUIDA", JSON.stringify(v));
  const out = JSON.parse(v.evidencia.saida);
  assert.equal(out.titulo, "Página fictícia"); assert.match(out.texto, /Peça de teste.*SKU FIC0001.*renderizado-por-js/);
  assert.equal(out.url, `https://${HOST}/peca`); assert.equal(out.cookiesAntes, 0); assert.equal(out.origem, "browser.chromium.isolado");
  assert.equal(v.evidencia.sha256.length, 64); assert.ok(v.evidencia.em > 0);
  assert.equal(p.log.at(-1).resultado, "CONCLUIDA");
});

test("redirecionamento para endereço interno (metadata de nuvem) é bloqueado no Chromium e registrado", async () => {
  const runner = criarRunnerBrowser({ hostsPermitidos: [HOST], rede, executablePath }); const p = mkPortas(runner);
  const v = await executar(S, T("/redir"), p);
  assert.notEqual(v.estado, "CONCLUIDA");
  assert.ok(runner.bloqueios.some((b) => b.motivo.startsWith("host_interno:169.254.169.254")), JSON.stringify(runner.bloqueios));
});

test("domínio fora da lista nem chega ao navegador (negado no despachante)", async () => {
  const runner = criarRunnerBrowser({ hostsPermitidos: [HOST], rede, executablePath }); const p = mkPortas(runner);
  const v = await executar(S, { tarefa_id: "x", capacidade: "browser.pagina.ler", params: { url: "https://intranet.exemplo.com/x" } }, p);
  assert.equal(v.estado, "NEGADA"); assert.equal(runner.bloqueios.length, 0);
});

test("revogação no meio da execução: abort fecha o Chromium e a tarefa não conclui", async () => {
  const runner = criarRunnerBrowser({ hostsPermitidos: [HOST], rede, executablePath }); const ctl = new AbortController();
  const r = runner.executar("browser", `ler https://${HOST}/pendura`, 20000, ctl.signal);
  setTimeout(() => ctl.abort(), 1500);
  await assert.rejects(r);
});

test("sessão revogada antes de começar: negada, sem abrir navegador", async () => {
  const runner = criarRunnerBrowser({ hostsPermitidos: [HOST], rede, executablePath }); const p = mkPortas(runner, { revogada: async () => true });
  assert.equal((await executar(S, T("/peca"), p)).estado, "NEGADA"); assert.equal(runner.bloqueios.length, 0);
});
