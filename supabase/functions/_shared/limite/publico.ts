// Limite de requisições dos endpoints PÚBLICOS (anônimos, verify_jwt = false): loja-publica e vitrine-assistente.
// Roda ANTES de qualquer consulta pesada ao banco. Quem chama é anônimo, então as chaves são IP (rajada e sustentado) e loja (teto geral).
// Usa a RPC já existente public.limite_chamada (só service_role); não precisa de migração. O IP nunca é guardado cru: vira HMAC e cai em
// um de N baldes fixos, para o número de linhas gravadas ter limite por construção. Se o próprio limitador falhar, a vitrine continua
// no ar com um teto local por instância (fail-open limitado).
//
// Regras de confiança no IP (revisão do PR #112):
//  - só vale o cabeçalho que a borda define e o cliente não consegue forjar (padrão: cf-connecting-ip, configurável); x-forwarded-for e
//    x-real-ip NÃO são usados, porque o primeiro item do x-forwarded-for é controlado pelo cliente;
//  - sem IP confiável, o pedido NÃO vira um balde global: entra num limite próprio da loja ("sem-ip"), mais apertado que o geral.

export interface RegraLimite { nome: string; max: number; janelaS: number }
export interface ConfigLimite { ip: RegraLimite[]; loja: RegraLimite; semIp: RegraLimite; baldesIp: number; corpoMaxBytes: number; tetoLocalPorMin: number }
/** true = dentro do limite; false = estourou; null/lançar = o limitador falhou. */
export type PortaLimite = (chave: string, max: number, janelaS: number) => Promise<boolean | null>;

export const CABECALHO_IP_PADRAO = "cf-connecting-ip";
export const LIMITES_PADRAO: Record<"loja-publica" | "vitrine-assistente", ConfigLimite> = {
  "loja-publica": {
    ip: [{ nome: "rajada", max: 60, janelaS: 60 }, { nome: "sustentado", max: 600, janelaS: 3600 }],
    loja: { nome: "loja", max: 1200, janelaS: 60 }, semIp: { nome: "sem-ip", max: 300, janelaS: 60 },
    baldesIp: 2048, corpoMaxBytes: 4096, tetoLocalPorMin: 30,
  },
  "vitrine-assistente": {
    ip: [{ nome: "rajada", max: 20, janelaS: 60 }, { nome: "sustentado", max: 120, janelaS: 3600 }],
    loja: { nome: "loja", max: 600, janelaS: 60 }, semIp: { nome: "sem-ip", max: 100, janelaS: 60 },
    baldesIp: 2048, corpoMaxBytes: 2048, tetoLocalPorMin: 10,
  },
};

const IPV4 = /^(?:\d{1,3}\.){3}\d{1,3}$/;
const IPV6 = /^[0-9a-f:]{2,45}$/i;
const valido = (s: string) => (IPV4.test(s) && s.split(".").every((p) => Number(p) <= 255)) || (s.includes(":") && IPV6.test(s));
const NOME_CABECALHO = /^[a-z][a-z0-9-]{2,39}$/i;

/** Nome do cabeçalho de IP confiável a partir da configuração; valor inválido volta ao padrão. */
export const cabecalhoIpConfigurado = (valor: string | undefined | null): string => (valor && NOME_CABECALHO.test(valor.trim()) ? valor.trim().toLowerCase() : CABECALHO_IP_PADRAO);

/** IP do cliente a partir do ÚNICO cabeçalho confiável. Ausente ou inválido = null (sem IP confiável). */
export function ipDoPedido(h: { get(nome: string): string | null }, cabecalho: string = CABECALHO_IP_PADRAO): string | null {
  const s = (h.get(cabecalho) ?? "").trim();
  return s && valido(s) ? s.toLowerCase() : null;
}

