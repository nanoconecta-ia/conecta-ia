// Pesquisa e leitura de páginas da web para o Nano.ia (SOMENTE LEITURA). O conteúdo lido é DADO a conferir, nunca instrução:
// quem usa o resultado cita a URL e a data e só cria PROPOSTA (aprovação humana depois). Nada aqui grava no banco nem no Bling.
import { IaErro } from "./tipos.ts";

export interface ResultadoWeb { titulo: string; url: string; trecho: string }
export interface PaginaLida { url: string; titulo: string; texto: string; lido_em: string; truncado: boolean }

const MAX_BYTES = 1_000_000;
const MAX_TEXTO = 12_000;
const MAX_REDIRECIONAMENTOS = 3;
const TIPOS_ACEITOS = /^(text\/html|application\/xhtml\+xml|text\/plain)\b/i;

/** https público, porta padrão, sem usuário/senha, host com ponto e fora de faixas internas. Querystring é permitida (catálogos usam). */
export function urlLeituraSegura(url: string): boolean {
  let u: URL;
  try { u = new URL(url); } catch { return false; }
  if (u.protocol !== "https:" || u.username || u.password || (u.port && u.port !== "443")) return false;
  const h = u.hostname.toLowerCase();
  if (!h.includes(".") || h.includes(":") || h.startsWith("[") || /^\d+\.\d+\.\d+\.\d+$/.test(h)) return false;
  if (h === "localhost" || /\.(local|internal|localhost|lan|home|corp|intranet)$/.test(h)) return false;
  return true;
}

const ENTIDADES: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&nbsp;": " " };

/** HTML -> texto simples: remove scripts, estilos e comentários; não executa nada. */
export function htmlParaTexto(html: string): { titulo: string; texto: string } {
  const titulo = (/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? "").replace(/\s+/g, " ").trim().slice(0, 200);
  const texto = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|template|iframe)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<(br|\/p|\/div|\/li|\/tr|\/h[1-6])\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(amp|lt|gt|quot|nbsp|#39);/g, (m) => ENTIDADES[m] ?? m)
    .replace(/[ \t\f\v]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return { titulo, texto };
}

async function lerCorpoLimitado(r: Response): Promise<string> {
  if (!r.body) return "";
  const leitor = r.body.getReader();
  const dec = new TextDecoder("utf-8", { fatal: false });
  let total = 0, saida = "";
  for (;;) {
    const { done, value } = await leitor.read();
    if (done) break;
    total += value.length;
    if (total > MAX_BYTES) { await leitor.cancel().catch(() => {}); throw new IaErro(413, "A página é grande demais para leitura."); }
    saida += dec.decode(value, { stream: true });
  }
  return saida + dec.decode();
}

/** Lê UMA página pública. Cada redirecionamento é revalidado; só aceita HTML/texto; limita bytes e caracteres. */
export async function lerPagina(url: string, f: typeof fetch = fetch): Promise<PaginaLida> {
  let atual = url.trim();
  for (let salto = 0; salto <= MAX_REDIRECIONAMENTOS; salto++) {
    if (!urlLeituraSegura(atual)) throw new IaErro(400, "Endereço não permitido (use https público, sem usuário, senha ou porta).");
    let r: Response;
    try {
      r = await f(atual, { redirect: "manual", headers: { accept: "text/html,text/plain;q=0.9", "user-agent": "ConectaIA-Leitura/1.0" }, signal: AbortSignal.timeout(15_000) });
    } catch { throw new IaErro(504, "A página não respondeu a tempo."); }
    if (r.status >= 300 && r.status < 400) {
      const destino = r.headers.get("location");
      if (!destino) throw new IaErro(502, "Redirecionamento sem destino.");
      atual = new URL(destino, atual).toString();
      continue;
    }
    if (r.status === 404 || r.status === 410) throw new IaErro(404, "Página não encontrada.");
    if (r.status === 401 || r.status === 403) throw new IaErro(403, "A página exige login ou bloqueou a leitura. O Nano.ia não faz login em sites.");
    if (r.status === 429) throw new IaErro(429, "O site limitou as consultas. Tente depois.");
    if (!r.ok) throw new IaErro(502, "O site devolveu um erro.");
    const tipo = r.headers.get("content-type") ?? "";
    if (!TIPOS_ACEITOS.test(tipo)) throw new IaErro(415, "Tipo de conteúdo não suportado (só páginas HTML ou texto). Para PDF, anexe o arquivo na conversa.");
    const bruto = await lerCorpoLimitado(r);
    const { titulo, texto } = /html/i.test(tipo) ? htmlParaTexto(bruto) : { titulo: "", texto: bruto.trim() };
    return { url: atual, titulo, texto: texto.slice(0, MAX_TEXTO), lido_em: new Date().toISOString(), truncado: texto.length > MAX_TEXTO };
  }
  throw new IaErro(502, "Redirecionamentos demais.");
}

/** Busca na web pelo Google Programmable Search (mesma chave e mecanismo de Integrações). Só devolve título, endereço e trecho. */
export async function buscarWeb(chave: string, cx: string, consulta: string, f: typeof fetch = fetch, limite = 6): Promise<ResultadoWeb[]> {
  const url = new URL("https://www.googleapis.com/customsearch/v1");
  url.searchParams.set("key", chave); url.searchParams.set("cx", cx); url.searchParams.set("q", consulta.slice(0, 200));
  url.searchParams.set("num", String(Math.min(Math.max(limite, 1), 10))); url.searchParams.set("safe", "active");
  let r: Response;
  try { r = await f(url.toString(), { signal: AbortSignal.timeout(15_000) }); } catch { throw new IaErro(504, "A busca na web não respondeu a tempo."); }
  if (r.status === 401 || r.status === 403) throw new IaErro(401, "A chave de busca foi recusada. Confira a chave e o mecanismo de busca (cx).");
  if (r.status === 429) throw new IaErro(429, "O limite diário de buscas foi atingido. Tente amanhã ou aumente a cota no Google.");
  if (!r.ok) throw new IaErro(502, "A busca na web devolveu um erro.");
  const j = await r.json().catch(() => null) as { items?: { title?: string; link?: string; snippet?: string }[] } | null;
  return (j?.items ?? []).filter((i) => typeof i.link === "string" && urlLeituraSegura(i.link))
    .map((i) => ({ titulo: (i.title ?? "").slice(0, 160), url: i.link!, trecho: (i.snippet ?? "").replace(/\s+/g, " ").slice(0, 300) }));
}
