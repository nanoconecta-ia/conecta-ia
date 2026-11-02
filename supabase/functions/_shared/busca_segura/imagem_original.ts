// Imagem ORIGINAL proposta por um agente (MCP/chat): o endereço é NÃO CONFIÁVEL. Este módulo só valida e inspeciona; nunca edita, converte nem recorta a imagem.
// O QUE PROVA: https sem credenciais, porta 443, host que não é endereço interno/privado/metadata; ao baixar: no máximo 3 redirecionamentos (cada um revalidado),
//   tempo-limite, tamanho máximo, tipo REAL pelos primeiros bytes (jpeg/png/webp; SVG e outros são recusados), largura/altura e SHA-256 do arquivo original.
// O QUE NÃO PROVA: que o nome DNS não muda entre a checagem e a conexão (rebinding; a limitação é do runtime, que não permite fixar o IP) nem que a imagem é da peça certa,
//   nem que não tem marca d'água, nem os direitos de uso: isso continua sendo evidência de código + decisão humana (galeria.ts).
export const IMAGEM_MAX_BYTES = 8 * 1024 * 1024;
export const IMAGEM_TEMPO_MS = 8000;
export const IMAGEM_MAX_REDIRECTS = 3;
export const IMAGEM_RESOLUCAO_BAIXA_PX = 600;

export type MimeImagem = "image/jpeg" | "image/png" | "image/webp";
export interface ImagemInspecionada { sha256: string; bytes: number; mime: MimeImagem; largura_px: number; altura_px: number; url_final: string; avisos: string[] }
export type ResultadoImagem = { ok: true; imagem: ImagemInspecionada } | { ok: false; erro: string };

const SUFIXOS_INTERNOS = [".localhost", ".local", ".internal", ".lan", ".home.arpa", ".intranet", ".corp", ".private"];

function ipv4Privado(h: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || b === 0)) || (a === 198 && (b === 18 || b === 19));
}

function ipv6Privado(ip: string): boolean {
  const h = ip.toLowerCase();
  if (h === "::" || h === "::1") return true;
  if (/^f[cd]/.test(h) || /^fe[89ab]/.test(h)) return true; // ULA fc00::/7 e link-local fe80::/10
  const m = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(h);
  return m ? ipv4Privado(m[1]) : false;
}
const ipPrivado = (ip: string) => (ip.includes(":") ? ipv6Privado(ip) : ipv4Privado(ip));

/** Validação estática (sem rede): devolve a URL normalizada ou o motivo da recusa. */
export function urlImagemSegura(entrada: string): { ok: true; url: string } | { ok: false; erro: string } {
  let u: URL;
  try { u = new URL(entrada); } catch { return { ok: false, erro: "Endereço de imagem inválido." }; }
  if (u.protocol !== "https:") return { ok: false, erro: "A imagem precisa ser um endereço https." };
  if (u.username || u.password) return { ok: false, erro: "O endereço da imagem não pode ter usuário ou senha." };
  if (u.port && u.port !== "443") return { ok: false, erro: "Só a porta 443 é aceita para imagem." };
  const h = u.hostname.toLowerCase().replace(/\.$/, "");
  if (!h) return { ok: false, erro: "Endereço de imagem sem servidor." };
  if (h.startsWith("[") || h.includes(":")) return { ok: false, erro: "Endereço IPv6 direto não é aceito para imagem." };
  if (/^[\d.]+$/.test(h)) return { ok: false, erro: ipv4Privado(h) ? "Endereço interno ou privado não é aceito para imagem." : "Endereço IP direto não é aceito para imagem; use o nome do site." };
  if (h === "localhost" || !h.includes(".") || SUFIXOS_INTERNOS.some((s) => h.endsWith(s))) return { ok: false, erro: "Endereço interno não é aceito para imagem." };
  return { ok: true, url: u.toString() };
}

/** Tipo e dimensões pelos bytes (JPEG, PNG, WebP). Qualquer outra coisa (SVG, GIF, HTML) é recusada. */
export function inspecionarBytes(b: Uint8Array): { mime: MimeImagem; largura_px: number; altura_px: number } | null {
  const u16 = (i: number) => (b[i] << 8) | b[i + 1];
  if (b.length >= 24 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
    const w = ((b[16] << 24) | (b[17] << 16) | (b[18] << 8) | b[19]) >>> 0, h = ((b[20] << 24) | (b[21] << 16) | (b[22] << 8) | b[23]) >>> 0;
    return w > 0 && h > 0 ? { mime: "image/png", largura_px: w, altura_px: h } : null;
  }
  if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const m = b[i + 1];
      if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { i += 2; continue; }
      const len = u16(i + 2);
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) { const h = u16(i + 5), w = u16(i + 7); return w > 0 && h > 0 ? { mime: "image/jpeg", largura_px: w, altura_px: h } : null; }
      if (len < 2) return null;
      i += 2 + len;
    }
    return null;
  }
  const t = (i: number, s: string) => [...s].every((c, k) => b[i + k] === c.charCodeAt(0));
  if (b.length >= 30 && t(0, "RIFF") && t(8, "WEBP")) {
    if (t(12, "VP8X")) { const w = 1 + (b[24] | (b[25] << 8) | (b[26] << 16)), h = 1 + (b[27] | (b[28] << 8) | (b[29] << 16)); return { mime: "image/webp", largura_px: w, altura_px: h }; }
    if (t(12, "VP8 ")) { const w = (b[26] | (b[27] << 8)) & 0x3fff, h = (b[28] | (b[29] << 8)) & 0x3fff; return w > 0 && h > 0 ? { mime: "image/webp", largura_px: w, altura_px: h } : null; }
    if (t(12, "VP8L")) { const v = (b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24)) >>> 0; return { mime: "image/webp", largura_px: (v & 0x3fff) + 1, altura_px: ((v >>> 14) & 0x3fff) + 1 }; }
  }
  return null;
}

