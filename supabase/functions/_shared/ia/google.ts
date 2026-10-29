// Busca de imagem na web (Google Programmable Search, modo imagem). Só devolve candidatas; nunca grava sozinho.
// Credencial por loja (BYOK, como o restante de Integrações de IA): chave de API + mecanismo de busca (cx).
import { IaErro } from "./tipos.ts";

export interface Candidata { titulo: string; url: string; miniatura: string | null; pagina: string }

export async function buscarImagens(chave: string, cx: string, consulta: string, f: typeof fetch = fetch, limite = 6): Promise<Candidata[]> {
  const url = new URL("https://www.googleapis.com/customsearch/v1");
  url.searchParams.set("key", chave); url.searchParams.set("cx", cx); url.searchParams.set("q", consulta.slice(0, 200));
  url.searchParams.set("searchType", "image"); url.searchParams.set("num", String(Math.min(Math.max(limite, 1), 10)));
  url.searchParams.set("safe", "active");
  let r: Response;
  try { r = await f(url.toString(), { signal: AbortSignal.timeout(15_000) }); } catch { throw new IaErro(504, "A busca de imagens não respondeu a tempo."); }
  if (r.status === 401 || r.status === 403) throw new IaErro(401, "A chave de busca de imagens foi recusada. Confira a chave e o mecanismo de busca (cx).");
  if (r.status === 429) throw new IaErro(429, "O limite diário de buscas de imagem foi atingido. Tente amanhã ou aumente a cota no Google.");
  if (!r.ok) throw new IaErro(502, "A busca de imagens devolveu um erro.");
  const j = await r.json().catch(() => null) as { items?: { title?: string; link?: string; image?: { contextLink?: string; thumbnailLink?: string } }[] } | null;
  return (j?.items ?? []).filter((i) => typeof i.link === "string" && i.link.startsWith("https://"))
    .map((i) => ({ titulo: (i.title ?? "").slice(0, 160), url: i.link!, miniatura: i.image?.thumbnailLink ?? null, pagina: i.image?.contextLink ?? "" }));
}

/** Pesquisa textual verificável usando a mesma chave/cx da busca de imagens.
 * Não baixa páginas, não acessa Bling e não envia dados de custo/fornecedor.
 * Os resultados são candidatos, nunca evidência definitiva de compatibilidade.
 */
export interface ResultadoTecnico { titulo: string; pagina: string; resumo: string; fonte: string }
export async function buscarDadosTecnicos(chave: string, cx: string, consulta: string, f: typeof fetch = fetch, limite = 5): Promise<ResultadoTecnico[]> {
  const q = consulta.trim().slice(0, 160);
  if (q.length < 3) throw new IaErro(400, "Informe SKU ou referência técnica com pelo menos 3 caracteres.");
  const url = new URL("https://www.googleapis.com/customsearch/v1");
  url.searchParams.set("key", chave);
  url.searchParams.set("cx", cx);
  url.searchParams.set("q", q);
  url.searchParams.set("num", String(Math.min(Math.max(limite, 1), 10)));
  url.searchParams.set("safe", "active");
  let r: Response;
  try { r = await f(url.toString(), { signal: AbortSignal.timeout(15_000) }); }
  catch { throw new IaErro(504, "A pesquisa técnica não respondeu a tempo."); }
  if (r.status === 401 || r.status === 403) throw new IaErro(401, "Credencial de pesquisa recusada. Verifique Google API Key e CX.");
  if (r.status === 429) throw new IaErro(429, "Limite de pesquisas atingido.");
  if (!r.ok) throw new IaErro(502, "Erro ao consultar pesquisa técnica.");
  const j = await r.json().catch(() => null) as { items?: { title?: string; link?: string; snippet?: string; displayLink?: string }[] } | null;
  return (j?.items ?? []).filter(i => typeof i.link === "string" && /^https:\/\//i.test(i.link))
    .map(i => ({ titulo: (i.title ?? "").slice(0, 180), pagina: i.link!, resumo: (i.snippet ?? "").slice(0, 500), fonte: (i.displayLink ?? new URL(i.link!).hostname).slice(0, 160) }));
}
