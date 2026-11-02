// Evidência estruturada e leitura de fonte com FALHA FECHADA (PR #242, requisitos 5-6; testes de aceite 8 e 12). Pura: sem rede nem relógio (a data entra por parâmetro).
// O QUE PROVA: uma evidência só vale com URL https, trecho que CONTÉM o código exato, código que é do produto, data válida e hash do trecho; marketplace nunca prova
// compatibilidade sozinho (só descoberta); resposta 429/5xx, vazia, HTML quando se esperava JSON ou grande demais NÃO vira dado: vira "indisponível", sem inventar.
// O QUE NÃO PROVA: que a página diz a verdade (a pessoa aprova na Fila) nem que a peça serve no veículo (isso exige aplicação, em regras_aplicacao).
/** Hierarquia de evidência (especificação 02/11/2026): 1 catálogo técnico oficial do fabricante; 2 documentação/catálogo de peças genuínas da montadora; 3 documentação técnica de
 *  distribuidor autorizado; 4 referência cruzada com procedência identificada; 5 anúncio/marketplace (só pista). `outra` = não classificada (também só pista). */
export type ClasseFonte = "fabricante_oficial" | "montadora_oficial" | "distribuidor_b2b" | "referencia_cruzada" | "marketplace" | "outra";
/** Menor número = mais confiável. Referência cruzada, marketplace e não classificada nunca provam sozinhas. */
export const PRIORIDADE: Readonly<Record<ClasseFonte, number>> = { fabricante_oficial: 1, montadora_oficial: 2, distribuidor_b2b: 3, referencia_cruzada: 4, marketplace: 5, outra: 6 };

export interface EvidenciaBusca {
  url: string; titulo: string; editor?: string | null; coletada_em: string; trecho: string; codigo_exato: string;
  contexto_aplicacao?: string | null; sha256: string; classe: ClasseFonte;
  /** Opcional e NUNCA usado para decidir: porcentagem não substitui evidência técnica. */
  confianca?: number | null;
  licenca_imagem?: "desconhecida" | "propria" | "fornecedor" | "fabricante" | "publica_web" | "licenciada" | null;
}
export interface AlvoEvidencia { codigos: string[] }
export type NivelEvidencia = "forte" | "descoberta" | "rejeitada";
export interface ResultadoEvidencia { ok: boolean; nivel: NivelEvidencia; bloqueios: string[]; avisos: string[] }

/** Domínios que o projeto trata como marketplace. Lista de heurística: o que não está aqui NÃO vira "fabricante" sozinho (a classe oficial vem de dado do cadastro). */
const MARKETPLACES = ["mercadolivre.com.br", "mercadolibre.com", "amazon.com.br", "amazon.com", "shopee.com.br", "olx.com.br", "aliexpress.com", "magazineluiza.com.br", "americanas.com.br"];
export function classeDaFonte(url: string, dominiosConhecidos: Readonly<Record<string, ClasseFonte>> = {}): ClasseFonte {
  let host = "";
  try { host = new URL(url).hostname.toLowerCase().replace(/^www\./, ""); } catch { return "outra"; }
  for (const [d, c] of Object.entries(dominiosConhecidos)) if (host === d || host.endsWith("." + d)) return c;
  return MARKETPLACES.some((m) => host === m || host.endsWith("." + m)) ? "marketplace" : "outra";
}

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "");
const dataValida = (d: string) => /^\d{4}-\d{2}-\d{2}/.test(d) && !Number.isNaN(Date.parse(d));

export function validarEvidencia(ev: EvidenciaBusca, alvo: AlvoEvidencia, hoje: string): ResultadoEvidencia {
  const b: string[] = [], a: string[] = [];
  if (!/^https:\/\/[^\s]+$/i.test(ev.url ?? "")) b.push("URL da fonte não é https");
  if (!ev.titulo?.trim()) b.push("título da fonte ausente");
  if (!dataValida(ev.coletada_em ?? "")) b.push("data de coleta inválida");
  else if (ev.coletada_em.slice(0, 10) > hoje.slice(0, 10)) b.push("data de coleta no futuro");
  if (!/^[0-9a-f]{64}$/i.test(ev.sha256 ?? "")) b.push("hash do trecho ausente ou inválido");
  const codigo = norm(ev.codigo_exato ?? "");
  if (!codigo) b.push("código exato ausente");
  else {
    if (!alvo.codigos.some((c) => norm(c) === codigo)) b.push(`o código "${ev.codigo_exato}" não é um código conhecido do produto`);
    // código literal no trecho, em fronteira de palavra; separadores (hífen, espaço, ponto, sublinhado) valem como a mesma grafia: "JC-1234" = "JC 1234" = "JC1234",
    // mas "JC-1234" NÃO vale dentro de "JC-12345".
    const partes = ev.codigo_exato.split(/[^A-Za-z0-9]+/).filter(Boolean).map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    const re = new RegExp(`(^|[^A-Za-z0-9])${partes.join("[\\s_.-]*")}($|[^A-Za-z0-9])`, "i");
    if (!partes.length || !re.test(ev.trecho ?? "")) b.push("o trecho não contém o código exato (não há prova de que a página trata deste código)");
  }
  if (ev.confianca != null && !(ev.confianca >= 0 && ev.confianca <= 1)) b.push("confiança fora de 0 a 1");
  if (b.length) return { ok: false, nivel: "rejeitada", bloqueios: b, avisos: a };
  if (ev.classe === "marketplace" || ev.classe === "outra" || ev.classe === "referencia_cruzada") {
    a.push(ev.classe === "marketplace" ? "marketplace: serve para descobrir, não prova compatibilidade nem dá direito de uso da imagem"
      : ev.classe === "referencia_cruzada" ? "referência cruzada: indício com procedência, não prova de equivalência nem de aplicação" : "fonte não classificada: só descoberta");
    return { ok: true, nivel: "descoberta", bloqueios: b, avisos: a };
  }
  if (!ev.contexto_aplicacao?.trim()) a.push("sem contexto de aplicação: prova o código, não o veículo");
  return { ok: true, nivel: "forte", bloqueios: b, avisos: a };
}

