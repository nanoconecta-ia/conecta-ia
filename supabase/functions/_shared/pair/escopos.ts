// Escopos do Conecta Pair. A lista é a MESMA de private.pair_escopos_validos() na migração (um teste confere).
// Nenhum escopo aprova, executa ou administra: o agente só LÊ e PROPÕE. Quem decide é o lojista, na Central de Aprovações.
export const ESCOPOS = [
  "produtos:ler", "bling:consultar", "enriquecimento:propor", "banners:propor", "categorias:propor", "paginas:propor",
  "catalogo:propor", "campanhas:propor", "aprovacoes:ler", "tarefas:ler",
  // Contexto Vivo: a extensão informa QUAL produto está aberto na tela do ERP (contexto efêmero de 30 min). Não altera produto nem ERP.
  "contexto:registrar",
  // Recurso conector-mcp (só valem para ele; os de cima só para o conecta-gateway). Nenhum aprova, executa ou administra.
  "mcp:leitura", "mcp:propor",
] as const;
export type Escopo = typeof ESCOPOS[number];

export const ROTULOS: Record<Escopo, string> = {
  "bling:consultar": "Consultar produto na API Bling (somente leitura, com fallback identificado)",
  "produtos:ler": "Ver produtos da loja (nome, SKU, preço, estoque)",
  "enriquecimento:propor": "Sugerir dados técnicos (vão para a Fila de aprovação)",
  "banners:propor": "Sugerir banners (nada é publicado sem sua aprovação)",
  "categorias:propor": "Sugerir novas categorias",
  "paginas:propor": "Sugerir alterações de páginas",
  "catalogo:propor": "Sugerir a publicação do catálogo",
  "campanhas:propor": "Sugerir campanhas e orçamentos",
  "aprovacoes:ler": "Ver quais aprovações estão pendentes",
  "tarefas:ler": "Ver o andamento das tarefas que ele pediu",
  "contexto:registrar": "Informar ao Nano qual produto está aberto na tela (some em 30 min; não altera produto nem o ERP)",
  "mcp:leitura": "Consultar produtos, taxonomia e códigos da sua loja (não altera nada)",
  "mcp:propor": "Preparar propostas “a confirmar” (nada é aprovado nem publicado sem você)",
};

export const TIPOS_DISPOSITIVO = ["navegador", "computador", "smartphone", "agente_externo", "agente_desktop"] as const;
export type TipoDispositivo = typeof TIPOS_DISPOSITIVO[number];

export const ehEscopo = (v: unknown): v is Escopo => typeof v === "string" && (ESCOPOS as readonly string[]).includes(v);
export function escoposValidos(v: unknown): v is Escopo[] {
  return Array.isArray(v) && v.length >= 1 && v.length <= 12 && new Set(v).size === v.length && v.every(ehEscopo);
}
export const ehTipo = (v: unknown): v is TipoDispositivo => typeof v === "string" && (TIPOS_DISPOSITIVO as readonly string[]).includes(v);
