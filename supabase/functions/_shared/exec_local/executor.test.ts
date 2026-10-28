import { test } from "node:test";
import assert from "node:assert/strict";
import { executar, hashTarefa, type Portas, type SessaoLocal, type Tarefa } from "./executor.ts";
import { argvPowerShell, buscarCapacidade, CAPACIDADES_LOCAIS, renderizar } from "./capacidades.ts";

const S: SessaoLocal = { sessao_id: "s1", loja_id: "l1", dispositivo_id: "d1", agente: "qualquer-llm", escopos: ["consulta"], hosts_permitidos: ["teste.exemplo.com"] };
function portas(o: Partial<Portas> & { chamadas?: unknown[] } = {}): Portas & { log: string[]; chamadas: unknown[] } {
  const log: string[] = []; const chamadas: unknown[] = o.chamadas ?? [];
  return { log, chamadas, agora: () => 1000, revogada: async () => false, pausada: async () => false, consentimento: async () => null,
    auditar: async (e) => { log.push(`${e.capacidade}:${e.resultado}`); },
    runner: { executar: async (ex, a) => { chamadas.push([ex, a]); return { saida: '{"ok":true}' }; } }, ...o } as never;
}
const T = (capacidade: string, params: Record<string, unknown> = {}): Tarefa => ({ tarefa_id: "t1", capacidade, params });

test("consulta permitida roda no runner mock, com evidência (hash+carimbo) e auditoria", async () => {
  const p = portas(); const v = await executar(S, T("windows.sistema.inventario"), p);
  assert.equal(v.estado, "CONCLUIDA"); if (v.estado === "CONCLUIDA") { assert.equal(v.evidencia.sha256.length, 64); assert.equal(v.evidencia.em, 1000); }
  assert.deepEqual(p.log, ["windows.sistema.inventario:CONCLUIDA"]);
});
test("PowerShell: argv fixo, sem perfil, comando como único argumento", async () => {
  const p = portas(); await executar(S, T("windows.disco.livre", { unidade: "C" }), p);
  const [, argv] = p.chamadas[0] as [string, string[]];
  assert.deepEqual(argv.slice(0, 5), ["powershell.exe", "-NoProfile", "-NonInteractive", "-NoLogo", "-Command"]); assert.equal(argv.length, 6);
  assert.match(argv[5], /Get-PSDrive -Name C /);
});
test("injeção em parâmetro é rejeitada antes do runner", async () => {
  for (const nome of ["x; Remove-Item C:\\ -Recurse", "$(calc)", "a b", "`whoami`", "x|y"]) {
    const p = portas(); const v = await executar(S, T("windows.processo.existe", { nome }), p);
    assert.equal(v.estado, "NEGADA"); assert.equal(p.chamadas.length, 0);
  }
});
test("parâmetro extra, ausente ou não-string é negado", async () => {
  assert.equal((await executar(S, T("windows.processo.existe", { nome: "a", extra: "b" }), portas())).estado, "NEGADA");
  assert.equal((await executar(S, T("windows.processo.existe", {}), portas())).estado, "NEGADA");
  assert.equal((await executar(S, T("windows.processo.existe", { nome: 5 }), portas())).estado, "NEGADA");
});
test("capacidade desconhecida, desligada e escrita são negadas", async () => {
  for (const id of ["windows.qualquer.coisa", "windows.servico.reiniciar"]) { const p = portas(); assert.equal((await executar(S, T(id, { nome: "x" }), p)).estado, "NEGADA"); assert.equal(p.chamadas.length, 0); }
});
test("sessão revogada e loja pausada barram tudo", async () => {
  assert.deepEqual((await executar(S, T("windows.sistema.inventario"), portas({ revogada: async () => true }))), { estado: "NEGADA", motivo: "sessao_revogada" });
  assert.deepEqual((await executar(S, T("windows.sistema.inventario"), portas({ pausada: async () => true }))), { estado: "NEGADA", motivo: "loja_pausada" });
});
test("escopo insuficiente: sessão sem 'consulta' não executa", async () => {
  assert.equal((await executar({ ...S, escopos: [] }, T("windows.sistema.inventario"), portas())).estado, "NEGADA");
});
test("browser: host fora da lista negado; dentro da lista ok", async () => {
  assert.equal((await executar(S, T("browser.pagina.ler", { url: "https://outro.com/x" }), portas())).estado, "NEGADA");
  assert.equal((await executar(S, T("browser.pagina.ler", { url: "https://teste.exemplo.com/x" }), portas())).estado, "CONCLUIDA");
  assert.equal((await executar(S, T("browser.pagina.ler", { url: "http://teste.exemplo.com/x" }), portas())).estado, "NEGADA");
});
test("aprovação por operação: sem, expirado, de outra tarefa e válido", async () => {
  const t = T("browser.elemento.clicar", { url: "https://teste.exemplo.com/p", alvo: "Salvar" });
  assert.equal((await executar(S, t, portas())).estado, "REQUER_APROVACAO");
  const h = await hashTarefa(t);
  assert.equal((await executar(S, t, portas({ consentimento: async () => ({ tarefa_hash: h, aprovado_por: "dono", expira_em: 999 }) }))).estado, "REQUER_APROVACAO");
  assert.equal((await executar(S, t, portas({ consentimento: async () => ({ tarefa_hash: "x".repeat(64), aprovado_por: "dono", expira_em: 5000 }) }))).estado, "NEGADA");
  const p = portas({ consentimento: async () => ({ tarefa_hash: h, aprovado_por: "dono", expira_em: 5000 }) });
  assert.equal((await executar(S, t, p)).estado, "CONCLUIDA");
});
test("timeout vira DESCONHECIDO (não repetir às cegas) e aborta o runner", async () => {
  let abortou = false;
  const p = portas({ runner: { executar: (_e, _a, _t, sinal) => new Promise((_, rej) => { sinal.addEventListener("abort", () => { abortou = true; rej(new Error("abortado")); }); }) } });
  const orig = buscarCapacidade("windows.sistema.inventario")!; const antes = orig.timeoutMs; (orig as { timeoutMs: number }).timeoutMs = 20;
  try { const v = await executar(S, T("windows.sistema.inventario"), p); assert.equal(v.estado, "DESCONHECIDO"); assert.ok(abortou); } finally { (orig as { timeoutMs: number }).timeoutMs = antes; }
});
test("auditoria indisponível: nada é entregue", async () => {
  const v = await executar(S, T("windows.sistema.inventario"), portas({ auditar: async () => { throw new Error("db"); } }));
  assert.equal(v.estado, "FALHOU");
});
test("mesmo contrato para qualquer agente (rótulo não altera decisão)", async () => {
  for (const agente of ["claude", "gemini", "gpt"]) assert.equal((await executar({ ...S, agente }, T("windows.sistema.inventario"), portas())).estado, "CONCLUIDA");
});
test("registro: toda capacidade de escrita está desligada e nenhuma usa Invoke-Expression/iex", () => {
  for (const c of CAPACIDADES_LOCAIS) { if (c.camada === "escrita") assert.equal(c.estado, "desligada"); assert.doesNotMatch(c.modelo, /Invoke-Expression|iex\b|-EncodedCommand|DownloadString/i); }
  assert.equal(renderizar(buscarCapacidade("windows.disco.livre")!, { unidade: "C" }).ok, true);
  assert.equal(argvPowerShell("x").includes("-ExecutionPolicy"), false);
});
