/** O domínio oficial da Mobis mostra a vitrine aprovada; outros clientes mantêm suas próprias lojas. */
export function lojaMobisPorHost(host: string | null): boolean {
  const normalizado = host?.toLowerCase().replace(/\.$/, "") ?? "";
  return normalizado === "mobisautopecas.com.br" || normalizado === "www.mobisautopecas.com.br";
}

/** Entrada explícita da administração; o App continua exigindo sessão e autorização. */
export function entradaAdministrativa(pathname: string): boolean {
  return pathname === "/conecta.html" || pathname === "/conecta-ia/conecta.html";
}

/**
 * No GitHub Pages as duas entradas moram na mesma pasta: `index.html` (loja Mobis, app "Mobis") e `conecta.html`
 * (painel do lojista, app "Conecta.IA"). Abrir uma rota do painel pela entrada da loja misturava os dois apps instalados.
 * Devolve o endereço de `conecta.html` quando a página aberta é a entrada da loja e a rota é do painel; senão, null (não mexe).
 * Só vale para o host do Pages: domínios de cliente e localhost não são redirecionados.
 */
export function destinoPainel(host: string, pathname: string, hash: string, search = ""): string | null {
  if (host !== "nanoconecta-ia.github.io") return null;
  const m = pathname.match(/^(\/conecta-ia\/)(?:index\.html)?$/);
  if (!m) return null; // já é conecta.html, ou outro caminho: não mexe
  const rota = hash.replace(/^#/, "") || "/";
  if (/^\/(?:loja|a|p|demo)(?:\/|$)/.test(rota)) return null; // vitrine, página de aplicação e produto público ficam na entrada da loja
  return `${m[1]}conecta.html${search}${hash}`;
}
