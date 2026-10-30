/** Diagnóstico somente leitura do espelho: nenhum campo é completado por inferência da IA. */
export interface ProdutoEspelho {
  id: string;
  sku: string | null;
  nome: string | null;
  marca: string | null;
  gtin: string | null;
  descricao_curta: string | null;
  peso_kg: number | null;
  largura_cm: number | null;
  altura_cm: number | null;
  profundidade_cm: number | null;
  taxonomia_no_id: string | null;
  publicado: boolean | null;
  situacao: string | null;
}

export interface NoTaxonomia { id: string; status: string | null }
const ausente = (s: string | null | undefined) => !s?.trim();
const medidaInvalida = (n: number | null | undefined) => n == null || !Number.isFinite(n) || n <= 0;

export function pendenciasProduto(p: ProdutoEspelho): string[] {
  const falta: string[] = [];
  if (ausente(p.sku)) falta.push("SKU");
  if (ausente(p.marca)) falta.push("Marca");
  if (ausente(p.descricao_curta)) falta.push("Descrição");
  if (!p.taxonomia_no_id) falta.push("Taxonomia");
  if ([p.peso_kg, p.largura_cm, p.altura_cm, p.profundidade_cm].some(medidaInvalida)) falta.push("Logística");
  // GTIN pode não existir para determinada peça: jamais gerar código fictício.
  return falta;
}

export function diagnosticoCatalogo(produtos: ProdutoEspelho[], nos: NoTaxonomia[]) {
  return {
    analisados: produtos.length,
    semMarca: produtos.filter((p) => ausente(p.marca)).length,
    logisticaIncompleta: produtos.filter((p) => [p.peso_kg, p.largura_cm, p.altura_cm, p.profundidade_cm].some(medidaInvalida)).length,
    semTaxonomia: produtos.filter((p) => !p.taxonomia_no_id).length,
    publicados: produtos.filter((p) => p.publicado === true).length,
    comPendencias: produtos.filter((p) => pendenciasProduto(p).length > 0).length,
    nosPropostos: nos.filter((n) => n.status === "proposto").length,
    nosTotais: nos.length,
  };
}

export function buscarProdutosPendentes(produtos: ProdutoEspelho[], termo: string, soPendentes: boolean): ProdutoEspelho[] {
  const normalizar = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
  const q = normalizar(termo.trim());
  return produtos.filter((p) =>
    (!soPendentes || pendenciasProduto(p).length > 0) &&
    (!q || normalizar([p.nome ?? "", p.sku ?? "", p.marca ?? ""].join(" ")).includes(q))
  );
}
