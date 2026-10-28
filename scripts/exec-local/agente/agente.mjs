// Agente Windows do Nano.IA — PORTÁTIL (sem instalador, sem serviço, sem registro): roda em primeiro plano, no usuário comum.
// Só faz conexões de SAÍDA para o gateway informado; nunca abre porta. O token do dispositivo fica só na memória.
// Uso:  node agente.mjs --gateway https://... --codigo ABCD2345     (Ctrl+C encerra; fechar a janela remove tudo que está em memória)
import { createHash } from "node:crypto";
import os from "node:os";
import { readFileSync, appendFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { compilar, autorizar } from "./permitidos.mjs";
import { criarRunnerWindows } from "../runner_windows.mjs";
import { aguardarAprovacao, iniciarPareamento, renovarSessao } from "./pareamento.mjs";

export const VERSAO_AGENTE = "0.1.0";
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

export function idDoDispositivo(sondas = {}) {
  const h = sondas.hostname ?? os.hostname(), p = sondas.plataforma ?? process.platform, a = sondas.arch ?? process.arch;
  return "dev_" + createHash("sha256").update(`${h}|${p}|${a}`).digest("hex").slice(0, 16);   // estável, não reversível, sem nome da máquina
}

export async function rodarAgente({ gateway, codigo, token: tokenDado, pairUrl, parear = false, renovarCadaMs = 10 * 60_000, intervaloPareamentoMs = 2000, binario, argsAntes, capacidades, log = () => {}, parar = () => false, intervaloMs = 1000, sondas = {} }) {
  const tabela = compilar(capacidades ?? JSON.parse(readFileSync(new URL("./capacidades.windows.json", import.meta.url), "utf8")).capacidades);
  const runner = criarRunnerWindows({ binario, argsAntes });
  const plataforma = sondas.plataforma ?? process.platform, device_id = idDoDispositivo(sondas);
  const post = async (rota, corpo, token) => fetch(gateway + rota, { method: "POST", headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(corpo) });

  let token = tokenDado;                           // Fase B: sessão do Conecta Pair já aprovada pelo lojista (vem de variável de ambiente, nunca de argumento)
  if (!token && parear) {                          // Fase B: pareamento pelo Conecta Pair — o LOJISTA aprova no painel; o token fica só na memória
    if (!pairUrl) throw new Error("pairUrl_obrigatoria");
    const ini = await iniciarPareamento({ pairUrl, nome: sondas.nome ?? `Agente Windows ${device_id.slice(4, 10)}`, capacidades: tabela.map((c) => c.id) });
    log({ evento: "aguardando_aprovacao_do_lojista", url: ini.url, codigo_de_verificacao: ini.verificacao, expira_em: ini.expira_em });   // o lojista confere este código no painel
    try { token = (await aguardarAprovacao({ pairUrl, inicio: ini, parar, log, intervaloMs: intervaloPareamentoMs })).token; } catch (e) { log({ evento: "pareamento_falhou", motivo: e.message }); return { motivo: e.message }; }
  }
  if (!token) {
    const r = await post("/dispositivo/parear", { codigo, device_id, plataforma, versao_agente: VERSAO_AGENTE });
    if (!r.ok) { log({ evento: "pareamento_recusado", status: r.status }); return { motivo: "pareamento_recusado", status: r.status }; }
    token = (await r.json()).token;                // só na memória
  }
  log({ evento: "pareado", device_id, plataforma });
  let ultimaRenovacao = Date.now();

  while (!parar()) {
    if (pairUrl && Date.now() - ultimaRenovacao >= renovarCadaMs) {   // a sessão de acesso expira em 15 min: gira o token antes
      const nova = await renovarSessao({ pairUrl, token }).catch(() => null);
      if (!nova) { log({ evento: "sessao_nao_renovada_encerrando" }); return { motivo: "sessao_expirada" }; }
      token = nova.token; ultimaRenovacao = Date.now(); log({ evento: "sessao_renovada" });
    }
    let resp;
    try { resp = await post("/dispositivo/proximo", {}, token); } catch { log({ evento: "gateway_inacessivel" }); await dormir(intervaloMs * 3); continue; }
    if (resp.status === 401) { log({ evento: "revogado_encerrando" }); return { motivo: "revogado" }; }
    if (resp.status === 204) { await dormir(intervaloMs); continue; }
    if (!resp.ok) { log({ evento: "gateway_recusou_temporariamente", status: resp.status }); await dormir(Math.min(intervaloMs * 5, 30000)); continue; }   // 429/5xx: espera mais e tenta de novo (só 401 encerra)
    const job = await resp.json();
    const cap = autorizar(job.argv, tabela, job.capacidade);
    if (!cap) {
      log({ evento: "comando_recusado_pelo_agente", job_id: job.job_id });
      await post("/dispositivo/resultado", { job_id: job.job_id, ok: false, erro: "comando_nao_autorizado_no_agente" }, token); continue;
    }
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), Math.min(job.timeout_ms ?? cap.timeoutMs, cap.timeoutMs));
    const ini = Date.now();
    try {
      const { saida } = await runner.executar("windows", job.argv, cap.timeoutMs, ctl.signal);
      log({ evento: "executado", job_id: job.job_id, capacidade: cap.id, ms: Date.now() - ini });
      await post("/dispositivo/resultado", { job_id: job.job_id, ok: true, saida }, token);
    } catch (e) {
      log({ evento: "falhou", job_id: job.job_id, capacidade: cap.id, erro: e.message });
      await post("/dispositivo/resultado", { job_id: job.job_id, ok: false, erro: e.message }, token);
    } finally { clearTimeout(t); }
  }
  return { motivo: "parado" };
}

// CLI
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
  const gateway = arg("--gateway"), codigo = arg("--codigo"), nomeEnv = arg("--token-env"), pairUrl = arg("--pair-url"), parear = process.argv.includes("--parear");
  const token = nomeEnv ? process.env[nomeEnv] : undefined;       // o token nunca vai na linha de comando (apareceria na lista de processos)
  if (!gateway || (!codigo && !token && !(parear && pairUrl))) { console.error("uso: node agente.mjs --gateway <url> (--codigo <código> | --token-env <VARIAVEL> | --parear --pair-url <url da função pair>)"); process.exit(2); }
  if (!/^https:\/\//.test(gateway) && !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(gateway)) { console.error("o gateway precisa ser https (ou 127.0.0.1 em teste local)"); process.exit(2); }
  mkdirSync(new URL("./logs/", import.meta.url), { recursive: true });
  const arq = new URL(`./logs/agente-${new Date().toISOString().slice(0, 10)}.log`, import.meta.url);
  let sair = false; process.on("SIGINT", () => { sair = true; });
  const log = (e) => { const l = JSON.stringify({ ts: new Date().toISOString(), ...e }); console.log(l); if (e.evento !== "aguardando_aprovacao_do_lojista") appendFileSync(arq, l + "\n"); };   // o link/código de pareamento (válidos 2 min) não vão para o arquivo
  rodarAgente({ gateway, codigo, token, pairUrl, parear, log, parar: () => sair }).then((r) => { log({ evento: "encerrado", ...r }); process.exit(0); });
}
