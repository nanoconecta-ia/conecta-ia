import { test } from "node:test";
import assert from "node:assert/strict";
import { executarHomologacao } from "./homologacao.mjs";
import { criarServidorLocal } from "./servidor_local.mjs";
import { rodarAgente } from "./agente.mjs";
import { compilar, autorizar } from "./permitidos.mjs";
import { readFileSync } from "node:fs";

const fake = new URL("../pwsh_falso.mjs", import.meta.url).pathname;
const caps = JSON.parse(readFileSync(new URL("./capacidades.windows.json", import.meta.url), "utf8")).capacidades;
const tab = compilar(caps); const pre = ["powershell.exe", "-NoProfile", "-NonInteractive", "-NoLogo", "-Command"];

test("homologação ponta a ponta com PowerShell falso: todos os passos aprovados", async () => {
  const r = await executarHomologacao({ binario: process.execPath, argsAntes: [fake] });
  for (const p of r.passos) assert.ok(p.ok, `${p.nome}: ${JSON.stringify(p.detalhe)}`);
  assert.equal(r.aprovado, true); assert.equal(r.auditoria.filter((a) => a.resultado === "CONCLUIDA").length, 2);
  assert.ok(r.auditoria.every((a) => a.dispositivo_id === r.device_id));
  assert.ok(!JSON.stringify(r).includes("cia_dev_") && !JSON.stringify(r).includes("cia_mcp_"));  // nenhum token nos logs/evidências
  assert.match(r.cartoes["windows.ambiente.versoes"].linhas.find((l) => l.rotulo === "Origem").valor, new RegExp(r.device_id));
});
test("lista permitida do agente: aceita só os modelos de consulta", () => {
  assert.ok(autorizar([...pre, "Get-PSDrive -Name C | Select-Object Name,Used,Free | ConvertTo-Json -Compress"], tab, "windows.disco.livre"));
  for (const ruim of ["Get-PSDrive -Name C; whoami | Select-Object Name,Used,Free | ConvertTo-Json -Compress", "Remove-Item C:\\x", "Get-Process -Name a b", "Get-Service -Name x\nwhoami"])
    for (const cap of tab.map((c) => c.id)) assert.equal(autorizar([...pre, ruim], tab, cap), null, ruim);
  assert.equal(autorizar(["cmd.exe", "/c", "dir"], tab, "windows.disco.livre"), null); assert.equal(autorizar([...pre.slice(0, 4), "-EncodedCommand", "x"], tab, "windows.disco.livre"), null);
  assert.equal(autorizar(pre, tab, "windows.disco.livre"), null);
});
test("código de pareamento: uso único, errado recusado, bloqueio após 5 falhas", async () => {
  const s = await criarServidorLocal(); const c = s.emitirCodigo(); let parar = false;
  const a = rodarAgente({ gateway: s.url, codigo: c, binario: process.execPath, argsAntes: [fake], capacidades: caps, parar: () => parar, intervaloMs: 20 });
  for (let i = 0; i < 100 && !s.dispositivos().length; i++) await new Promise((r) => setTimeout(r, 20));
  assert.equal((await rodarAgente({ gateway: s.url, codigo: c, capacidades: caps })).motivo, "pareamento_recusado");   // reuso
  for (let i = 0; i < 5; i++) await rodarAgente({ gateway: s.url, codigo: "ERRADO12", capacidades: caps });
  assert.equal((await rodarAgente({ gateway: s.url, codigo: s.emitirCodigo(), capacidades: caps })).status, 429);
  parar = true; await a; s.fechar();
});
test("sem dispositivo pareado nenhuma ferramenta local é anunciada", async () => {
  const s = await criarServidorLocal();
  const r = await (await fetch(s.url + "/mcp", { method: "POST", headers: { authorization: `Bearer ${s.tokenMcp}` }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }) })).json();
  assert.ok(!r.result.tools.some((t) => t.title.startsWith("windows."))); s.fechar();
});

test("allowlist exata por capacidade no agente: formato válido de OUTRA capacidade ou capacidade ausente são recusados", () => {
  const inv = "Get-CimInstance Win32_OperatingSystem | Select-Object Caption,Version,OSArchitecture,TotalVisibleMemorySize | ConvertTo-Json -Compress";
  assert.ok(autorizar([...pre, inv], tab, "windows.sistema.inventario"));
  assert.equal(autorizar([...pre, inv], tab, "windows.ambiente.versoes"), null);       // comando de uma capacidade, nome de outra
  assert.equal(autorizar([...pre, inv], tab, undefined), null);                        // servidor não informou a capacidade
  assert.equal(autorizar([...pre, inv], tab, "windows.servico.reiniciar"), null);      // capacidade inexistente/de escrita
  assert.equal(autorizar([...pre, "Get-ChildItem C:\\ -Recurse"], tab, "windows.sistema.inventario"), null);   // formato válido, comando diferente
});
