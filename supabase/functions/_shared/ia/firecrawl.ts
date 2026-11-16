// Adaptador Firecrawl para o contrato ProvedorBusca existente. Somente leitura, sem persistência de conteúdo.
// A chave é DA LOJA: o responsável cola em Integrações de IA, é cifrada no servidor (cripto.ts) e nunca volta ao navegador.
// O retorno é sempre CANDIDATO a conferir: não prova aplicação, OEM, GTIN, medida nem direito de uso de imagem.
// Controle de custo: cada busca consome crédito do Firecrawl da loja; o limite mensal de buscas é aplicado ANTES da chamada.
import { BuscaErro, type Candidata, type ProvedorBusca, type ResultadoTecnico } from "./busca.ts";
import { consultaPublica, urlSegura } from "./searxng.ts";

export interface ConfigFirecrawl {
  chave: string;
  /** Buscas ainda permitidas no mês. Ausente = sem limite local (o Firecrawl ainda limita pelos créditos da conta). */
  restante?: number;
  /** Chamado após cada busca que chegou ao Firecrawl (conta uso mensal). Falha aqui nunca derruba a pesquisa. */
  registrarUso?: (buscas: number) => Promise<void>;
}

export const URL_FIRECRAWL = "https://api.firecrawl.dev/v2/search";
const LIMITE_RESPOSTA = 400_000;
const FORMATO_CHAVE = /^fc-[A-Za-z0-9_-]{16,200}$/;

/** Confere só o formato (a validade real vem do teste). Nunca devolve a chave. */
export function chaveFirecrawlValida(chave: unknown): chave is string {
  return typeof chave === "string" && FORMATO_CHAVE.test(chave);
}

const curta = (v: unknown, n: number): string => (typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, n) : "");

async function textoLimitado(r: Response): Promise<string> {
  const tamanho = Number(r.headers.get("content-length"));
  if (tamanho > LIMITE_RESPOSTA) throw new BuscaErro(502, "erro_provedor", "Resposta do Firecrawl excedeu o limite seguro.");
  if (!r.body) throw new BuscaErro(502, "erro_provedor", "Resposta vazia do Firecrawl.");
  const leitor = r.body.getReader();
  const partes: Uint8Array[] = []; let total = 0;
  try {
    while (true) {
      const { done, value } = await leitor.read();
      if (done) break;
      total += value.byteLength;
      if (total > LIMITE_RESPOSTA) throw new BuscaErro(502, "erro_provedor", "Resposta do Firecrawl excedeu o limite seguro.");
      partes.push(value);
    }
  } finally { leitor.releaseLock(); }
  const bytes = new Uint8Array(total); let pos = 0;
  for (const p of partes) { bytes.set(p, pos); pos += p.length; }
  return new TextDecoder().decode(bytes);
}

type Item = { title?: unknown; url?: unknown; description?: unknown; snippet?: unknown; imageUrl?: unknown };
interface Dados { web: Item[]; images: Item[] }

