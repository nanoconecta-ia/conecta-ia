// Gateway LOCAL de homologação (127.0.0.1): MCP (composição já mesclada) + endpoints do dispositivo. NÃO é a Edge Function do Conecta.IA.
// Credencial do dispositivo (cia_dev_…) é separada da chave MCP; só o hash fica aqui; código de pareamento é de uso único e expira.
import { createServer } from "node:http";
import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { compilar } from "./permitidos.mjs";
import { tratarMcpComLocal } from "../../../supabase/functions/_shared/exec_local/gateway_local.ts";
import { FilaLocal } from "../../../supabase/functions/_shared/exec_local/fila.ts";
import { sha256Hex, gerarToken } from "../../../supabase/functions/_shared/conector/cripto.ts";

const TABELA = compilar(JSON.parse(readFileSync(new URL("./capacidades.windows.json", import.meta.url), "utf8")).capacidades);
const ALFA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const novoCodigo = () => Array.from(randomBytes(8), (b) => ALFA[b % ALFA.length]).join("");
const JSON_H = { "content-type": "application/json" };

export async function criarServidorLocal({ loja_id = "loja-homologacao", nomeAgente = "nano-ia", agora = Date.now } = {}) {
  const chave = gerarToken(); const hashChave = await sha256Hex(chave.token);
  const dispositivos = new Map();          // device_id -> { hash, loja_id, revogado, visto, plataforma }
  const codigos = new Map();               // codigo -> { expira }
  const pendentes = []; const resultados = new Map(); const auditoria = []; const eventos = [];
  let sessaoRevogada = false, falhasPareamento = 0;
  const reg = (e) => eventos.push({ ts: new Date(agora()).toISOString(), ...e });

  const runnerRemoto = {
    executar(_ex, argv, timeoutMs, sinal) {
      const d = [...dispositivos.entries()].find(([, v]) => !v.revogado && v.loja_id === loja_id);
      if (!d) return Promise.reject(new Error("sem_dispositivo"));
      return new Promise((resolve, reject) => {
        const job = { job_id: randomUUID(), device_id: d[0], capacidade: TABELA.find((c) => argv.length === 6 && c.re.test(argv[5]))?.id, argv, timeout_ms: timeoutMs };
        pendentes.push(job); reg({ evento: "job_criado", job_id: job.job_id, device_id: d[0] });
        resultados.set(job.job_id, { resolve, reject });
        sinal.addEventListener("abort", () => { resultados.delete(job.job_id); const i = pendentes.indexOf(job); if (i >= 0) pendentes.splice(i, 1); reject(new Error("abortado")); });
      });
    },
  };
  const portas = { agora, revogada: async () => sessaoRevogada, pausada: async () => false, consentimento: async () => null,
    auditar: async (e) => { auditoria.push({ ts: new Date(agora()).toISOString(), ...e }); }, runner: runnerRemoto };
  const fila = new FilaLocal(portas);
  const g = { validarChave: async (h) => (h === hashChave ? { chave_id: "k-homolog", loja_id, escopos: ["leitura"], criada_por: "dono", nome: nomeAgente } : null), limite: async () => true, contexto: () => ({}) };
  const l = { fila, esperaMs: 20000, novoId: () => randomUUID(),
    dispositivo: () => { const d = [...dispositivos.entries()].find(([, v]) => !v.revogado && v.loja_id === loja_id && agora() - v.visto < 15000); return d ? { dispositivo_id: d[0], hosts_permitidos: [] } : null; } };
  const laco = setInterval(() => { for (const [id, v] of dispositivos) if (!v.revogado) void fila.puxarEExecutar(v.loja_id, id); }, 20);

  const ler = (req) => new Promise((r) => { let b = ""; req.on("data", (c) => { if (b.length < 100000) b += c; }); req.on("end", () => r(b)); });
  const resp = (res, st, obj) => { res.writeHead(st, JSON_H); res.end(obj === undefined ? "" : JSON.stringify(obj)); };
  async function dispAuth(req) {
    const t = (req.headers.authorization ?? "").replace(/^Bearer /, ""); if (!t.startsWith("cia_dev_")) return null;
    const h = await sha256Hex(t); const e = [...dispositivos.entries()].find(([, v]) => v.hash === h);
    return e && !e[1].revogado ? e : null;
  }
  const server = createServer(async (req, res) => {
    try {
      const corpo = await ler(req);
      if (req.url === "/mcp") {
        const r = await tratarMcpComLocal({ metodo: req.method, cabecalhos: { authorization: req.headers.authorization, origin: req.headers.origin }, corpo }, g, l);
        res.writeHead(r.status, r.cabecalhos); return res.end(r.corpo);
      }
      if (req.url === "/dispositivo/parear") {
        const b = JSON.parse(corpo || "{}"); const c = codigos.get(b.codigo);
        if (falhasPareamento >= 5) return resp(res, 429, { erro: "bloqueado" });
        if (!c || c.expira < agora() || !/^dev_[0-9a-f]{16}$/.test(b.device_id ?? "")) { falhasPareamento++; reg({ evento: "pareamento_recusado" }); return resp(res, 403, { erro: "codigo_invalido_ou_expirado" }); }
        codigos.delete(b.codigo);
        const tok = "cia_dev_" + randomBytes(32).toString("base64url");
        dispositivos.set(b.device_id, { hash: await sha256Hex(tok), loja_id, revogado: false, visto: agora(), plataforma: b.plataforma, versao_agente: b.versao_agente });
        reg({ evento: "dispositivo_pareado", device_id: b.device_id, plataforma: b.plataforma }); return resp(res, 200, { token: tok });
      }
      if (req.url === "/dispositivo/proximo") {
        const d = await dispAuth(req); if (!d) return resp(res, 401, { erro: "revogado_ou_invalido" });
        d[1].visto = agora(); const i = pendentes.findIndex((j) => j.device_id === d[0]);
        if (i < 0) return resp(res, 204); return resp(res, 200, pendentes.splice(i, 1)[0]);
      }
      if (req.url === "/dispositivo/resultado") {
        const d = await dispAuth(req); if (!d) return resp(res, 401, { erro: "revogado_ou_invalido" });
        const b = JSON.parse(corpo); const w = resultados.get(b.job_id); resultados.delete(b.job_id);
        reg({ evento: "resultado_recebido", job_id: b.job_id, ok: b.ok });
        if (w) b.ok ? w.resolve({ saida: String(b.saida ?? "") }) : w.reject(new Error(String(b.erro ?? "falha")));
        return resp(res, 200, { ok: true });
      }
      resp(res, 404, { erro: "rota" });
    } catch (e) { resp(res, 400, { erro: "requisicao_invalida" }); }
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const url = `http://127.0.0.1:${server.address().port}`;
  return {
    url, tokenMcp: chave.token, auditoria, eventos,
    emitirCodigo: () => { const c = novoCodigo(); codigos.set(c, { expira: agora() + 10 * 60000 }); return c; },
    revogarDispositivo: (id) => { const d = dispositivos.get(id); if (d) { d.revogado = true; reg({ evento: "dispositivo_revogado", device_id: id }); } },
    revogarSessao: () => { sessaoRevogada = true; reg({ evento: "sessao_revogada" }); },
    injetarJobBruto: (device_id, argv, capacidade = "windows.sistema.inventario") => new Promise((resolve) => { const job = { job_id: randomUUID(), device_id, capacidade, argv, timeout_ms: 5000 }; resultados.set(job.job_id, { resolve: (r) => resolve({ ok: true, ...r }), reject: (e) => resolve({ ok: false, erro: e.message }) }); pendentes.push(job); }),
    dispositivos: () => [...dispositivos.keys()],
    fechar: () => { clearInterval(laco); server.close(); },
  };
}
