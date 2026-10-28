import { test } from "node:test";
import assert from "node:assert/strict";
import { tratarMcpComLocal, type PortasLocais } from "./gateway_local.ts";
import { FilaLocal } from "./fila.ts";
import { gerarToken, sha256Hex } from "../conector/cripto.ts";
import type { ChaveMcp, PortasGateway } from "../conector/gateway.ts";
import type { Portas } from "./executor.ts";

async function cenario(o: { revogada?: boolean; escopos?: ChaveMcp["escopos"]; semDisp?: boolean; auditaFalha?: boolean; esperaMs?: number } = {}) {
  const A = gerarToken(), B = gerarToken(); const hA = await sha256Hex(A.token), hB = await sha256Hex(B.token);
  const chaves: Record<string, ChaveMcp> = {
    [hA]: { chave_id: "kA", loja_id: "lojaA", escopos: o.escopos ?? ["leitura"], criada_por: "dono", nome: "gemini" },
    [hB]: { chave_id: "kB", loja_id: "lojaB", escopos: ["leitura"], criada_por: "dono", nome: "claude" } };
  const log: string[] = []; let revogada = !!o.revogada;
  const portas: Portas = { agora: Date.now, revogada: async () => revogada, pausada: async () => false, consentimento: async () => null,
    auditar: async (e) => { if (o.auditaFalha) throw new Error("x"); log.push(`${e.loja_id}:${e.agente}:${e.capacidade}:${e.resultado}`); },
    runner: { executar: async () => ({ saida: '{"os":"fake"}' }) } };
  const fila = new FilaLocal(portas); let n = 0;
  const g: PortasGateway = { validarChave: async (h) => chaves[h] ?? null, limite: async () => true, contexto: () => ({}) as never };
  const l: PortasLocais = { fila, esperaMs: o.esperaMs ?? 500, novoId: () => `t${++n}`,
    dispositivo: (c) => (o.semDisp ? null : { dispositivo_id: `disp-${c.loja_id}`, hosts_permitidos: ["teste.exemplo.com"] }) };
  const chamar = (token: string, method: string, params: unknown = {}) => tratarMcpComLocal({ metodo: "POST", cabecalhos: { authorization: `Bearer ${token}` }, corpo: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) }, g, l);
  // Executor do dispositivo (laço separado, como no mundo real: puxa, executa, devolve)
  const laco = (loja: string) => setInterval(() => { void fila.puxarEExecutar(loja, `disp-${loja}`); }, 5);
  return { A: A.token, B: B.token, chamar, laco, log, revogar: () => { revogada = true; }, fila };
}
const corpo = (r: { corpo: string }) => JSON.parse(r.corpo);
const txt = (r: { corpo: string }) => JSON.parse(corpo(r).result.content[0].text);

test("tools/list: sessão com escopo vê as capacidades locais; sem dispositivo pareado, não vê", async () => {
  const c = await cenario(); const nomes = corpo(await c.chamar(c.A, "tools/list")).result.tools.map((t: { title: string }) => t.title);
  assert.ok(nomes.includes("windows.sistema.inventario") && nomes.includes("conecta.catalogo.resumo"));   // locais + as do gateway
  const s = await cenario({ semDisp: true }); const n2 = corpo(await s.chamar(s.A, "tools/list")).result.tools.map((t: { title: string }) => t.title);
  assert.ok(!n2.includes("windows.sistema.inventario") && n2.includes("conecta.catalogo.resumo"));
});
test("cadeia ponta a ponta: chamada MCP → fila → executor do dispositivo → evidência devolvida com origem e auditoria", async () => {
  const c = await cenario(); const t = c.laco("lojaA");
  const r = txt(await c.chamar(c.A, "tools/call", { name: "windows__sistema__inventario", arguments: {} })); clearInterval(t);
  assert.equal(r.estado, "CONCLUIDA"); assert.equal(r.origem, "executor_local"); assert.equal(r.dispositivo_id, "disp-lojaA"); assert.equal(r.evidencia.sha256.length, 64);
  assert.deepEqual(c.log, ["lojaA:gemini:windows.sistema.inventario:CONCLUIDA"]);
});
test("isolamento por loja: executor da loja B não puxa a tarefa da loja A", async () => {
  const c = await cenario({ esperaMs: 120 }); const t = c.laco("lojaB");
  const r = txt(await c.chamar(c.A, "tools/call", { name: "windows__sistema__inventario", arguments: {} })); clearInterval(t);
  assert.match(r.erro, /executor_nao_respondeu/); assert.equal(r.estado, "NA_FILA"); assert.deepEqual(c.log, []);
});
test("sem executor ligado: não finge sucesso (estado não confirmado, na fila)", async () => {
  const c = await cenario({ esperaMs: 80 }); const r = txt(await c.chamar(c.A, "tools/call", { name: "windows__sistema__inventario", arguments: {} }));
  assert.match(r.erro, /estado não confirmado/);
});
test("chave revogada/ausente: 401 também para ferramenta local", async () => {
  const c = await cenario(); const x = gerarToken().token;
  assert.equal((await c.chamar(x, "tools/call", { name: "windows__sistema__inventario", arguments: {} })).status, 401);
});
test("sessão do dispositivo revogada: tarefa negada e auditada", async () => {
  const c = await cenario(); c.revogar(); const t = c.laco("lojaA");
  const r = txt(await c.chamar(c.A, "tools/call", { name: "windows__sistema__inventario", arguments: {} })); clearInterval(t);
  assert.equal(r.estado, "NEGADA"); assert.equal(r.motivo, "sessao_revogada");
});
test("injeção e host proibido são negados; escopo de proposta não consulta", async () => {
  const c = await cenario(); const t = c.laco("lojaA");
  const a = txt(await c.chamar(c.A, "tools/call", { name: "windows__processo__existe", arguments: { nome: "x; calc" } }));
  const b = txt(await c.chamar(c.A, "tools/call", { name: "browser__pagina__ler", arguments: { url: "https://intranet.exemplo.com/x" } })); clearInterval(t);
  assert.equal(a.estado, "NEGADA"); assert.equal(b.estado, "NEGADA"); assert.match(b.motivo, /host_fora_da_lista/);
  const p = await cenario({ escopos: ["propor"] }); const t2 = p.laco("lojaA");
  const d = txt(await p.chamar(p.A, "tools/call", { name: "windows__sistema__inventario", arguments: {} })); clearInterval(t2);
  assert.equal(d.estado, "NEGADA"); assert.match(d.motivo, /escopo_insuficiente/);
});
test("auditoria falha: nada é devolvido como sucesso", async () => {
  const c = await cenario({ auditaFalha: true }); const t = c.laco("lojaA");
  const r = txt(await c.chamar(c.A, "tools/call", { name: "windows__sistema__inventario", arguments: {} })); clearInterval(t);
  assert.equal(r.estado, "FALHOU"); assert.match(r.motivo, /auditoria_indisponivel/);
});
test("método não local é delegado ao gateway (ping)", async () => {
  const c = await cenario(); assert.deepEqual(corpo(await c.chamar(c.A, "ping")).result, {});
});