export const sha256Hex = async (b: Uint8Array): Promise<string> => [...new Uint8Array(await crypto.subtle.digest("SHA-256", b as Uint8Array<ArrayBuffer>))].map((x) => x.toString(16).padStart(2, "0")).join("");

export interface OpcoesBaixar {
  fetchFn?: typeof fetch;
  /** Resolve o nome para IPs (A/AAAA) para barrar nome que aponta para rede interna. Sem resolvedor, só a checagem estática vale. */
  resolver?: (host: string) => Promise<string[]>;
  maxBytes?: number; tempoMs?: number;
}

async function lerLimitado(r: Response, max: number): Promise<Uint8Array | null> {
  const declarado = Number(r.headers.get("content-length") ?? "0");
  if (declarado > max) return null;
  if (!r.body) { const ab = new Uint8Array(await r.arrayBuffer()); return ab.length > max ? null : ab; }
  const leitor = r.body.getReader(), partes: Uint8Array[] = []; let total = 0;
  for (;;) {
    const { done, value } = await leitor.read();
    if (done) break;
    total += value.length;
    if (total > max) { try { await leitor.cancel(); } catch { /* já encerrado */ } return null; }
    partes.push(value);
  }
  const saida = new Uint8Array(total); let o = 0;
  for (const p of partes) { saida.set(p, o); o += p.length; }
  return saida;
}

/** Baixa a imagem ORIGINAL (sem alterar) e devolve tipo real, dimensões e SHA-256. Falha fechada em qualquer dúvida. */
export async function baixarImagemOriginal(entrada: string, op: OpcoesBaixar = {}): Promise<ResultadoImagem> {
  const fetchFn = op.fetchFn ?? fetch, max = op.maxBytes ?? IMAGEM_MAX_BYTES, tempo = op.tempoMs ?? IMAGEM_TEMPO_MS;
  let atual = entrada;
  for (let salto = 0; salto <= IMAGEM_MAX_REDIRECTS; salto++) {
    const v = urlImagemSegura(atual);
    if (!v.ok) return v;
    if (op.resolver) {
      try {
        const ips = await op.resolver(new URL(v.url).hostname);
        if (!ips.length) return { ok: false, erro: "Não consegui resolver o servidor da imagem." };
        if (ips.some(ipPrivado)) return { ok: false, erro: "O servidor da imagem aponta para rede interna; recusada." };
      } catch { return { ok: false, erro: "Não consegui resolver o servidor da imagem." }; }
    }
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), tempo);
    let r: Response;
    try { r = await fetchFn(v.url, { method: "GET", redirect: "manual", signal: ctl.signal, headers: { accept: "image/jpeg,image/png,image/webp", "user-agent": "ConectaIA-verificador-de-imagem/1.0" } }); }
    catch { clearTimeout(timer); return { ok: false, erro: "Não consegui baixar a imagem (tempo esgotado ou servidor recusou)." }; }
    if (r.status >= 300 && r.status < 400) {
      clearTimeout(timer);
      const loc = r.headers.get("location");
      if (!loc) return { ok: false, erro: "Redirecionamento sem destino." };
      try { atual = new URL(loc, v.url).toString(); } catch { return { ok: false, erro: "Redirecionamento inválido." }; }
      continue;
    }
    try {
      if (r.status !== 200) return { ok: false, erro: `O servidor da imagem respondeu ${r.status}.` };
      const bytes = await lerLimitado(r, max);
      if (!bytes) return { ok: false, erro: `Imagem acima de ${Math.round(max / 1048576)} MB; recusada.` };
      const info = inspecionarBytes(bytes);
      if (!info) return { ok: false, erro: "O arquivo não é uma imagem JPEG, PNG ou WebP válida." };
      const avisos: string[] = [];
      if (Math.min(info.largura_px, info.altura_px) < IMAGEM_RESOLUCAO_BAIXA_PX) avisos.push(`Resolução baixa (${info.largura_px}x${info.altura_px}); o ideal é pelo menos ${IMAGEM_RESOLUCAO_BAIXA_PX}px no menor lado.`);
      return { ok: true, imagem: { sha256: await sha256Hex(bytes), bytes: bytes.length, mime: info.mime, largura_px: info.largura_px, altura_px: info.altura_px, url_final: v.url, avisos } };
    } finally { clearTimeout(timer); }
  }
  return { ok: false, erro: "Redirecionamentos demais; recusada." };
}
