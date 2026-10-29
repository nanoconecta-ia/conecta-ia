/** Busca somente sobre o lote já lido do espelho Bling; nunca consulta fornecedores ou inventa referências. */
export type ProdutoBuscavel = { sku: string | null; nome: string | null; marca: string | null; gtin: string | null };
const normalizar = (texto: string) => texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim();
export function pesquisarProdutos<T extends ProdutoBuscavel>(produtos: readonly T[], busca: string): T[] {
  const termos = normalizar(busca.slice(0, 100)).split(/\s+/).filter(Boolean);
  if (!termos.length) return [...produtos];
  return produtos.filter(p => {
    const campos = [p.sku, p.nome, p.marca, p.gtin].map(v => normalizar(v ?? ""));
    return termos.every(termo => campos.some(valor => valor.includes(termo)));
  });
}
/** Estes números são do lote carregado, não do estoque total do ERP. */
export function resumoDoLote(produtos: readonly { publicado: boolean; situacao: string | null; imagens: number }[]) {
  return {
    carregados: produtos.length,
    publicados: produtos.filter(p => p.publicado).length,
    inativos: produtos.filter(p => p.situacao !== "A").length,
    semImagem: produtos.filter(p => p.imagens === 0).length,
  };
}
