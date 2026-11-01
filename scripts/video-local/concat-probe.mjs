// Homologacao SOMENTE LEITURA do MCP nativo do Concat.
// Nao instala programas, nao importa arquivos e nao executa edicoes/exportacoes.
import { existsSync, realpathSync, createReadStream } from "node:fs";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { resolve, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";

export const FERRAMENTAS_VIDEO = Object.freeze([
  "concat_version", "project_list", "project_create", "project_save", "project_close",
  "timeline_read", "media_probe", "media_import", "clip_add", "clips_add_sequence",
  "title_add", "captions_add", "effects_list", "export_start", "export_status", "export_wait",
]);
export function caminhoConcat(env = process.env) {
  const candidatas = [
    env.LOCALAPPDATA && env.LOCALAPPDATA + "\\Programs\\Concat\\concat.exe",
    env.ProgramFiles && env.ProgramFiles + "\\Concat\\concat.exe",
    env.HOME && env.HOME + "/.local/bin/concat",
    "/usr/bin/concat",
  ].filter(Boolean);
  return candidatas.find(x => existsSync(x)) ?? null;
}
export function argumentosProbe(argv) {
  let bin = null, modo = "headless", sha256 = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--bin" && i + 1 < argv.length && !bin) bin = argv[++i];
    else if (argv[i] === "--sha256" && i + 1 < argv.length && !sha256) sha256 = argv[++i];
    else if (argv[i] === "--window") modo = "window";
    else throw Error("Use --bin caminho-absoluto --sha256 hash-oficial e, opcionalmente, --window.");
  }
  return { bin, modo, sha256 };
}
function ambienteMinimo(env) {
  const nomes = ["PATH", "Path", "HOME", "USERPROFILE", "LOCALAPPDATA", "APPDATA", "ProgramFiles", "TMP", "TEMP", "SYSTEMROOT", "SystemRoot", "WINDIR"];
  return Object.fromEntries(nomes.filter(n => typeof env[n] === "string").map(n => [n, env[n]]));
}
/** Procedência do executável do Concat: caminho absoluto + SHA-256 do lançamento oficial verificado pela pessoa. */
export async function verificarExecutavel(caminho, sha256Esperado) {
  if (typeof caminho !== "string" || !isAbsolute(caminho) || !existsSync(caminho)) throw Error("Concat nao instalado em caminho conhecido. Informe --bin com o executavel oficial, apos verificacao.");
  if (typeof sha256Esperado !== "string" || !/^[0-9a-f]{64}$/i.test(sha256Esperado)) throw Error("Informe --sha256 com o SHA-256 (64 hex) do executavel oficial do Concat.");
  const real = realpathSync(caminho); const h = createHash("sha256");
  await new Promise((ok, fail) => { const r = createReadStream(real); r.on("data", d => h.update(d)); r.once("error", fail); r.once("end", ok); });
  if (h.digest("hex") !== sha256Esperado.toLowerCase()) throw Error("SHA-256 do executavel nao confere: nao sera executado.");
  return real;
}
export async function sondarConcat({ bin, sha256, modo = "headless", timeoutMs = 9000, lancar = spawn, env = process.env } = {}) {
  // Sem descoberta automática: caminhoConcat só SUGERE onde procurar; nunca executa um binário que ninguém verificou.
  const executavel = await verificarExecutavel(bin ?? null, sha256 ?? null);
  if (!["headless", "window"].includes(modo)) throw Error("Modo MCP invalido.");
  const proc = lancar(resolve(executavel), ["--mcp", modo], {
    env: ambienteMinimo(env), stdio: ["pipe", "pipe", "pipe"], shell: false, windowsHide: true,
  });
  const linhas = createInterface({ input: proc.stdout, crlfDelay: Infinity });
  const pendentes = new Map(); let id = 0; let total = 0; let encerrado = false;
  const falhar = (e) => { encerrado = true; for (const p of pendentes.values()) p.reject(e); pendentes.clear(); };
  proc.once("error", falhar);
  proc.once("close", codigo => falhar(Error("Concat MCP encerrou (codigo " + codigo + ").")));
  linhas.on("line", line => {
    total += Buffer.byteLength(line, "utf8");
    if (total > 1_000_000 || line.length > 200_000) { falhar(Error("Resposta do MCP excedeu limite.")); proc.kill(); return; }
    let obj; try { obj = JSON.parse(line); } catch { return; }
    if (!obj || typeof obj !== "object" || typeof obj.id !== "number") return;
    const item = pendentes.get(obj.id); if (!item) return;
    pendentes.delete(obj.id);
    obj.error ? item.reject(Error("MCP devolveu erro: " + (obj.error.message || obj.error.code))) : item.resolve(obj.result);
  });
  const solicitar = (method, params) => {
    if (encerrado) return Promise.reject(Error("Concat MCP indisponivel."));
    const n = ++id;
    return new Promise((resolve, reject) => {
      pendentes.set(n, { resolve, reject });
      proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: n, method, params }) + "\n");
    });
  };
  let timer;
  try {
    return await Promise.race([
      (async () => {
        const init = await solicitar("initialize", { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "nano-video-homologacao", version: "0.1.0" } });
        if (!init?.serverInfo) throw Error("MCP nao forneceu identificacao do servidor.");
        proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");
        const lista = await solicitar("tools/list", {});
        const ferramentas = Array.isArray(lista?.tools) ? lista.tools.map(t => t?.name).filter(x => typeof x === "string") : [];
        if (!ferramentas.includes("concat_version")) throw Error("Servidor nao apresentou ferramentas esperadas do Concat.");
        const versao = await solicitar("tools/call", { name: "concat_version", arguments: {} });
        return { ok: true, servidor: init.serverInfo.name, modo, presentes: FERRAMENTAS_VIDEO.filter(n => ferramentas.includes(n)),
          ausentes: FERRAMENTAS_VIDEO.filter(n => !ferramentas.includes(n)), ferramentas_totais: ferramentas.length,
          versao: Array.isArray(versao?.content) ? versao.content.filter(c => c.type === "text").map(c => String(c.text).slice(0, 300)).join(" ").slice(0, 500) : "nao informada",
          editou: false, exportou: false };
      })(),
      new Promise((_, reject) => { timer = setTimeout(() => reject(Error("Tempo limite do MCP Concat.")), timeoutMs); }),
    ]);
  } finally {
    clearTimeout(timer);
    linhas.close(); proc.kill();
  }
}
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    const r = await sondarConcat(argumentosProbe(process.argv.slice(2)));
    console.log(JSON.stringify(r, null, 2));
  } catch (e) {
    console.error("NANO_CONCAT_NAO_HOMOLOGADO: " + (e instanceof Error ? e.message : "Falha desconhecida."));
    process.exitCode = 1;
  }
}