/** Compatibilidade só com evidência forte que traga o CONTEXTO de aplicação. Marketplace e fontes de descoberta nunca bastam. */
export function provaCompatibilidade(evs: EvidenciaBusca[], alvo: AlvoEvidencia, hoje: string): { prova: boolean; motivo: string } {
  const fortes = evs.filter((e) => { const r = validarEvidencia(e, alvo, hoje); return r.nivel === "forte" && !!e.contexto_aplicacao?.trim(); });
  if (fortes.length === 0) return { prova: false, motivo: evs.some((e) => e.classe === "marketplace") ? "só há marketplace ou fonte sem contexto de aplicação: pista, não prova" : "sem evidência forte com contexto de aplicação" };
  return { prova: true, motivo: `${fortes.length} evidência(s) forte(s) com contexto de aplicação` };
}
export const melhorFonte = (evs: EvidenciaBusca[]) => [...evs].sort((x, y) => PRIORIDADE[x.classe] - PRIORIDADE[y.classe] || x.url.localeCompare(y.url))[0] ?? null;

export async function hashTrecho(trecho: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(trecho));
  return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

// ── Leitura de fonte: falha fechada
export type MotivoFalha = "indisponivel" | "limite_de_requisicoes" | "formato_inesperado" | "vazia" | "grande_demais" | "bloqueada";
export type LeituraFonte = { ok: true; texto: string } | { ok: false; motivo: MotivoFalha; detalhe: string };
const LIMITE_BYTES = 2_000_000;
export function lerRespostaFonte(r: { status: number; contentType?: string | null; corpo: string | null }, esperado: "json" | "html" = "json"): LeituraFonte {
  if (r.status === 429) return { ok: false, motivo: "limite_de_requisicoes", detalhe: "a fonte limitou as requisições (429); nada foi inferido" };
  if (r.status === 401 || r.status === 403) return { ok: false, motivo: "bloqueada", detalhe: `a fonte recusou o acesso (${r.status}); não contornar` };
  if (r.status < 200 || r.status >= 300) return { ok: false, motivo: "indisponivel", detalhe: `a fonte respondeu ${r.status}; nada foi inferido` };
  const corpo = r.corpo ?? "";
  if (!corpo.trim()) return { ok: false, motivo: "vazia", detalhe: "resposta vazia" };
  if (corpo.length > LIMITE_BYTES) return { ok: false, motivo: "grande_demais", detalhe: "resposta maior que o limite" };
  const tipo = (r.contentType ?? "").toLowerCase();
  if (esperado === "json") {
    if (/html/.test(tipo) || /^\s*<(!doctype|html|head|body)/i.test(corpo)) return { ok: false, motivo: "formato_inesperado", detalhe: "veio HTML onde se esperava JSON" };
    try { JSON.parse(corpo); } catch { return { ok: false, motivo: "formato_inesperado", detalhe: "JSON inválido" }; }
  } else if (!/html|text/.test(tipo) && !/^\s*</.test(corpo)) return { ok: false, motivo: "formato_inesperado", detalhe: "não parece uma página" };
  return { ok: true, texto: corpo };
}

/** Cache com validade por fonte. Resultado vencido ou lido offline é marcado "possivelmente desatualizado", nunca apresentado como atual. */
export function situacaoDoCache(coletadaEm: string, agora: string, ttlHoras: number): { valido: boolean; desatualizado: boolean; idade_horas: number } {
  const idade = (Date.parse(agora) - Date.parse(coletadaEm)) / 3_600_000;
  if (!Number.isFinite(idade) || idade < 0) return { valido: false, desatualizado: true, idade_horas: NaN };
  return { valido: idade <= ttlHoras, desatualizado: idade > ttlHoras, idade_horas: Math.round(idade * 10) / 10 };
}
