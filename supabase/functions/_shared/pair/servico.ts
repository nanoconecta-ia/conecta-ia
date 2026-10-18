// Lado do SOLICITANTE do Conecta Pair (sem login): iniciar, consultar/resgatar, renovar e encerrar.
// Função pública (verify_jwt=false): por isso tudo é validado aqui, limitado por taxa e sem oráculo de existência.
// O servidor gera código (QR), segredo de consulta e código de verificação; o TOKEN DE ACESSO é gerado pelo solicitante e só o hash chega aqui.
import { aleatorioB64u, codigoVerificacao, HASH_RE, montarUrlPareamento, SEGREDO_RE, sha256Hex } from "./cripto.ts";
import { ehTipo, escoposValidos } from "./escopos.ts";

export interface PortasPair {
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { code?: string; message?: string } | null }>;
  limite(chave: string, max: number, janelaS: number): Promise<boolean>;
  appUrl: string;
}
export interface Req { metodo: string; authorization: string | null; corpo: string; ip?: string }
export interface Res { status: number; corpo: unknown; headers?: Record<string, string> }

const res = (status: number, corpo: unknown, headers?: Record<string, string>): Res => ({ status, corpo, headers });
const CONTROLE = /[\u0000-\u001f\u007f<>]/; // nome é exibido ao aprovador: sem controle nem marcação
const CAP_RE = /^[a-z0-9_.:-]{3,60}$/;

export async function tratarPair(req: Req, p: PortasPair): Promise<Res> {
  if (req.metodo !== "POST") return res(405, { erro: "Use POST." }, { Allow: "POST" });
  if (req.corpo.length > 8 * 1024) return res(413, { erro: "Corpo grande demais." });
  let c: Record<string, unknown>;
  try { const j = JSON.parse(req.corpo); if (!j || typeof j !== "object" || Array.isArray(j)) throw 0; c = j; } catch { return res(400, { erro: "JSON inválido." }); }
  const ip = req.ip ?? "?";
  switch (c.acao) {
    case "iniciar": return iniciar(c, ip, p);
    case "consultar": return consultar(c, ip, p);
    case "renovar": return renovar(c, req.authorization, ip, p);
    case "encerrar": return encerrar(req.authorization, ip, p);
    default: return res(400, { erro: "Ação desconhecida." });
  }
}

async function iniciar(c: Record<string, unknown>, ip: string, p: PortasPair): Promise<Res> {
  if (!(await p.limite(`pair-iniciar:${ip}`, 10, 600))) return res(429, { erro: "Muitos pedidos de pareamento. Aguarde alguns minutos." }, { "Retry-After": "120" });
  const nome = typeof c.nome === "string" ? c.nome.trim() : "";
  if (nome.length < 1 || nome.length > 80 || CONTROLE.test(nome)) return res(400, { erro: "Nome do dispositivo inválido (1 a 80 caracteres, sem marcação)." });
  if (!ehTipo(c.tipo)) return res(400, { erro: "Tipo de dispositivo inválido." });
  if (!escoposValidos(c.escopos)) return res(400, { erro: "Escopos inválidos." });
  const caps = c.capacidades === undefined ? [] : c.capacidades;
  if (!Array.isArray(caps) || caps.length > 20 || !caps.every((x) => typeof x === "string" && CAP_RE.test(x))) return res(400, { erro: "Capacidades inválidas." });
  if (c.tipo !== "agente_desktop" && caps.length) return res(400, { erro: "Capacidades só existem para agente desktop." });
  const dur = c.duracao_min === undefined ? 60 : c.duracao_min;
  if (!Number.isInteger(dur) || (dur as number) < 5 || (dur as number) > 480) return res(400, { erro: "Duração deve ficar entre 5 e 480 minutos." });
  if (typeof c.token_hash !== "string" || !HASH_RE.test(c.token_hash)) return res(400, { erro: "token_hash deve ser o SHA-256 (hex) do token gerado no dispositivo." });

  for (let tentativa = 0; tentativa < 3; tentativa++) {
    const codigo = aleatorioB64u(32), segredo = aleatorioB64u(32), verificacao = codigoVerificacao();
    const { data, error } = await p.rpc("pair_iniciar", {
      p_codigo_hash: await sha256Hex(codigo), p_segredo_hash: await sha256Hex(segredo), p_verificacao_hash: await sha256Hex(verificacao),
      p_token_hash: c.token_hash, p_nome: nome, p_tipo: c.tipo, p_escopos: c.escopos, p_capacidades: caps, p_duracao_min: dur, p_ttl_s: 120,
    });
    if (error?.code === "23505") { if (tentativa === 2) break; continue; } // colisão de hash: tenta de novo (token_hash repetido também cai aqui)
    if (error || !data) return res(500, { erro: "Não foi possível iniciar o pareamento agora." });
    const d = data as { id: string; expira_em: string };
    return res(200, { desafio_id: d.id, codigo, url: montarUrlPareamento(p.appUrl, codigo), verificacao, segredo, expira_em: d.expira_em, ttl_s: 120 },
      { "Cache-Control": "no-store" });
  }
  return res(409, { erro: "Token já usado. Gere um token novo e tente de novo." });
}