const enc = new TextEncoder();
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
/** Identificador opaco: HMAC-SHA256 truncado. Sem o segredo não dá para voltar à entrada. */
export async function chaveOpaca(valor: string, segredo: string): Promise<string> {
  const k = await crypto.subtle.importKey("raw", enc.encode(segredo), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", k, enc.encode(valor))).slice(0, 24);
}
/** Balde fixo (0..n-1) do cliente: limita quantas linhas distintas o limitador grava, mesmo com IP girando. */
export const baldeDe = (opaca: string, n: number): number => parseInt(opaca.slice(0, 8), 16) % Math.max(1, n);

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

/** Teto local (por instância) usado só quando o limitador central falha. A limpeza das entradas vencidas roda no máximo a cada 30 s
 *  (antes percorria o mapa inteiro a cada chamada). */
const local = new Map<string, { n: number; fim: number }>();
let ultimaLimpeza = 0;
export const tamanhoTetoLocal = () => local.size;
export function tetoLocal(chave: string, max: number, agora: number): boolean {
  if (local.size > 5000 && agora - ultimaLimpeza >= 30_000) { ultimaLimpeza = agora; for (const [k, v] of local) if (v.fim <= agora) local.delete(k); }
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
  /** Cabeçalho de IP confiável (padrão cf-connecting-ip). Trocar só depois de confirmar o que a borda entrega. */
  cabecalhoIp?: string;
  config?: ConfigLimite;
  agora?: () => number;
  aoFalhar?: (motivo: string) => void;
  /** Em observar, contabiliza a decisão mas não bloqueia por taxa. */
  modo?: "observar" | "bloquear";
  aoObservar?: (camada: string, negaria: boolean) => void;
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

  const ip = ipDoPedido(e.req.headers, e.cabecalhoIp ?? CABECALHO_IP_PADRAO);
  const loja = e.lojaDe(corpo) ?? "-";
  const lojaOpaca = await chaveOpaca(`${e.endpoint}|${loja}`, e.segredo);
  const tenta = async (chave: string, r: RegraLimite): Promise<boolean | null> => { try { return await e.porta(chave, r.max, r.janelaS); } catch { return null; } };

  // 1) Teto da loja PRIMEIRO: pedido negado aqui grava uma única linha (sempre a mesma da janela) e não toca nas chaves de IP.
  const rl = await tenta(`pub:${e.endpoint}:loja:${lojaOpaca}`, cfg.loja);
  if (rl === false) { e.aoObservar?.("loja", true); if (e.modo !== "observar") return negar(cfg.loja.janelaS); }

  // 2) IP em balde fixo; sem IP confiável não existe balde global: vale o limite próprio da loja para quem não se identifica.
  let chavesLocais: string, resultados: (boolean | null)[], regras: RegraLimite[];
  if (ip) {
    const balde = baldeDe(await chaveOpaca(ip, e.segredo), cfg.baldesIp);
    regras = cfg.ip;
    chavesLocais = `${e.endpoint}:ip:${balde}`;
    resultados = await Promise.all(regras.map((r) => tenta(`pub:${e.endpoint}:ip:${r.nome}:${balde}`, r)));
  } else {
    regras = [cfg.semIp];
    chavesLocais = `${e.endpoint}:sem-ip:${lojaOpaca}`;
    resultados = await Promise.all(regras.map((r) => tenta(`pub:${e.endpoint}:semip:${lojaOpaca}`, r)));
  }
  const i = resultados.findIndex((r) => r === false);
  if (i >= 0) { e.aoObservar?.(ip ? `ip_${regras[i].nome}` : "sem_ip", true); if (e.modo !== "observar") return negar(regras[i].janelaS); }

  if (rl === null || resultados.some((r) => r === null)) {
    e.aoFalhar?.("limitador_indisponivel");
    if (!tetoLocal(chavesLocais, cfg.tetoLocalPorMin, agora())) { e.aoObservar?.("fallback", true); if (e.modo !== "observar") return negar(60); }
  }
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