async function buscar(c: ConfigFirecrawl, consulta: string, tipo: "web" | "images", limite: number, f: typeof fetch): Promise<Dados> {
  if (!chaveFirecrawlValida(c.chave)) throw new BuscaErro(401, "credencial_invalida", "A chave do Firecrawl desta loja é inválida. Cole a chave novamente em Integrações de IA.");
  const q = consultaPublica(consulta); // recusa custo, fornecedor, dado fiscal ou pessoal
  if (typeof c.restante === "number" && c.restante <= 0)
    throw new BuscaErro(429, "limite", "O limite mensal de buscas da loja foi atingido. Ajuste o limite em Integrações de IA ou aguarde o próximo mês.");
  let r: Response;
  try {
    r = await f(URL_FIRECRAWL, {
      method: "POST",
      headers: { "Authorization": "Bearer " + c.chave, "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ query: q, limit: Math.min(Math.max(limite, 1), 10), sources: [{ type: tipo }], country: "BR", safe: true, timeout: 20000 }),
      signal: AbortSignal.timeout(25_000), redirect: "error",
    });
  } catch (e) {
    const timeout = e instanceof Error && /abort|timeout/i.test(e.name);
    throw new BuscaErro(timeout ? 504 : 502, timeout ? "timeout" : "erro_provedor", timeout ? "Tempo limite da busca atingido." : "Não foi possível acessar o Firecrawl.");
  }
  // A chamada chegou ao provedor: conta a busca (mesmo se a resposta for erro de conteúdo). Falha de contagem não bloqueia.
  if (typeof c.restante === "number") c.restante -= 1; // vários usos na mesma conversa respeitam o limite sem reler o banco
  try { await c.registrarUso?.(1); } catch { /* contagem é best-effort */ }
  if (r.status === 401) throw new BuscaErro(401, "credencial_invalida", "O Firecrawl recusou a chave desta loja. Cole uma chave válida em Integrações de IA.");
  if (r.status === 402) throw new BuscaErro(402, "limite", "Os créditos do Firecrawl desta conta acabaram. Recarregue no painel do Firecrawl.");
  if (r.status === 429) throw new BuscaErro(429, "limite", "Limite de buscas do Firecrawl atingido. Tente novamente em instantes.");
  if (!r.ok) throw new BuscaErro(502, "erro_provedor", "Firecrawl indisponível (HTTP " + r.status + ").");
  if (!(r.headers.get("content-type") ?? "").toLowerCase().includes("application/json")) throw new BuscaErro(502, "erro_provedor", "O Firecrawl não retornou JSON.");
  let corpo: unknown;
  try { corpo = JSON.parse(await textoLimitado(r)); }
  catch (e) { if (e instanceof BuscaErro) throw e; throw new BuscaErro(502, "erro_provedor", "JSON inválido retornado pelo Firecrawl."); }
  const b = corpo as { success?: unknown; data?: unknown };
  if (!b || typeof b !== "object" || b.success === false || !b.data || typeof b.data !== "object")
    throw new BuscaErro(502, "erro_provedor", "Formato da resposta do Firecrawl não reconhecido.");
  const d = b.data as { web?: unknown; images?: unknown };
  const lista = (v: unknown): Item[] => (Array.isArray(v) ? (v as Item[]).slice(0, 40) : []);
  return { web: Array.isArray(b.data) ? lista(b.data) : lista(d.web), images: lista(d.images) };
}

export function provedorFirecrawl(config: ConfigFirecrawl, f: typeof fetch = fetch): ProvedorBusca {
  return {
    id: "firecrawl",
    async imagens(q, limite = 6): Promise<Candidata[]> {
      const { images } = await buscar(config, q, "images", Math.max(limite, 1) * 2, f);
      const usadas = new Set<string>(), saida: Candidata[] = [];
      for (const r of images) {
        if (!urlSegura(r.imageUrl) || !urlSegura(r.url) || usadas.has(r.imageUrl)) continue; // sem https ou sem página de origem: descarta
        usadas.add(r.imageUrl);
        saida.push({ titulo: curta(r.title, 160), url: r.imageUrl, pagina: r.url, miniatura: null });
        if (saida.length >= Math.min(Math.max(limite, 1), 10)) break;
      }
      return saida;
    },
    async tecnico(q, limite = 5): Promise<ResultadoTecnico[]> {
      const { web } = await buscar(config, q, "web", Math.max(limite, 1) * 2, f);
      const usadas = new Set<string>(), saida: ResultadoTecnico[] = [];
      for (const r of web) {
        if (!urlSegura(r.url) || usadas.has(r.url)) continue;
        usadas.add(r.url);
        saida.push({ titulo: curta(r.title, 180), pagina: r.url, resumo: curta(r.description ?? r.snippet, 500), fonte: new URL(r.url).hostname });
        if (saida.length >= Math.min(Math.max(limite, 1), 10)) break;
      }
      return saida;
    },
  };
}

/** Teste de credencial usado pelo painel: uma busca mínima. Devolve só ok/erro legível, nunca a chave. */
export async function testarFirecrawl(chave: string, f: typeof fetch = fetch): Promise<{ ok: true } | { ok: false; erro: string; motivo: string }> {
  try { await buscar({ chave }, "bomba dagua hyundai hr", "web", 1, f); return { ok: true }; }
  catch (e) { return e instanceof BuscaErro ? { ok: false, erro: e.message, motivo: e.motivo } : { ok: false, erro: "Falha ao testar a chave.", motivo: "erro_provedor" }; }
}

/** Monta a configuração da loja a partir das RPCs. Nunca derruba o chat: qualquer falha desliga só a pesquisa. */
export async function configFirecrawlDaLoja(
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>,
  lojaId: string,
  decifrar: (cifrada: string) => Promise<string>,
): Promise<ConfigFirecrawl | null> {
  try {
    const { data, error } = await rpc("busca_firecrawl_ler", { p_loja: lojaId });
    const k = (data as { chave_cifrada: string; limite_mensal: number | null; buscas_mes: number }[] | null)?.[0];
    if (error || !k?.chave_cifrada) return null;
    const chave = await decifrar(k.chave_cifrada);
    if (!chaveFirecrawlValida(chave)) return null;
    return {
      chave,
      restante: k.limite_mensal == null ? undefined : Math.max(k.limite_mensal - k.buscas_mes, 0),
      registrarUso: async (n) => { await rpc("busca_firecrawl_registrar", { p_loja: lojaId, p_buscas: n }); },
    };
  } catch { return null; }
}
