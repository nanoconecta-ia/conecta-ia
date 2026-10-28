// Cliente de pareamento do agente (lado do SOLICITANTE do Conecta Pair): iniciar → o lojista aprova no painel → resgatar → renovar.
// A 1ª metade do token é gerada AQUI e só o hash vai ao servidor; a 2ª metade (sal) vem do servidor. Token completo = <token>.<sal>.
// Nada é gravado em disco: o token vive só na memória do agente (reiniciar = parear de novo).
import { createHash, randomBytes } from "node:crypto";

const sha256 = (s) => createHash("sha256").update(s).digest("hex");
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
export const metadeDeToken = () => randomBytes(32).toString("base64url");           // 43 caracteres: entra no padrão do Pair (43–128)
// Escopo mínimo aceito pelo Pair (leitura do andamento de tarefas). O despacho de diagnósticos NÃO usa escopo: usa tipo agente_desktop + lista de capacidades.
export const ESCOPOS_AGENTE = ["tarefas:ler"];

async function pedir(url, corpo, authorization, f) {
  const r = await f(url, { method: "POST", headers: { "content-type": "application/json", ...(authorization ? { authorization: `Bearer ${authorization}` } : {}) }, body: JSON.stringify(corpo) });
  let json = null; try { json = await r.json(); } catch { /* corpo vazio */ }
  return { status: r.status, json };
}

/** Inicia o pareamento. Devolve o que mostrar ao lojista e o necessário para esperar a aprovação. */
export async function iniciarPareamento({ pairUrl, nome, capacidades, duracaoMin = 480, renovavel = true, fetch: f = fetch }) {
  const metade = metadeDeToken();
  const r = await pedir(pairUrl, { acao: "iniciar", nome, tipo: "agente_desktop", escopos: ESCOPOS_AGENTE, capacidades, duracao_min: duracaoMin, renovavel, token_hash: sha256(metade) }, null, f);
  if (r.status !== 200 || !r.json?.codigo) throw new Error(`pareamento_nao_iniciado:${r.status}`);
  return { metade, codigo: r.json.codigo, segredo: r.json.segredo, sal: r.json.sal, url: r.json.url, verificacao: r.json.verificacao, expira_em: r.json.expira_em };
}

/** Espera o lojista aprovar. Devolve o TOKEN COMPLETO ou lança com o motivo (recusado, expirado, cancelado). */
export async function aguardarAprovacao({ pairUrl, inicio, intervaloMs = 2000, parar = () => false, fetch: f = fetch, log = () => {} }) {
  while (!parar()) {
    const r = await pedir(pairUrl, { acao: "consultar", codigo: inicio.codigo, segredo: inicio.segredo }, null, f);
    if (r.status === 429) { await dormir(intervaloMs * 3); continue; }
    const estado = r.json?.estado;
    if (estado === "resgatado") { log({ evento: "pareamento_aprovado", dispositivo_id: r.json.dispositivo_id }); return { token: `${inicio.metade}.${inicio.sal}`, dispositivo_id: r.json.dispositivo_id, loja_id: r.json.loja_id, limite_ate: r.json.limite_ate }; }
    if (estado && estado !== "pendente") throw new Error(`pareamento_${estado}`);
    await dormir(intervaloMs);
  }
  throw new Error("pareamento_interrompido");
}

/** Gira o token (a sessão de acesso dura 15 min). Devolve o novo token completo, ou null se o servidor recusar (sessão expirada/revogada). */
export async function renovarSessao({ pairUrl, token, fetch: f = fetch }) {
  const [, sal] = token.split(".");
  const nova = metadeDeToken();
  const r = await pedir(pairUrl, { acao: "renovar", novo_token_hash: sha256(nova) }, token, f);
  return r.status === 200 && r.json?.ok ? { token: `${nova}.${sal}`, expira_em: r.json.expira_em, limite_ate: r.json.limite_ate } : null;
}
