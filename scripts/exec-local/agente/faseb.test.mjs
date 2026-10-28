// Fase B (código) ponta a ponta com o AGENTE REAL e banco SIMULADO EM MEMÓRIA (a semântica SQL é provada em supabase/tests/exec_local_fila.sql):
// MCP → gateway_local (executarInline) → despachante → runner_db → fila → rotas do dispositivo (tratarDispositivo) → agente → PowerShell falso → resultado.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { tratarMcpComLocal } from "../../../supabase/functions/_shared/exec_local/gateway_local.ts";
import { executar } from "../../../supabase/functions/_shared/exec_local/executor.ts";
import { criarRunnerDb } from "../../../supabase/functions/_shared/exec_local/runner_db.ts";
import { tratarDispositivo } from "../../../supabase/functions/_shared/exec_local/rotas_dispositivo.ts";
import { sha256Hex, gerarToken } from "../../../supabase/functions/_shared/conector/cripto.ts";
import { rodarAgente } from "./agente.mjs";

const fake = new URL("../pwsh_falso.mjs", import.meta.url).pathname;
const caps = JSON.parse(readFileSync(new URL("./capacidades.windows.json", import.meta.url), "utf8")).capacidades;
const PRE = ["powershell.exe", "-NoProfile", "-NonInteractive", "-NoLogo", "-Command"];

