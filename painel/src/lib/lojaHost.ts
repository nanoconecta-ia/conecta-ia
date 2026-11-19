/** O domínio oficial da Mobis mostra a vitrine aprovada; outros clientes mantêm suas próprias lojas. */
export const URL_LOJA_MOBIS = "https://www.mobisautopecas.com.br/";
export function lojaMobisPorHost(host: string | null): boolean {
  const normalizado = host?.toLowerCase().replace(/\.$/, "") ?? "";
  return normalizado === "mobisautopecas.com.br" || normalizado === "www.mobisautopecas.com.br";
}

/** Entrada explícita da administração; o App continua exigindo sessão e autorização. */
export function entradaAdministrativa(pathname: string): boolean {
  return pathname === "/conecta.html" || pathname === "/conecta-ia/conecta.html";
}

/** Sempre abre a LOJA pública, não uma rota hash dentro do app instalado Conecta.IA. */
export function urlLojaPublica(slug: string, urlPainel: string): string {
  if (slug === "mobis") return URL_LOJA_MOBIS;
  const url = new URL("./", urlPainel);
  url.hash = "/loja/" + encodeURIComponent(slug);
  return url.toString();
}

/** Abre a ficha SOMENTE da peça já publicada na vitrine, nunca uma rota interna do Conecta.IA. */
export function urlProdutoPublico(slug: string, sku: string, urlPainel: string): string {
  const url = new URL(urlLojaPublica(slug, urlPainel));
  url.hash = "/p/" + encodeURIComponent(slug) + "/" + encodeURIComponent(sku);
  return url.toString();
}

/**
 * Se uma rota interna do painel foi aberta pelo atalho da loja, direciona para o app
 * administrativo. A raiz SEM hash continua sendo sempre a vitrine, inclusive no Pages.
 * As rotas públicas /loja, /a e /p nunca redirecionam para a administração.
 */
export function destinoPainel(host: string, pathname: string, hash: string, search = ""): string | null {
  const raizPages = host === "nanoconecta-ia.github.io"
    ? pathname.match(/^(\/conecta-ia\/)(?:index\.html)?$/)?.[1]
    : null;
  // A URL pública oficial NUNCA pode redirecionar para o painel, nem com hash legado.
  // Entradas administrativas devem usar /conecta.html explicitamente.
  const raiz = raizPages;
  if (!raiz || !hash || hash === "#" || hash === "#/") return null;
  const rota = hash.replace(/^#/, "") || "/";
  if (/^\/(?:loja|a|p|demo)(?:\/|$)/.test(rota)) return null;
  return `${raiz}conecta.html${search}${hash}`;
}
