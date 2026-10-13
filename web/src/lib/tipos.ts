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
