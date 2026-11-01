// Adaptador SearXNG para o contrato ProvedorBusca existente; somente leitura, sem persistencia.
// A instancia e seus segredos sao configurados APENAS no backend, e somente para lojas autorizadas.
import { BuscaErro, type Candidata, type ProvedorBusca, type ResultadoTecnico } from "./busca.ts";

export interface ConfigSearxng { baseUrl: string; token: string }
const LIMITE_RESPOSTA = 300_000;
const BLOQUEADOS = /(?:^localhost$|\.localhost$|\.local$|\.internal$|\.lan$|\.home$|\.corp$)/i;
const DADOS_PRIVADOS = /(?:\bcusto\b|\bmargem\b|\bfornecedor\b|\bcnpj\b|\bcpf\b|\bsenha\b|\btoken\b|\bchave\s+(?:api|secreta)\b|\bncm\b|\bcfop\b|\bcest\b|\btribut\w*\b|\bpre[cç]o\s+de\s+compra\b)/i;

function hostPublico(h: string): boolean {
  return h.includes(".") && !h.includes(":") && !/^\d+(?:\.\d+){3}$/.test(h) && !BLOQUEADOS.test(h);
}
function urlSegura(s: unknown): s is string {
  if (typeof s !== "string" || s.length > 2048) return false;
  try {
    const u = new URL(s);
    return u.protocol === "https:" && !u.username && !u.password &&
      (!u.port || u.port === "443") && hostPublico(u.hostname);
  } catch { return false; }
}
export function validarConfigSearxng(c: ConfigSearxng): ConfigSearxng {
  if (!urlSegura(c.baseUrl)) throw new BuscaErro(400, "recusada", "URL HTTPS publica do SearXNG invalida.");
  const u = new URL(c.baseUrl);
  if (u.pathname !== "/" || u.search || u.hash) throw new BuscaErro(400, "recusada", "Informe somente a origem HTTPS do SearXNG, sem caminho ou parametros.");
  if (!c.token || c.token.trim() !== c.token || /[\r\n]/.test(c.token) || c.token.length < 12 || c.token.length > 500)
    throw new BuscaErro(400, "recusada", "Token de acesso privado ao SearXNG ausente ou invalido.");
  return c;
}

/** Configuracao bloqueada por padrao: exige URL, token e allowlist EXPLICITA de lojas. */
export function configSearxngPorLoja(get: (n: string) => string | undefined, lojaId: string): ConfigSearxng | null {
  const permitidas = (get("SEARXNG_LOJAS_PERMITIDAS") ?? "").split(",").map((s) => s.trim());
  if (!permitidas.includes(lojaId) || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(lojaId)) return null;
  const baseUrl = get("SEARXNG_BASE_URL"), token = get("SEARXNG_BEARER_TOKEN");
  if (!baseUrl || !token) return null;
  return validarConfigSearxng({ baseUrl, token });
}
function consultaPublica(q: string): string {
  const s = typeof q === "string" ? q.trim().slice(0, 160) : "";
  if (s.length < 3 || DADOS_PRIVADOS.test(s))
    throw new BuscaErro(400, "recusada", "Consulta invalida ou contendo dado interno. Pesquise apenas referencia, fabricante e aplicacao publicos.");
  return s;
}
async function textoLimitado(r: Response): Promise<string> {
  const tamanho = Number(r.headers.get("content-length"));
  if (tamanho > LIMITE_RESPOSTA) throw new BuscaErro(502, "erro_provedor", "Resposta de busca excedeu o limite seguro.");
  if (!r.body) throw new BuscaErro(502, "erro_provedor", "Resposta vazia do buscador.");
  const leitor = r.body.getReader();
  const partes: Uint8Array[] = []; let total = 0;
  try {
    while (true) {
      const { done, value } = await leitor.read();
      if (done) break;
      total += value.byteLength;
      if (total > LIMITE_RESPOSTA) throw new BuscaErro(502, "erro_provedor", "Resposta de busca excedeu o limite seguro.");
      partes.push(value);
    }
  } finally { leitor.releaseLock(); }
  const bytes = new Uint8Array(total); let pos = 0;
  for (const p of partes) { bytes.set(p, pos); pos += p.length; }
  return new TextDecoder().decode(bytes);
}
type ResultadoSearxng = { title?: unknown; url?: unknown; img_src?: unknown; thumbnail_src?: unknown; content?: unknown };
function stringCurta(v: unknown, n: number): string { return typeof v === "string" ? v.slice(0, n) : ""; }

