/**
 * Smoke test de protocolo + execução real em wrangler dev --local.
 * Usa exclusivamente fixtures e tokens artificiais, nunca Bling/Supabase.
 * CUIDADO: Miniflare NÃO é sandbox endurecida; executar só códigos constantes abaixo.
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const PORT = 8798;
const BASE = `http://127.0.0.1:${PORT}/mcp`;
const A = "laboratorio_A_token_sintetico_20261030";
const B = "laboratorio_B_token_sintetico_20261030";
const cli = "./node_modules/.bin/wrangler";
const proc = spawn(cli, ["dev", "--local", "--ip", "127.0.0.1", "--port", String(PORT),
  "--var", "PILOT_ENABLED:true",
  "--var", `PILOT_TOKEN_A:${A}`, "--var", `PILOT_TOKEN_B:${B}`,
  "--show-interactive-dev-session=false"], { stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, WRANGLER_SEND_METRICS: "false", CI: "true" } });
let logs = "";
for (const stream of [proc.stdout, proc.stderr]) stream.on("data", (x) => { logs = (logs + x.toString()).slice(-12000); });
const sessao = new Map();
function headers(token, extras = {}) {
  return { authorization: `Bearer ${token}`, accept: "application/json, text/event-stream",
    "content-type": "application/json", ...extras };
}
async function rpc(token, method, params, extras = {}) {
  const id = Math.floor(Math.random() * 100_000) + 1;
  const h = headers(token, { ...extras, ...(sessao.has(token) ? { "mcp-session-id": sessao.get(token) } : {}) });
  const res = await fetch(BASE, { method: "POST", headers: h,
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }), signal: AbortSignal.timeout(16000) });
  const sid = res.headers.get("mcp-session-id");
  if (sid) sessao.set(token, sid);
  const txt = await res.text();
  let dados;
  try {
    if (txt.trimStart().startsWith("{")) dados = JSON.parse(txt);
    else {
      const line = txt.split(/\r?\n/).find((x) => x.startsWith("data:"));
      if (line) dados = JSON.parse(line.slice(5).trim());
    }
  } catch (e) { throw Error(`RPC ${method}: JSON inválido, HTTP ${res.status}: ${txt.slice(0,500)} (${e})`); }
  return { status: res.status, resposta: dados, texto: txt };
}
async function pronto() {
  for (let i = 0; i < 60; i++) {
    if (proc.exitCode !== null) throw Error(`Wrangler encerrou antes de iniciar: ${logs}`);
    try {
      const r = await fetch(BASE, { method: "POST", headers: headers("invalido"),
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping" }), signal: AbortSignal.timeout(700) });
      if (r.status === 401) return;
    } catch { /* warm-up */ }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw Error(`Wrangler não iniciou em 30s. Saída:\n${logs}`);
}
async function inicializar(token) {
  const r = await rpc(token, "initialize", { protocolVersion: "2025-06-18", capabilities: {},
    clientInfo: { name: "nanoia-ci-sintetico", version: "0.1" } });
  assert.equal(r.status, 200, `initialize: ${r.texto.slice(0,400)}`);
  assert.ok(r.resposta?.result?.serverInfo, `initialize sem serverInfo: ${r.texto.slice(0,400)}`);
  const t = await rpc(token, "tools/list", {});
  assert.equal(t.status, 200, `tools/list: ${t.texto.slice(0,400)}`);
  const ts = t.resposta?.result?.tools;
  assert.ok(Array.isArray(ts), `sem tools: ${t.texto.slice(0,400)}`);
  assert.deepEqual(ts.map((x) => x.name), ["code"], "Code Mode deve expor somente a ferramenta code");
}
async function codigo(token, code) {
  const r = await rpc(token, "tools/call", { name: "code", arguments: { code } });
  assert.equal(r.status, 200, `code: ${r.texto.slice(0,500)}`);
  assert.ok(r.resposta?.result && !r.resposta.result.isError, `code falhou: ${r.texto.slice(0,1200)}`);
  return JSON.stringify(r.resposta.result);
}
try {
  await pronto();
  console.log("WRANGLER_LOCAL: iniciado (somente dados artificiais)");
  const invalid = await rpc("token_desconhecido_123456789012345", "ping");
  assert.equal(invalid.status, 401, "token não autorizado deve falhar");
  const browser = await rpc(A, "ping", undefined, { origin: "https://exemplo.invalid" });
  assert.equal(browser.status, 403, "origem de browser deve falhar");
  await inicializar(A);
  await inicializar(B);
  const a = await codigo(A, "async () => { return await codemode.catalogo_resumo({}); };");
  const b = await codigo(B, "async () => { return await codemode.catalogo_resumo({}); };");
  assert.match(a, /"produtos"\\?:?\s*3|produtos.{0,10}3/, `tenant A difere: ${a.slice(0,600)}`);
  assert.match(b, /"produtos"\\?:?\s*1|produtos.{0,10}1/, `tenant B difere: ${b.slice(0,600)}`);
  const cross = await codigo(B, "async () => { return await codemode.catalogo_listar({ busca: 'TEST-A', limite: 10 }); };");
  assert.match(cross, /\[\]|itens.{0,8}\[\]/, `loja B vazou itens da A: ${cross.slice(0,600)}`);
  const egress = await codigo(A, "async () => { try { const r = await fetch('https://example.invalid'); return { egress_bloqueado: false, http: r.status }; } catch(e) { return { egress_bloqueado: true, erro: String(e).slice(0,100) }; } };");
  assert.match(egress, /egress_bloqueado.{0,12}true/, `fetch não foi bloqueado: ${egress.slice(0,600)}`);
  console.log("PASS: auth, origin, initialize, tools/list, code A/B, isolamento e egress (Miniflare).");
} catch (e) {
  console.error("FALHA - MCP runtime sintético:", String(e), "\nLogs Wrangler:\n", logs);
  process.exitCode = 1;
} finally {
  proc.kill("SIGTERM");
  const timer = setTimeout(() => proc.kill("SIGKILL"), 1800);
  timer.unref();
}