async function montar() {
  const tokenPair = "tok" + "A".repeat(45) + ".sal" + "B".repeat(45);            // formato <token>.<sal> do Pair
  const [t, s] = tokenPair.split("."); const hT = await sha256Hex(t), hS = await sha256Hex(s);
  const dev = { id: "dev-A", loja_id: "lojaA", revogado: false };
  const tarefas = new Map(); const audit = [];
  const sessaoOk = (a) => a.p_token_hash === hT && a.p_sal_hash === hS && !dev.revogado;
  const db = {
    async enfileirar(a) { if (a.dispositivo_id !== dev.id || a.loja_id !== dev.loja_id) throw new Error("dispositivo inválido"); const id = randomUUID(); tarefas.set(id, { id, ...a, estado: "NA_FILA" }); audit.push("enfileirada"); return id; },
    async estado(loja, id) { const x = tarefas.get(id); if (!x || x.loja_id !== loja) return null; if (dev.revogado && x.estado === "NA_FILA") x.estado = "CANCELADA"; return x; },
    async cancelar(loja, id) { const x = tarefas.get(id); if (x?.estado === "NA_FILA") { x.estado = "CANCELADA"; return true; } return false; },
  };
  const rpc = async (fn, a) => {
    if (!sessaoOk(a)) return null;
    if (fn === "exec_local_puxar") { const x = [...tarefas.values()].find((y) => y.estado === "NA_FILA"); if (!x) return {}; x.estado = "EM_EXECUCAO"; return { job_id: x.id, capacidade: x.capacidade, argv: x.argv, timeout_ms: x.timeout_ms }; }
    const x = tarefas.get(a.p_tarefa); if (!x || x.estado !== "EM_EXECUCAO") return "ignorado";
    x.estado = a.p_ok ? "CONCLUIDA" : "FALHOU"; x.saida = a.p_saida; x.erro = a.p_erro; audit.push(x.estado.toLowerCase()); return x.estado;
  };
  const chave = gerarToken(); const hChave = await sha256Hex(chave.token);
  const portasAud = []; 
  const portas = (cap) => ({ agora: Date.now, revogada: async () => false, pausada: async () => false, consentimento: async () => null,
    auditar: async (e) => { portasAud.push(`${e.capacidade}:${e.resultado}`); }, runner: criarRunnerDb(db, { loja_id: "lojaA", dispositivo_id: dev.id, capacidade: cap, intervaloMs: 20 }) });
  const g = { validarChave: async (h) => (h === hChave ? { chave_id: "k", loja_id: "lojaA", escopos: ["leitura"], criada_por: "dono", nome: "gemini" } : null), limite: async () => true, contexto: () => ({}) };
  const l = { esperaMs: 15000, novoId: () => randomUUID(), fila: null, dispositivo: () => (dev.revogado ? null : { dispositivo_id: dev.id, hosts_permitidos: [] }),
    executarInline: (sessao, tarefa) => executar(sessao, tarefa, portas(tarefa.capacidade)) };
  const server = createServer(async (req, res) => {
    let b = ""; for await (const c of req) b += c;
    if (req.url === "/mcp") { const r = await tratarMcpComLocal({ metodo: req.method, cabecalhos: { authorization: req.headers.authorization }, corpo: b }, g, l); res.writeHead(r.status, r.cabecalhos); return res.end(r.corpo); }
    const r = await tratarDispositivo({ metodo: req.method, caminho: req.url, authorization: req.headers.authorization ?? null, corpo: b }, { rpc });
    res.writeHead(r.status, { "content-type": "application/json" }); res.end(r.corpo === undefined ? "" : JSON.stringify(r.corpo));
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const url = `http://127.0.0.1:${server.address().port}`;
  const logAgente = []; let parar = false;
  const agente = rodarAgente({ gateway: url, token: tokenPair, binario: process.execPath, argsAntes: [fake], capacidades: caps, log: (e) => logAgente.push(e), parar: () => parar, intervaloMs: 20 });
  const mcp = async (method, params) => (await (await fetch(url + "/mcp", { method: "POST", headers: { authorization: `Bearer ${chave.token}` }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) })).json()).result;
  const chamar = async (nome, args = {}) => JSON.parse((await mcp("tools/call", { name: nome, arguments: args })).content[0].text);
  return { url, dev, tarefas, audit, portasAud, logAgente, agente, mcp, chamar, tokenPair, encerrar: async () => { parar = true; await agente; server.close(); } };
}

test("Fase B (código): MCP → fila → agente real → PowerShell falso → evidência, com auditoria", async () => {
  const c = await montar();
  const r = await c.chamar("windows__ambiente__versoes");
  assert.equal(r.estado, "CONCLUIDA"); assert.match(r.evidencia.saida, /PowerShell/); assert.equal(r.evidencia.sha256.length, 64); assert.equal(r.dispositivo_id, "dev-A");
  assert.deepEqual(c.portasAud, ["windows.ambiente.versoes:CONCLUIDA"]); assert.deepEqual(c.audit, ["enfileirada", "concluida"]);
  assert.ok(!JSON.stringify(c.logAgente).includes(c.tokenPair)); await c.encerrar();
});
test("comando fora da lista no banco: o agente recusa e a tarefa FALHA", async () => {
  const c = await montar(); const id = randomUUID();
  c.tarefas.set(id, { id, loja_id: "lojaA", dispositivo_id: "dev-A", capacidade: "windows.sistema.inventario", argv: [...PRE, "Get-ChildItem C:\\ -Recurse"], timeout_ms: 5000, estado: "NA_FILA" });
  for (let i = 0; i < 100 && c.tarefas.get(id).estado !== "FALHOU"; i++) await new Promise((r) => setTimeout(r, 20));
  assert.equal(c.tarefas.get(id).estado, "FALHOU"); assert.equal(c.tarefas.get(id).erro, "comando_nao_autorizado_no_agente"); await c.encerrar();
});
test("revogação do dispositivo: agente encerra por 401 e as ferramentas locais somem", async () => {
  const c = await montar(); await c.chamar("windows__sistema__inventario"); c.dev.revogado = true;
  assert.equal((await c.agente).motivo, "revogado");
  assert.ok(!(await c.mcp("tools/list", {})).tools.some((t) => t.title.startsWith("windows.")));
  assert.equal((await fetch(c.url + "/dispositivo/proximo", { method: "POST", headers: { authorization: `Bearer ${c.tokenPair}` }, body: "{}" })).status, 401); await c.encerrar();
});
test("rotas do dispositivo: sem token, token malformado, GET e caminho desconhecido são recusados", async () => {
  const c = await montar();
  assert.equal((await fetch(c.url + "/dispositivo/proximo", { method: "POST", body: "{}" })).status, 401);
  assert.equal((await fetch(c.url + "/dispositivo/proximo", { method: "POST", headers: { authorization: "Bearer abc" }, body: "{}" })).status, 401);
  assert.equal((await fetch(c.url + "/dispositivo/proximo", { headers: { authorization: `Bearer ${c.tokenPair}` } })).status, 405);
  assert.equal((await fetch(c.url + "/dispositivo/x", { method: "POST", headers: { authorization: `Bearer ${c.tokenPair}` }, body: "{}" })).status, 404);
  assert.equal((await fetch(c.url + "/dispositivo/resultado", { method: "POST", headers: { authorization: `Bearer ${c.tokenPair}` }, body: JSON.stringify({ job_id: "x", ok: true }) })).status, 400); await c.encerrar();
});