async function consultar(c: Record<string, unknown>, ip: string, p: PortasPair): Promise<Res> {
  if (typeof c.codigo !== "string" || typeof c.segredo !== "string" || !SEGREDO_RE.test(c.codigo) || !SEGREDO_RE.test(c.segredo)) return res(400, { erro: "Código ou segredo inválido." });
  const hc = await sha256Hex(c.codigo);
  if (!(await p.limite(`pair-poll:${hc.slice(0, 16)}`, 90, 60)) || !(await p.limite(`pair-poll-ip:${ip}`, 300, 60))) return res(429, { erro: "Consultando rápido demais." }, { "Retry-After": "5" });
  const { data, error } = await p.rpc("pair_consultar", { p_codigo_hash: hc, p_segredo_hash: await sha256Hex(c.segredo) });
  if (error || !data) return res(500, { erro: "Não foi possível consultar agora." });
  return res(200, data, { "Cache-Control": "no-store" });
}

function bearer(a: string | null): string | null { const m = /^Bearer ([A-Za-z0-9_-]{43,128})$/.exec(a ?? ""); return m ? m[1] : null; }

async function renovar(c: Record<string, unknown>, auth: string | null, ip: string, p: PortasPair): Promise<Res> {
  const t = bearer(auth);
  if (!t || typeof c.novo_token_hash !== "string" || !HASH_RE.test(c.novo_token_hash)) return res(400, { erro: "Informe o token atual (Authorization) e novo_token_hash." });
  if (!(await p.limite(`pair-renovar:${ip}`, 60, 600))) return res(429, { erro: "Muitas renovações." });
  const { data, error } = await p.rpc("pair_renovar", { p_token_hash: await sha256Hex(t), p_novo_hash: c.novo_token_hash });
  const d = data as { ok?: boolean } | null;
  if (error) return res(500, { erro: "Não foi possível renovar agora." });
  return d?.ok ? res(200, data, { "Cache-Control": "no-store" }) : res(401, { erro: "Sessão inválida, expirada ou revogada. Faça um novo pareamento." });
}

async function encerrar(auth: string | null, ip: string, p: PortasPair): Promise<Res> {
  const t = bearer(auth);
  if (!t) return res(401, { erro: "Informe o token (Authorization)." });
  if (!(await p.limite(`pair-encerrar:${ip}`, 30, 600))) return res(429, { erro: "Muitas tentativas." });
  const { data } = await p.rpc("pair_encerrar", { p_token_hash: await sha256Hex(t) });
  return res(200, { ok: (data as { ok?: boolean } | null)?.ok === true });
}
