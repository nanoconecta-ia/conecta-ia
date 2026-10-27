// Limite de requisições dos endpoints PÚBLICOS (anônimos, verify_jwt = false): loja-publica e vitrine-assistente.
// Roda ANTES de qualquer consulta ao banco. Quem chama é anônimo, então as chaves são IP (rajada e sustentado) e loja (teto geral).
// Usa a RPC já existente public.limite_chamada (só service_role); não precisa de migração. O IP nunca é guardado cru: vira HMAC truncado.
// Se o próprio limitador falhar, a vitrine continua no ar com um teto local por instância (fail-open limitado).

export interface RegraLimite { nome: string; max: number; janelaS: number }
export interface ConfigLimite { ip: RegraLimite[]; loja: RegraLimite; corpoMaxBytes: number; tetoLocalPorMin: number }
/** true = dentro do limite; false = estourou; null/lançar = o limitador falhou. */
export type PortaLimite = (chave: string, max: number, janelaS: number) => Promise<boolean | null>;

export const LIMITES_PADRAO: Record<"loja-publica" | "vitrine-assistente", ConfigLimite> = {
  "loja-publica": {
    ip: [{ nome: "rajada", max: 60, janelaS: 60 }, { nome: "sustentado", max: 600, janelaS: 3600 }],
    loja: { nome: "loja", max: 1200, janelaS: 60 }, corpoMaxBytes: 4096, tetoLocalPorMin: 30,
  },
  "vitrine-assistente": {
    ip: [{ nome: "rajada", max: 20, janelaS: 60 }, { nome: "sustentado", max: 120, janelaS: 3600 }],
    loja: { nome: "loja", max: 600, janelaS: 60 }, corpoMaxBytes: 2048, tetoLocalPorMin: 10,
  },
};

const IPV4 = /^(?:\d{1,3}\.){3}\d{1,3}$/;
const IPV6 = /^[0-9a-f:]{2,45}$/i;
const valido = (s: string) => (IPV4.test(s) && s.split(".").every((p) => Number(p) <= 255)) || (s.includes(":") && IPV6.test(s));

/** IP do cliente. Prefere o cabeçalho que a borda (Cloudflare) define e o cliente não consegue forjar; senão o 1º do x-forwarded-for.
 *  Qual cabeçalho a borda do Supabase preenche NÃO foi confirmado em ambiente real: por isso o teto por loja existe mesmo se o IP for forjado. */
export function ipDoPedido(h: { get(nome: string): string | null }): string | null {
  const cand = [h.get("cf-connecting-ip"), h.get("x-real-ip"), (h.get("x-forwarded-for") ?? "").split(",")[0]];
  for (const c of cand) { const s = (c ?? "").trim(); if (s && valido(s)) return s.toLowerCase(); }
  return null;
}

const enc = new TextEncoder();
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
/** Identificador opaco do cliente: HMAC-SHA256(ip, segredo) truncado. Sem o segredo não dá para voltar ao IP. */
export async function chaveOpaca(valor: string, segredo: string): Promise<string> {
  const k = await crypto.subtle.importKey("raw", enc.encode(segredo), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", k, enc.encode(valor))).slice(0, 24);
}

/** Lê o corpo sem ultrapassar o limite (não carrega corpo gigante na memória). null = grande demais. */
export async function lerTextoLimitado(req: { headers: { get(n: string): string | null }; body: ReadableStream<Uint8Array> | null }, max: number): Promise<string | null> {
  const cl = Number(req.headers.get("content-length"));
  if (Number.isFinite(cl) && cl > max) return null;
  if (!req.body) return "";
  const r = req.body.getReader(), dec = new TextDecoder();
  let total = 0, out = "";
  for (;;) {
    const { done, value } = await r.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) { await r.cancel().catch(() => {}); return null; }
    out += dec.decode(value, { stream: true });
  }
  return out + dec.decode();
}

/** Teto local (por instância) usado só quando o limitador central falha. */
const local = new Map<string, { n: number; fim: number }>();
export function tetoLocal(chave: string, max: number, agora: number): boolean {
  if (local.size > 5000) for (const [k, v] of local) if (v.fim <= agora) local.delete(k);
  const e = local.get(chave);
  if (!e || e.fim <= agora) { local.set(chave, { n: 1, fim: agora + 60_000 }); return true; }
  e.n++;
  return e.n <= max;
}

