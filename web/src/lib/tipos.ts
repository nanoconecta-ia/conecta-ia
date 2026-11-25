export type Imagem = {
  id: string;
  url: string;
  ordem: number;
  tipo: "real" | "gerada_ia" | "ilustrativa";
  principal: boolean;
  aprovada: boolean;
};

export type Produto = {
  id: string;
  loja_id: string;
  bling_id: string;
  sku: string | null;
  nome: string | null;
  preco: number | null;
  estoque: number | null;
  situacao: string | null;
  categoria: string | null;
  marca: string | null;
  gtin: string | null;
  descricao: string | null;
  publicado: boolean;
  sincronizado_em: string;
};

/** Status da camada de enriquecimento (migração 20261014000002). */
export type StatusEnriquecimento = "a_confirmar" | "aprovado" | "desatualizado" | "rejeitado";

/**
 * Código do produto na camada de enriquecimento (produto_codigos).
 * Na vitrine pública só entra `status = 'aprovado'` (regra mestra: compatibilidade incerta não é anunciada).
 * Todo código aprovado carrega fonte + data (restrição CHECK no banco).
 */
export type ProdutoCodigo = {
  tipo: "sku" | "oem" | "fabricante" | "ean" | "similar" | "substituto" | "antigo";
  valor: string;
  fonte: string | null;
  coletado_em: string | null;
  confianca: number | null;
};

/**
 * Aplicação veicular aprovada (produto_aplicacoes). Só com relação técnica, fonte e data.
 * Nunca deduzida pelo nome do produto.
 */
export type ProdutoAplicacao = {
  modelo: string;
  motorizacao: string | null;
  ano_inicial: number | null;
  ano_final: number | null;
  fonte: string | null;
  coletado_em: string | null;
  confianca: number | null;
  // Página comercial independente por veículo (1 SKU → N páginas). Não cria produto no Bling.
  pagina_slug?: string | null;
  pagina_titulo?: string | null;
  pagina_descricao?: string | null;
  pagina_indexavel?: boolean;
};

/** Página de aplicação já carregada com o produto físico (SKU) por trás. */
export type PaginaAplicacao = {
  aplicacao: ProdutoAplicacao & { pagina_slug: string };
  produto: Produto;
  codigos: ProdutoCodigo[];
  imagem: Imagem | null;
};
