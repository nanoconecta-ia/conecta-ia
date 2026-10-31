// Mapa da tela "Cadastro de produto" do Bling — versão 0, A CONFIRMAR.
// Os rótulos abaixo são HIPÓTESES de como os campos podem se chamar (sinônimos comuns em ERPs brasileiros). Não foram
// conferidos na tela real do Bling: `conferido: false` até o proprietário usar "Registrar esta tela" e a captura confirmar.
// Os campos canônicos seguem o registro de ferramentas (CAMPOS_BLING_PERMITIDOS) + os de leitura (código, preço, estoque).
export interface CampoMapa { canonico: string; descricao: string; rotulos: readonly string[]; editavelPeloNano: boolean; essencial: boolean }
export interface MapaTela { erp: string; tela: string; versao: number; conferido: boolean; minimoParaReconhecer: number; campos: readonly CampoMapa[] }

export const MAPA_PRODUTO_BLING: MapaTela = {
  erp: "bling", tela: "produto.cadastro", versao: 0, conferido: false, minimoParaReconhecer: 3,
  campos: [
    { canonico: "nome", descricao: "Nome / descrição do produto", rotulos: ["nome", "descricao", "nome do produto", "descricao do produto"], editavelPeloNano: true, essencial: true },
    { canonico: "codigo", descricao: "Código (SKU)", rotulos: ["codigo", "codigo sku", "sku", "referencia"], editavelPeloNano: false, essencial: true },
    { canonico: "gtin", descricao: "GTIN/EAN", rotulos: ["gtin", "ean", "gtin ean", "codigo de barras", "gtin ean tributavel"], editavelPeloNano: true, essencial: true },
    { canonico: "marca", descricao: "Marca", rotulos: ["marca"], editavelPeloNano: true, essencial: true },
    { canonico: "descricaoCurta", descricao: "Descrição curta", rotulos: ["descricao curta", "descricao resumida"], editavelPeloNano: true, essencial: true },
    { canonico: "descricaoComplementar", descricao: "Descrição complementar", rotulos: ["descricao complementar", "descricao detalhada", "descricao longa"], editavelPeloNano: true, essencial: false },
    { canonico: "pesoLiquido", descricao: "Peso líquido", rotulos: ["peso liquido", "peso liquido kg"], editavelPeloNano: true, essencial: true },
    { canonico: "pesoBruto", descricao: "Peso bruto", rotulos: ["peso bruto", "peso bruto kg"], editavelPeloNano: true, essencial: true },
    { canonico: "largura", descricao: "Largura", rotulos: ["largura", "largura cm"], editavelPeloNano: true, essencial: false },
    { canonico: "altura", descricao: "Altura", rotulos: ["altura", "altura cm"], editavelPeloNano: true, essencial: false },
    { canonico: "profundidade", descricao: "Profundidade", rotulos: ["profundidade", "comprimento", "profundidade cm"], editavelPeloNano: true, essencial: false },
    { canonico: "categoria", descricao: "Categoria", rotulos: ["categoria", "categoria do produto"], editavelPeloNano: true, essencial: true },
    { canonico: "tags", descricao: "Tags / palavras-chave de busca", rotulos: ["tags", "tag", "palavras chave", "grupo de tags"], editavelPeloNano: true, essencial: false },
    { canonico: "preco", descricao: "Preço de venda (só leitura)", rotulos: ["preco", "preco de venda", "preco venda"], editavelPeloNano: false, essencial: false },
    { canonico: "estoque", descricao: "Estoque (só leitura)", rotulos: ["estoque", "estoque atual", "saldo"], editavelPeloNano: false, essencial: false },
  ],
};