export interface EntradaGuarda {
  endpoint: keyof typeof LIMITES_PADRAO;
  req: { headers: { get(n: string): string | null }; body: ReadableStream<Uint8Array> | null };
  /** Do corpo já lido, devolve o identificador da loja (host normalizado ou slug) SEM consultar o banco. */
  lojaDe: (corpo: any) => string | null;
  porta: PortaLimite;
  segredo: string;
  config?: ConfigLimite;
  agora?: () => number;
  aoFalhar?: (motivo: string) => void;
}
export type ResultadoGuarda =
  | { ok: true; corpo: any }
  | { ok: false; status: 413 | 429; corpo: { erro: string }; cabecalhos: Record<string, string> };

export async function guardarPublico(e: EntradaGuarda): Promise<ResultadoGuarda> {
  const cfg = e.config ?? LIMITES_PADRAO[e.endpoint];
  const agora = e.agora ?? Date.now;
  const texto = await lerTextoLimitado(e.req, cfg.corpoMaxBytes);
  if (texto === null) return { ok: false, status: 413, corpo: { erro: "Pedido grande demais." }, cabecalhos: {} };
  let corpo: any = {};
  try { corpo = texto ? JSON.parse(texto) : {}; } catch { corpo = {}; } // mesmo contrato de antes: corpo inválido vira {} e cai no 404 da loja

  const ip = ipDoPedido(e.req.headers);
  const cliente = await chaveOpaca(ip ?? "desconhecido", e.segredo);
  const loja = e.lojaDe(corpo) ?? "-";
  const lojaChave = await chaveOpaca(`${e.endpoint}|${loja}`, e.segredo);
  // cliente sem IP identificável divide um balde só e menor: não vira rota livre para quem esconde o IP
  const regrasIp = ip ? cfg.ip : cfg.ip.map((r) => ({ ...r, max: Math.max(1, Math.floor(r.max / 2)) }));
  const checagens: { chave: string; regra: RegraLimite }[] = [
    ...regrasIp.map((r) => ({ chave: `pub:${e.endpoint}:ip:${r.nome}:${cliente}`, regra: r })),
    { chave: `pub:${e.endpoint}:loja:${lojaChave}`, regra: cfg.loja },
  ];
  const resultados = await Promise.all(checagens.map(async (c) => {
    try { return await e.porta(c.chave, c.regra.max, c.regra.janelaS); } catch { return null; }
  }));
  if (resultados.some((r) => r === null)) {
    e.aoFalhar?.("limitador_indisponivel");
    if (!tetoLocal(`${e.endpoint}:${cliente}`, cfg.tetoLocalPorMin, agora())) return negar(60);
    return { ok: true, corpo };
  }
  const i = resultados.findIndex((r) => r === false);
  if (i >= 0) return negar(checagens[i].regra.janelaS);
  return { ok: true, corpo };
}

function negar(janelaS: number): ResultadoGuarda {
  const retry = Math.max(1, Math.min(janelaS, 3600));
  return { ok: false, status: 429, corpo: { erro: "Muitas consultas seguidas. Aguarde um instante e tente de novo." }, cabecalhos: { "Retry-After": String(retry) } };
}

/** Segredo do HMAC: LIMITE_PEPPER se existir; senão deriva do segredo de serviço que já está no runtime (nunca sai nem é logado). */
export function segredoDoLimite(env: { get(n: string): string | undefined }): string {
  return env.get("LIMITE_PEPPER") ?? `limite-publico|${env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "sem-segredo"}`;
}

/** Porta sobre a RPC public.limite_chamada. Erro ou resposta que não seja booleana = limitador falhou (null). */
export const portaViaRpc = (sb: { rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }> }): PortaLimite =>
  async (chave, max, janelaS) => {
    const { data, error } = await sb.rpc("limite_chamada", { p_chave: chave, p_max: max, p_janela_s: janelaS });
    return error || typeof data !== "boolean" ? null : data;
  };
