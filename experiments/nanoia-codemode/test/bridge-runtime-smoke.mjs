/**
 * CI: dois processos locais independentes (Worker pai e host de despacho),
 * código em Worker dinâmico, assinaturas HMAC e revogação. Dados 100% fictícios.
 * Não publica na Cloudflare; a segurança hospedada ainda precisa validação própria.
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { writeFileSync, rmSync } from "node:fs";
import { assinarBridge, BRIDGE_PATH } from "../src/bridge-auth.mjs";
const PORT = 8797, HOST_WORKER_PORT = 8798, HOST = "http://127.0.0.1:8799", URL = `http://127.0.0.1:${PORT}/mcp`;
const HOST_CONFIG = "test/host-generated.wrangler.json";
const SERVICE_HOST = "https://nanoia-bridge.internal" + BRIDGE_PATH;
const A = "laboratorio_A_token_sintetico_20261030", B = "laboratorio_B_token_sintetico_20261030";
const sA = randomBytes(48).toString("hex"), sB = randomBytes(48).toString("hex"), control = randomBytes(48).toString("hex");
function iniciar(cmd, args, env) {
  const proc = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, ...env } });
  let saida = "";
  for (const stream of [proc.stdout, proc.stderr])
    stream.on("data", (x) => { saida = (saida + x.toString()).slice(-9000); });
  return { proc, logs: () => saida };
}
const host = iniciar(process.execPath, ["--experimental-strip-types", "test/bridge-host-fixture.mjs"],
  { TEST_HMAC_A: sA, TEST_HMAC_B: sB, TEST_CONTROL: control });
let worker, hostWorker;
const sessao = new Map();
const protocolo = { "content-type": "application/json", accept: "application/json, text/event-stream" };
async function aguardar(path, check, proc) {
  for (let i = 0; i < 60; i++) {
    if (proc.exitCode !== null) throw Error("Processo finalizado antes de iniciar");
    try {
      const r = await fetch(path, { method: "GET", headers: { "x-test-control": control }, signal: AbortSignal.timeout(700) });
      if (check(r)) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 400));
  }
  throw Error("Serviço não iniciou: " + path);
}
async function rpc(token, method, params) {
  const id = Math.floor(Math.random() * 1e6);
  const res = await fetch(URL, {
    method: "POST", headers: { ...protocolo, authorization: "Bearer " + token,
      ...(sessao.has(token) ? { "mcp-session-id": sessao.get(token) } : {}) },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
    signal: AbortSignal.timeout(14000),
  });
  const sid = res.headers.get("mcp-session-id"); if (sid) sessao.set(token, sid);
  const str = await res.text();
  const data = str.trim().startsWith("{") ? JSON.parse(str)
    : JSON.parse(str.split(/\r?\n/).find((v) => v.startsWith("data:"))?.slice(5) ?? "null");
  return { status: res.status, data, text: str };
}
async function executar(token, codigo, esperado = true) {
  const r = await rpc(token, "tools/call", { name: "code", arguments: { code: codigo } });
  assert.equal(r.status, 200, r.text.slice(0,500));
  assert.equal(Boolean(r.data?.result?.isError), !esperado, r.text.slice(0,600));
  return JSON.stringify(r.data?.result);
}
function clean(v) {
  return !/NUNCA|precoCusto|fornecedor|ncm|estoque|secret|token/i.test(v);
}
async function hostPost(corpo, cabecalhos) {
  return fetch(HOST + BRIDGE_PATH, { method: "POST",
    headers: { "content-type": "application/json", ...cabecalhos },
    body: corpo, signal: AbortSignal.timeout(4000),
  });
}
try {
  await aguardar(HOST + "/test/status", (r)=>r.status === 200, host.proc);
  // O Worker host é um serviço PRIVADO, iniciado pelo Wrangler como binding do primário.
  // Grava credenciais de teste aleatórias somente no workspace temporário do CI.
  writeFileSync(HOST_CONFIG, JSON.stringify({
    name: "nanoia-codemode-host-fixture-nao-publicar",
    main: "./bridge-host-worker.ts",
    compatibility_date: "2026-10-30",
    compatibility_flags: ["nodejs_compat"],
    workers_dev: false,
    vars: { TEST_HMAC_A: sA, TEST_HMAC_B: sB },
  }));
  // Multi-config em uma chamada Wrangler 4.156.0 montava o binding como
  // [not connected] no runner CI. Iniciar o host ANTES e em outro processo
  // é o fluxo documentado para descoberta local entre dois Workers.
  hostWorker = iniciar("./node_modules/.bin/wrangler", [
    "dev", "-c", HOST_CONFIG, "--local", "--ip", "127.0.0.1",
    "--port", String(HOST_WORKER_PORT), "--show-interactive-dev-session=false",
  ], { WRANGLER_SEND_METRICS: "false", CI: "true" });
  await aguardar("http://127.0.0.1:" + HOST_WORKER_PORT + "/test/health",
    (r) => r.status === 404 && (r.headers.get("content-type") ?? "").includes("application/json"), hostWorker.proc);
  worker = iniciar("./node_modules/.bin/wrangler", ["dev", "-c", "wrangler.jsonc", "--local", "--ip", "127.0.0.1", "--port", String(PORT),
    "--var", "PILOT_ENABLED:true",
    "--var", `PILOT_TOKEN_A:${A}`, "--var", `PILOT_TOKEN_B:${B}`,
    "--var", "PILOT_BRIDGE_ENABLED:true",
    "--var", `PILOT_HOST_URL:${SERVICE_HOST}`,
    "--var", "PILOT_BRIDGE_TRANSPORT:service",
    "--var", "PILOT_HOST_KEY_A:hml-a", "--var", "PILOT_HOST_KEY_B:hml-b",
    "--var", `PILOT_HOST_SECRET_A:${sA}`, "--var", `PILOT_HOST_SECRET_B:${sB}`,
    "--var", "PILOT_ALLOW_LOCAL_HOST:false",
    "--show-interactive-dev-session=false"], { WRANGLER_SEND_METRICS: "false", CI: "true" });
  // Readiness: 401 significa o Worker está ativo mas não aceita sem credenciais.
  for (let i=0;i<60;i++) {
    if (worker.proc.exitCode !== null) throw Error("Worker falhou: "+worker.logs().slice(-1800));
    try {
      const r=await rpc("token_invalido_12345678901234567890","ping");
      if(r.status===401)break;
    } catch {}
    if(i===59) throw Error("Worker não iniciou: "+worker.logs().slice(-2000));
    await new Promise(r=>setTimeout(r,400));
  }
  for (const token of [A,B]) {
    const i = await rpc(token,"initialize",{ protocolVersion:"2025-06-18",capabilities:{},clientInfo:{name:"hml-test",version:"1"} });
    assert.equal(i.status,200,i.text.slice(0,400));
    assert.ok(i.data.result?.serverInfo);
    const t = await rpc(token,"tools/list",{});
    assert.deepEqual(t.data.result.tools.map(x=>x.name), ["code"], "somente code, sem funções brutas");
  }
  const a = await executar(A,"async () => { return await codemode.catalogo_resumo({}); }");
  const b = await executar(B,"async () => { return await codemode.catalogo_resumo({}); }");
  assert.match(a,/produtos.{0,12}2/,a.slice(0,400));
  assert.match(b,/produtos.{0,12}1/,b.slice(0,400));
  assert.ok(clean(a) && clean(b),"resposta revelou campo confidencial");
  const busca = await executar(A,"async () => { return await codemode.catalogo_listar({limite:10}); }");
  assert.match(busca,/FIX-HML-A-01/);
  assert.ok(!busca.includes("FIX-HML-B-01"),"vazamento entre lojas");
  assert.ok(clean(busca),"lista revelou campo confidencial");
  // O parser pode eliminar parâmetros desconhecidos; o critério é NÃO vazar a outra loja.
  const spoof = await executar(B, "async () => { return await codemode.catalogo_listar({loja_id:'aaaaaaaa-0000-0000-0000-000000000001'}); }");
  assert.ok(!spoof.includes("FIX-HML-A-01"),"troca de tenant via argumento");
  const egress = await executar(A, "async () => { try { await fetch('http://127.0.0.1:8799/test/status'); return { bloqueado:false }; } catch { return { bloqueado:true }; } }");
  assert.match(egress,/bloqueado.{0,12}true/,egress.slice(0,500));
  // Testes diretos host: sem assinatura, adulteração, repetição e timestamp expirado.
  const corpo = JSON.stringify({ operacao:"catalogo_resumo",args:{} });
  assert.equal((await hostPost(corpo,{})).status,401);
  const sig = await assinarBridge({keyId:"hml-a",secret:sA,corpo});
  assert.equal((await hostPost(JSON.stringify({operacao:"catalogo_listar",args:{}}),sig)).status,401,"payload adulterado");
  assert.equal((await hostPost(corpo,sig)).status,200,"primeira requisição válida");
  assert.equal((await hostPost(corpo,sig)).status,401,"replay deve ser recusado");
  const passado = await assinarBridge({keyId:"hml-a",secret:sA,corpo,agora:Date.now()-60000});
  assert.equal((await hostPost(corpo,passado)).status,401,"timestamp antigo deve ser recusado");
  const status = await fetch(HOST+"/test/status",{headers:{"x-test-control":control}});
  const metric = await status.json();
  assert.ok(metric.auditorias >= 1, "despacho real deve auditar consulta no host HTTP");
  // A revogação precisa bloquear a próxima chamada, sem cachear permissão.
  const rev = await fetch(HOST+"/test/revogar",{method:"POST",headers:{"x-test-control":control,"x-test-key":"hml-a"}});
  assert.equal(rev.status,200);
  const afterNode = await assinarBridge({keyId:"hml-a",secret:sA,corpo});
  assert.equal((await hostPost(corpo,afterNode)).status,401,"host Node revogado deve recusar");
  // O host Service Binding já revogou A automaticamente após duas consultas.
  await executar(A,"async () => { return await codemode.catalogo_resumo({}); }",false);
  const b2 = await executar(B,"async () => { return await codemode.catalogo_resumo({}); }");
  assert.match(b2,/produtos.{0,12}1/, "revogação de A não pode derrubar B");
  console.log("PASS: Worker separado do host, HMAC, timestamp, replay, revogação A, B isolada, auditoria e egress.");
} catch (err) {
  console.error("FALHA: canal HMAC de homologação:",String(err));
  console.error("HOST (sem credenciais):",host.logs().slice(-1200));
  if(hostWorker) console.error("WORKER HOST (sem chaves):",hostWorker.logs().replaceAll(sA,"[redigido]").replaceAll(sB,"[redigido]").slice(-1500));
  if(worker) {
    // Diagnóstico NÃO sensível: nomes de bindings, estado de conexão e classe do erro.
    // Saída completa não é publicada, pois o Wrangler pode exibir vars locais.
    const redigido = worker.logs().replaceAll(sA, "[redigido]").replaceAll(sB, "[redigido]");
    const linhas = redigido.split(/\r?\n/);
    console.error("WORKER (trecho):",redigido.slice(-1900));
    console.error("DIAGNOSTICO_BINDING:", linhas.filter(x => /PILOT_HOST_SERVICE|bridge_host_transport_failed|\[connected\]|\[not connected\]|Service bindings|No routes|Error:|Error\s*\[/.test(x)).slice(-16).join("\n"));
  }
  process.exitCode = 1;
} finally {
  for (const p of [worker?.proc,hostWorker?.proc,host.proc]) if (p) p.kill("SIGTERM");
  try { rmSync(HOST_CONFIG, { force: true }); } catch { /* fixture efêmera */ }
}
