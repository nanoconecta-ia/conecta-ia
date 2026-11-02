// Política de DOMÍNIOS e ORIGEM PÚBLICA (regra do dono, 02/11/2026). Pura.
// REGRA: (1) O domínio e a página do FABRICANTE da marca do próprio produto podem aparecer na descrição como ORIGEM, porque quem fabrica responde pela garantia
// (Código de Defesa do Consumidor, segundo o dono). (2) Domínio de OUTRA marca, concorrente, distribuidor ou marketplace fica só como REFERÊNCIA TÉCNICA na base do produto,
// nunca na descrição pública nem no site: "não fazemos propaganda para a concorrência".
// O QUE PROVA: só vira origem pública se o domínio está cadastrado e VERIFICADO por uma pessoa como de fabricante/montadora, a marca do produto é uma das marcas dessa entidade
// e o código do produto está confirmado na página. O QUE NÃO PROVA: que a página está correta nem a garantia em si.
export type TipoEntidade = "fabricante" | "montadora" | "distribuidor" | "outro";
export interface DominioCadastrado { dominio: string; entidade: string; /** marcas que esta entidade fabrica */ marcas: string[]; tipo: TipoEntidade; status: "verificado" | "nao_verificado" }
export type PapelDominio = "origem_do_fabricante" | "referencia_tecnica";
export interface DecisaoDominio { papel: PapelDominio; publico: boolean; host: string; motivo: string }

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
export function hostDe(url: string): string { try { return new URL(url).hostname.toLowerCase().replace(/^www\./, ""); } catch { return ""; } }
/** A URL de origem sem rastreadores (query e fragmento). Só https. */
export function urlLimpa(url: string): string | null {
  try { const u = new URL(url); if (u.protocol !== "https:") return null; u.search = ""; u.hash = ""; return u.toString(); } catch { return null; }
}
/** "TRIM GO AUTOPARTS" casa com a marca cadastrada "TRIM GO"; "SABO" casa com "Sabó"; marca diferente nunca casa. */
export function marcaDaEntidade(marcaDoProduto: string, marcas: string[]): boolean {
  const p = norm(marcaDoProduto);
  return !!p && marcas.some((m) => { const a = norm(m); return !!a && (p === a || p.startsWith(a + " ")); });
}
const doRegistro = (host: string, registro: readonly DominioCadastrado[]) => registro.find((d) => { const x = d.dominio.toLowerCase().replace(/^www\./, ""); return host === x || host.endsWith("." + x); });

export function decidirDominio(urlPagina: string, marcaDoProduto: string, registro: readonly DominioCadastrado[], codigoConfirmadoNaPagina: boolean): DecisaoDominio {
  const host = hostDe(urlPagina), tecnica = (motivo: string): DecisaoDominio => ({ papel: "referencia_tecnica", publico: false, host, motivo });
  if (!host || !urlLimpa(urlPagina)) return tecnica("URL inválida ou não https");
  const d = doRegistro(host, registro);
  if (!d) return tecnica("domínio não cadastrado: fica só como referência técnica interna");
  if (d.status !== "verificado") return tecnica("domínio ainda não verificado por uma pessoa");
  if (d.tipo !== "fabricante" && d.tipo !== "montadora") return tecnica(`domínio de ${d.tipo}: não é o fabricante que responde pela garantia`);
  if (!marcaDaEntidade(marcaDoProduto, d.marcas)) return tecnica(`${d.entidade} não é o fabricante da marca deste produto (${marcaDoProduto}): referência técnica, sem propaganda`);
  if (!codigoConfirmadoNaPagina) return tecnica("o código do produto não foi confirmado nesta página");
  return { papel: "origem_do_fabricante", publico: true, host, motivo: `${d.entidade} fabrica a marca ${marcaDoProduto} e a página confirma o código` };
}

/** Frase de origem para a descrição pública. Só existe quando a decisão é pública; usa a URL sem rastreadores. */
export function textoDeOrigem(marcaDoProduto: string, urlPagina: string, decisao: DecisaoDominio): string | null {
  if (!decisao.publico) return null;
  const u = urlLimpa(urlPagina); if (!u) return null;
  return `Fabricante: ${marcaDoProduto.trim()}. Origem e garantia do fabricante: ${u}`;
}

export interface ReferenciaEntrada { url: string; codigoConfirmado: boolean; titulo?: string }
/** Separa as referências do produto: no máximo UMA origem pública (a do fabricante da marca) e o resto como referência técnica interna (sem link público). */
export function separarReferencias(refs: readonly ReferenciaEntrada[], marcaDoProduto: string, registro: readonly DominioCadastrado[]) {
  const publicas: { host: string; url: string; texto: string }[] = [], internas: { host: string; url: string; motivo: string }[] = [];
  for (const r of refs) {
    const d = decidirDominio(r.url, marcaDoProduto, registro, r.codigoConfirmado);
    const texto = textoDeOrigem(marcaDoProduto, r.url, d);
    if (texto && publicas.length === 0) publicas.push({ host: d.host, url: urlLimpa(r.url)!, texto });
    else internas.push({ host: d.host || "origem inválida", url: urlLimpa(r.url) ?? r.url, motivo: texto ? "já existe uma origem pública do fabricante" : d.motivo });
  }
  return { publicas, internas };
}
