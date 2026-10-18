// Matriz de campos Bling ↔ Conecta.IA. Declara, por campo: fonte oficial, destino, direção, permissão, validação e reversão.
// Hoje a única direção implementada é bling → conecta (espelho somente leitura, bling_sync.ts). Escrita no Bling: nenhuma.
// conferidoDoc = false: nome do campo na API v3 ainda NÃO conferido em developer.bling.com.br (regra zero alucinação).
export type Direcao = "bling->conecta" | "conecta->bling" | "conecta" | "proibida";
export type EstadoCampo = "implementado" | "planejado" | "proibido";

export interface CampoMatriz {
  campo: string;            // nome canônico
  campoBling: string | null; // caminho no JSON do Bling (null = não vem do Bling)
  destino: string;          // tabela.coluna no Conecta.IA ("-" = não se grava)
  fonteOficial: "bling" | "conecta" | "ninguem";
  direcao: Direcao;
  estado: EstadoCampo;
  permissao: string;        // quem pode alterar
  validacao: string;
  reversivel: boolean;
  conferidoDoc: boolean;
  nota?: string;
}

const espelho = (campo: string, campoBling: string, destino: string, validacao: string, nota?: string): CampoMatriz => ({
  campo, campoBling, destino: `produtos.${destino}`, fonteOficial: "bling", direcao: "bling->conecta", estado: "implementado",
  permissao: "somente sync (service_role); lojista não edita", validacao, reversivel: true, conferidoDoc: false, nota,
});
const proibido = (campo: string, nota: string): CampoMatriz => ({
  campo, campoBling: null, destino: "-", fonteOficial: "ninguem", direcao: "proibida", estado: "proibido",
  permissao: "nenhuma", validacao: "-", reversivel: false, conferidoDoc: false, nota,
});

export const MATRIZ: readonly CampoMatriz[] = [
  espelho("id", "id", "bling_id", "string do id; chave de idempotência (loja_id, bling_id)"),
  espelho("sku", "codigo", "sku", "texto não vazio; vazio => produto não publica"),
  espelho("nome", "nome", "nome", "texto não vazio; vazio => produto não publica"),
  espelho("preco_venda", "preco", "preco", "número; nunca sobrescrito por IA"),
  espelho("estoque", "estoque.saldoVirtualTotal", "estoque", "número; nunca sobrescrito por IA; frescor checado antes de cobrar"),
  espelho("situacao", "situacao", "situacao", "'A' ativo; outro => despublica"),
  espelho("categoria_bling", "categoria.id", "categoria_bling_id", "id; ponte para taxonomia via bling_categoria_taxonomia"),
  espelho("marca", "marca", "marca", "texto"),
  espelho("gtin", "gtin", "gtin", "texto; GTIN nunca inventado"),
  espelho("gtin_tributario", "gtinEmbalagem", "gtin_tributario", "texto"),
  espelho("descricao_curta", "descricaoCurta", "descricao_curta", "HTML do Bling é reduzido a texto na vitrine"),
  espelho("descricao_complementar", "descricaoComplementar", "descricao_complementar", "idem"),
  espelho("peso_kg", "pesoBruto|pesoLiquido", "peso_kg", "> 0; 0 = não informado, nunca vira dado"),
  espelho("largura_cm", "dimensoes.largura", "largura_cm", "> 0"),
  espelho("altura_cm", "dimensoes.altura", "altura_cm", "> 0"),
  espelho("profundidade_cm", "dimensoes.profundidade", "profundidade_cm", "> 0"),
  espelho("unidade", "unidade", "unidade", "texto"),
  espelho("condicao", "condicao", "condicao", "código numérico do Bling como texto"),
  espelho("formato", "formato", "formato", "S/V/E: simples/variação/composição"),
  espelho("pai_bling_id", "idProdutoPai", "pai_bling_id", "vínculo de variação"),
  espelho("volumes", "volumes", "volumes", "> 0"),

  // Camada de enriquecimento: nasce no Conecta.IA; só volta ao Bling com campo autorizado (planejado, Fase 2).
  { campo: "descricao_enriquecida", campoBling: "descricaoComplementar", destino: "produto_enriquecimento (campo descricao_longa)", fonteOficial: "conecta",
    direcao: "conecta", estado: "implementado", permissao: "agente propõe; lojista aprova na Fila", validacao: "fonte+data obrigatórias para aprovar",
    reversivel: true, conferidoDoc: false, nota: "Fica só no Conecta.IA. Gravar no Bling = decisão em aberto, por campo." },
  { campo: "descricao_enriquecida_no_bling", campoBling: "descricaoComplementar", destino: "-", fonteOficial: "conecta",
    direcao: "conecta->bling", estado: "planejado", permissao: "lojista autoriza o campo; aprovação por escrita", validacao: "diff antes/depois, idempotency_key, leitura de confirmação",
    reversivel: true, conferidoDoc: false, nota: "Planejado (Fase 2). Ferramenta bling.produtos.alterar segue ativa:false." },
  { campo: "taxonomia", campoBling: null, destino: "produtos.taxonomia_no_id", fonteOficial: "conecta", direcao: "conecta", estado: "implementado",
    permissao: "lojista (mapeamento categoria→nó) e aprovação", validacao: "nó aprovado da taxonomia do perfil de ramo", reversivel: true, conferidoDoc: false },
  { campo: "aplicacao_veicular", campoBling: null, destino: "produto_aplicacoes", fonteOficial: "conecta", direcao: "conecta", estado: "implementado",
    permissao: "agente propõe; lojista aprova", validacao: "fonte+data; hipótese nunca vira fato", reversivel: true, conferidoDoc: false },
  { campo: "codigos_oem_cruzados", campoBling: null, destino: "produto_codigos", fonteOficial: "conecta", direcao: "conecta", estado: "implementado",
    permissao: "agente propõe; lojista aprova", validacao: "OEM/OES exige fornecimento original documentado", reversivel: true, conferidoDoc: false },
  { campo: "imagens", campoBling: null, destino: "produto_imagens", fonteOficial: "conecta", direcao: "conecta", estado: "implementado",
    permissao: "agente propõe; lojista aprova", validacao: "origem e direitos registrados; sintética nunca é foto real", reversivel: true, conferidoDoc: false },
  { campo: "seo", campoBling: null, destino: "-", fonteOficial: "conecta", direcao: "conecta", estado: "planejado",
    permissao: "lojista aprova", validacao: "só fatos aprovados", reversivel: true, conferidoDoc: false, nota: "Tabela ainda não existe (Fase 3)." },

  // Proibidos: nunca copiados nem gravados pela IA.
  proibido("preco_custo", "Custo, fornecedor e preço de compra nunca são copiados (bling_sync.ts)."),
  proibido("fornecedor", "Dado interno; nunca no espelho nem exposto ao agente público."),
  proibido("ncm_cest_cst_cfop_no_bling", "Dado fiscal: só com validação do contador e autorização específica; nenhuma escrita automática."),
  proibido("preco_venda_por_ia", "IA nunca altera preço no Bling nem no espelho."),
  proibido("estoque_por_ia", "IA nunca altera estoque."),
];

/** Colunas que o espelho grava e que NÃO vêm do Bling (controle do sync). */
export const COLUNAS_CONTROLE = ["loja_id", "sincronizado_em"];