async function pesquisar(c: ConfigSearxng, consulta: string, categoria: "images" | "general", f: typeof fetch): Promise<ResultadoSearxng[]> {
  validarConfigSearxng(c);
  const u = new URL("/search", c.baseUrl);
  const body = new URLSearchParams({ q: consultaPublica(consulta), categories: categoria, format: "json", language: "pt-BR", safesearch: "2" });
  let r: Response;
  try {
    r = await f(u.toString(), {
      method: "POST", body,
      headers: { "Authorization": "Bearer " + c.token, "Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json" },
      signal: AbortSignal.timeout(10_000), redirect: "error",
    });
  } catch (e) {
    const motivo = e instanceof Error && /abort|timeout/i.test(e.name) ? "timeout" : "erro_provedor";
    throw new BuscaErro(motivo === "timeout" ? 504 : 502, motivo, motivo === "timeout" ? "Tempo limite da busca atingido." : "Nao foi possivel acessar o buscador configurado.");
  }
  if (r.status === 429) throw new BuscaErro(429, "limite", "Limite de buscas do SearXNG atingido.");
  if (r.status === 401) throw new BuscaErro(401, "credencial_invalida", "Acesso ao SearXNG nao autorizado.");
  if (r.status === 403) throw new BuscaErro(403, "api_indisponivel", "SearXNG recusou a chamada: verifique acesso e se format=json esta habilitado.");
  if (!r.ok) throw new BuscaErro(502, "erro_provedor", "Buscador indisponivel (HTTP " + r.status + ").");
  if (!(r.headers.get("content-type") ?? "").toLowerCase().includes("application/json"))
    throw new BuscaErro(502, "erro_provedor", "O buscador nao retornou JSON.");
  let dados: unknown;
  try { dados = JSON.parse(await textoLimitado(r)); }
  catch (e) { if (e instanceof BuscaErro) throw e; throw new BuscaErro(502, "erro_provedor", "JSON invalido retornado pelo buscador."); }
  if (!dados || typeof dados !== "object" || !Array.isArray((dados as { results?: unknown }).results))
    throw new BuscaErro(502, "erro_provedor", "Formato da resposta do buscador nao reconhecido.");
  return (dados as { results: ResultadoSearxng[] }).results.slice(0, 40);
}

export function provedorSearxng(config: ConfigSearxng, f: typeof fetch = fetch): ProvedorBusca {
  const c = validarConfigSearxng(config);
  return {
    id: "searxng-privado",
    async imagens(q, limite = 6): Promise<Candidata[]> {
      const lista = await pesquisar(c, q, "images", f);
      const usadas = new Set<string>(), saida: Candidata[] = [];
      for (const r of lista) {
        if (!urlSegura(r.img_src) || !urlSegura(r.url) || usadas.has(r.img_src)) continue;
        usadas.add(r.img_src);
        saida.push({
          titulo: stringCurta(r.title, 160),
          url: r.img_src,
          pagina: r.url,
          miniatura: urlSegura(r.thumbnail_src) ? r.thumbnail_src : null,
        });
        if (saida.length >= Math.min(Math.max(limite, 1), 10)) break;
      }
      return saida;
    },
    async tecnico(q, limite = 5): Promise<ResultadoTecnico[]> {
      const lista = await pesquisar(c, q, "general", f);
      const usadas = new Set<string>(), saida: ResultadoTecnico[] = [];
      for (const r of lista) {
        if (!urlSegura(r.url) || usadas.has(r.url)) continue;
        usadas.add(r.url);
        saida.push({ titulo: stringCurta(r.title, 180), pagina: r.url, resumo: stringCurta(r.content, 500), fonte: new URL(r.url).hostname });
        if (saida.length >= Math.min(Math.max(limite, 1), 10)) break;
      }
      return saida;
    },
  };
}
