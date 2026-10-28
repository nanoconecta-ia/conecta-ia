// Homologação ponta a ponta LOCAL: chat(cliente MCP) → gateway local → agente → PowerShell → resultado, com negativos e revogação.
// Modo padrão: PowerShell FALSO (CI/Linux). Modo --real: powershell.exe do próprio computador (somente os 5 diagnósticos de leitura).
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { criarServidorLocal } from "./servidor_local.mjs";
import { rodarAgente, idDoDispositivo } from "./agente.mjs";
import { cartaoDoVeredito } from "../../../supabase/functions/_shared/exec_local/apresentacao_chat.ts";

export async function executarHomologacao({ binario, argsAntes, real = false, sondas = {} } = {}) {
  const srv = await criarServidorLocal(); const logAgente = []; let parar = false; const ev = { passos: [], inicio: new Date().toISOString() };
  const passo = (nome, ok, detalhe) => ev.passos.push({ nome, ok, detalhe });
  const mcp = async (method, params) => (await (await fetch(srv.url + "/mcp", { method: "POST", headers: { authorization: `Bearer ${srv.tokenMcp}`, "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) })).json()).result;
  const chamar = async (nome, args = {}) => JSON.parse((await mcp("tools/call", { name: nome, arguments: args })).content[0].text);

  const agente = rodarAgente({ gateway: srv.url, codigo: srv.emitirCodigo(), binario, argsAntes, log: (e) => logAgente.push({ ts: new Date().toISOString(), ...e }), parar: () => parar, intervaloMs: 30, sondas });
  for (let i = 0; i < 100 && !srv.dispositivos().length; i++) await new Promise((r) => setTimeout(r, 20));
  const device_id = srv.dispositivos()[0]; passo("pareamento com identidade própria", device_id === idDoDispositivo(sondas), device_id);
  for (let i = 0; i < 100 && !(await mcp("tools/list", {})).tools.some((t) => t.title === "windows.sistema.inventario"); i++) await new Promise((r) => setTimeout(r, 20));

  const lista = (await mcp("tools/list", {})).tools.map((t) => t.title); passo("descoberta de ferramentas", lista.includes("windows.sistema.inventario") && lista.includes("windows.ambiente.versoes"), lista.filter((t) => t.startsWith("windows.")));
  const ambiente = real && (sondas.plataforma ?? process.platform) === "win32" ? "dispositivo_real" : "local_isolado";
  const cartoes = {};
  for (const [id, nome] of [["windows.sistema.inventario", "windows__sistema__inventario"], ["windows.ambiente.versoes", "windows__ambiente__versoes"]]) {
    const r = await chamar(nome); cartoes[id] = cartaoDoVeredito(r, { capacidade: id, dispositivo_id: r.dispositivo_id, agente: "nano-ia", tarefa_id: r.tarefa_id, ambiente });
    passo(`inventário de leitura: ${id}`, r.estado === "CONCLUIDA", { estado: r.estado, hash: r.evidencia?.sha256?.slice(0, 12), dispositivo: r.dispositivo_id, saida: r.evidencia?.saida?.slice(0, 600) });
  }
  const inj = await chamar("windows__processo__existe", { nome: "x; calc" }); passo("injeção bloqueada no servidor", inj.estado === "NEGADA", inj.motivo);
  const desl = await chamar("windows__servico__reiniciar", { nome: "spooler" }).catch(() => null); passo("ferramenta de escrita não anunciada nem executável", !lista.includes("windows.servico.reiniciar") && (!desl || desl.estado !== "CONCLUIDA"), desl?.motivo ?? desl?.erro);
  const bruto = await srv.injetarJobBruto(device_id, ["powershell.exe", "-NoProfile", "-NonInteractive", "-NoLogo", "-Command", "Get-ChildItem C:\\ -Recurse"]);
  passo("agente recusa comando fora da lista (servidor comprometido)", !bruto.ok && bruto.erro === "comando_nao_autorizado_no_agente", bruto.erro);
  srv.revogarSessao(); const rev = await chamar("windows__sistema__inventario"); passo("sessão revogada: tarefa negada", rev.estado === "NEGADA" && rev.motivo === "sessao_revogada", rev.motivo);
  srv.revogarDispositivo(device_id); const fim = await agente; passo("dispositivo revogado: agente encerra sozinho", fim.motivo === "revogado", fim.motivo);
  const depois = (await mcp("tools/list", {})).tools.some((t) => t.title.startsWith("windows.")); passo("após revogar, ferramentas locais deixam de ser anunciadas", !depois);
  parar = true; srv.fechar();
  return { ...ev, fim: new Date().toISOString(), modo: real ? "powershell_real" : "powershell_falso", ambiente, device_id, cartoes, auditoria: srv.auditoria, eventos_servidor: srv.eventos, log_agente: logAgente, aprovado: ev.passos.every((p) => p.ok) };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const real = process.argv.includes("--real");
  const fake = new URL("../pwsh_falso.mjs", import.meta.url).pathname;
  const r = await executarHomologacao(real ? { real: true } : { binario: process.execPath, argsAntes: [fake] });
  mkdirSync(new URL("./evidencias/", import.meta.url), { recursive: true });
  const arq = new URL(`./evidencias/homologacao-${r.modo}-${r.inicio.replace(/[:.]/g, "-")}.json`, import.meta.url);
  writeFileSync(arq, JSON.stringify(r, null, 2)); console.log(r.passos.map((p) => `${p.ok ? "OK " : "FALHA"} ${p.nome}`).join("\n")); console.log(r.aprovado ? "APROVADO" : "REPROVADO", "→", arq.pathname);
  process.exit(r.aprovado ? 0 : 1);
}
