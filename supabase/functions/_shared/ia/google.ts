// Busca de imagem na web (Google Programmable Search, modo imagem). Só devolve candidatas; nunca grava sozinho.
// Credencial por loja (BYOK, como o restante de Integrações de IA): chave de API + mecanismo de busca (cx).
import { IaErro } from "./tipos.ts";
import { BuscaErro, type Candidata, type ProvedorBusca, type ResultadoTecnico } from "./busca.ts";
export type { Candidata, ResultadoTecnico } from "./busca.ts";

/** Lê o corpo do erro do Google e diz o motivo REAL. 401/chave inválida ≠ 403 de API indisponível para a conta ≠ cota. */
export async function classificarErroGoogle(r: Response, o: "imagens" | "técnica"): Promise<BuscaErro> {
  const j = await r.json().catch(() => null) as { error?: { message?: string; errors?: { reason?: string }[]; status?: string } } | null;
  const msg = (j?.error?.message ?? "").toLowerCase();
  const razao = (j?.error?.errors?.[0]?.reason ?? j?.error?.status ?? "").toLowerCase();
  if (r.status === 429 || /dailylimit|ratelimit|quota/.test(razao) || /quota/.test(msg))
    return new BuscaErro(429, "limite", `O limite de buscas (${o}) foi atingido. Tente mais tarde.`);
  if (r.status === 401 || razao === "keyinvalid" || /api key not valid|key invalid/.test(msg))
    return new BuscaErro(401, "credencial_invalida", `A chave de busca (${o}) foi recusada: confira a chave e o mecanismo de busca (cx).`);
  if (r.status === 403 && (/does not have the access|has not been used|is disabled|accessnotconfigured|not enabled/.test(msg) || /accessnotconfigured/.test(razao)))
    return new BuscaErro(403, "api_indisponivel", `A API de busca do Google não está disponível para esta conta (encerrada para novos clientes desde 20/01/2026; clientes atuais até 01/01/2027). A chave pode estar certa: o problema é a API, não a digitação.`);
  if (r.status === 403)
    return new BuscaErro(403, "recusada", `O Google recusou a chamada (403) sem dizer o motivo. Pode ser chave inválida ou API indisponível para esta conta: não confirmado.`);
  return new BuscaErro(502, "erro_provedor", `A busca (${o}) devolveu um erro (HTTP ${r.status}).`);
}

export async function buscarImagens(chave: string, cx: string, consulta: string, f: typeof fetch = fetch, limite = 6): Promise<Candidata[]> {
  const url = new URL("https://www.googleapis.com/customsearch/v1");
  url.searchParams.set("key", chave); url.searchParams.set("cx", cx); url.searchParams.set("q", consulta.slice(0, 200));
  url.searchParams.set("searchType", "image"); url.searchParams.set("num", String(Math.min(Math.max(limite, 1), 10)));
  url.searchParams.set("safe", "active");
  let r: Response;
  try { r = await f(url.toString(), { signal: AbortSignal.timeout(15_000) }); } catch { throw new BuscaErro(504, "timeout", "A busca de imagens não respondeu a tempo."); }
  if (!r.ok) throw await classificarErroGoogle(r, "imagens");
  const j = await r.json().catch(() => null) as { items?: { title?: string; link?: string; image?: { contextLink?: string; thumbnailLink?: string } }[] } | null;
  return (j?.items ?? []).filter((i) => typeof i.link === "string" && i.link.startsWith("https://"))
    .map((i) => ({ titulo: (i.title ?? "").slice(0, 160), url: i.link!, miniatura: i.image?.thumbnailLink ?? null, pagina: i.image?.contextLink ?? "" }));
}

/** Pesquisa textual verificável usando a mesma chave/cx da busca de imagens.
 * Não baixa páginas, não acessa Bling e não envia dados de custo/fornecedor.
 * Os resultados são candidatos, nunca evidência definitiva de compatibilidade.
 */
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
  catch { throw new BuscaErro(504, "timeout", "A pesquisa técnica não respondeu a tempo."); }
  if (!r.ok) throw await classificarErroGoogle(r, "técnica");
  const j = await r.json().catch(() => null) as { items?: { title?: string; link?: string; snippet?: string; displayLink?: string }[] } | null;
  return (j?.items ?? []).filter(i => typeof i.link === "string" && /^https:\/\//i.test(i.link))
    .map(i => ({ titulo: (i.title ?? "").slice(0, 180), pagina: i.link!, resumo: (i.snippet ?? "").slice(0, 500), fonte: (i.displayLink ?? new URL(i.link!).hostname).slice(0, 160) }));
}

/** Adaptador LEGADO do Google para o contrato ProvedorBusca. Só deve ser usado em conta comprovadamente elegível. */
export function provedorGoogle(chave: string, cx: string, f: typeof fetch = fetch): ProvedorBusca {
  return { id: "google-legado", imagens: (q, n) => buscarImagens(chave, cx, q, f, n), tecnico: (q, n) => buscarDadosTecnicos(chave, cx, q, f, n) };
}
