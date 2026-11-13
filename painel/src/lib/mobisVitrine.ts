/** Uma amostra visual nunca substitui catálogo aprovado nem aparece por falta de resposta. */
export function podeExibirProdutoTeste(loja?: { slug: string; ambiente?: string; venda_habilitada?: boolean } | null): boolean {
  return loja?.slug === "mobis" && loja.ambiente === "teste" && loja.venda_habilitada === false;
}

/** Preserva o valor canônico que o servidor usa no filtro de aplicações. */
export function modeloDoAtalho(atalho: string, modelos: readonly string[]): string {
  if (!atalho) return "";
  const normalizar = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const alvo = normalizar(atalho);
  const exato = modelos.find(m => normalizar(m) === alvo);
  if (exato) return exato;
  const candidatos = modelos.filter(m => normalizar(m).split(/[^a-z0-9]+/).includes(alvo));
  return candidatos.length === 1 ? candidatos[0] : "";
}
