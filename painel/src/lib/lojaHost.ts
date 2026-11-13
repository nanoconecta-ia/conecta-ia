/** O domínio oficial da Mobis mostra a vitrine aprovada; outros clientes mantêm suas próprias lojas. */
export function lojaMobisPorHost(host: string | null): boolean {
  const normalizado = host?.toLowerCase().replace(/\.$/, "") ?? "";
  return normalizado === "mobisautopecas.com.br" || normalizado === "www.mobisautopecas.com.br";
}
