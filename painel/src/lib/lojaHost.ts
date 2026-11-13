/** O domínio oficial da Mobis mostra a vitrine aprovada; outros clientes mantêm suas próprias lojas. */
export function lojaMobisPorHost(host: string | null): boolean {
  const normalizado = host?.toLowerCase().replace(/\.$/, "") ?? "";
  return normalizado === "mobisautopecas.com.br" || normalizado === "www.mobisautopecas.com.br";
}

/** Entrada explícita da administração; o App continua exigindo sessão e autorização. */
export function entradaAdministrativa(pathname: string): boolean {
  return pathname === "/conecta.html" || pathname === "/conecta-ia/conecta.html";
}
