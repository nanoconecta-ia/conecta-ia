// Contratos centrais do Nano.ia. Tudo aqui é puro (sem rede, sem Deno), para rodar igual no Edge e nos testes.
export type Risco = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export const ORDEM_RISCO: Record<Risco, number> = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };
export const maiorRisco = (a: Risco, b: Risco): Risco => (ORDEM_RISCO[a] >= ORDEM_RISCO[b] ? a : b);

export type Origem = "chat" | "gateway_mcp" | "executor";
/** leitura/propor/simular: o que um agente (chat ou cliente externo) pode pedir. executar: só o executor, depois de aprovação humana. */
export type Permissao = "leitura" | "propor" | "simular" | "executar";
export type Decisao = "permitida" | "negada" | "requer_aprovacao" | "simulada";
export type EstadoFerramenta = "ativa" | "planejada" | "desligada";
export type Grupo = "bling" | "engenharia" | "conecta" | "desenvolvimento";

export interface JsonSchema {
  type?: "object" | "string" | "number" | "integer" | "boolean" | "array" | "null";
  properties?: Record<string, JsonSchema>;
  required?: string[];
  additionalProperties?: boolean;
  items?: JsonSchema;
  enum?: readonly (string | number)[];
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  maxItems?: number;
  minItems?: number;
  description?: string;
}

export interface DefinicaoFerramenta {
  id: string;                          // grupo.recurso.acao (mesmo id usado em agente_proposta_itens.operacao)
  grupo: Grupo;
  descricao: string;
  entrada: JsonSchema;
  saida: JsonSchema;
  permissao: Permissao;
  risco: Risco;
  simulacao: boolean;                  // existe execução simulada (mock) para esta ferramenta?
  exigeAprovacao: boolean;
  idempotencia: "chave" | "natural" | "nao_se_aplica";
  verificacao: string;                 // como confirmar o resultado (leitura após escrita, contagem etc.)
  recuperacao: string;                 // o que fazer se falhar no meio
  /** ativa = existe handler implementado E testado. planejada = só contrato. desligada = implementada mas travada por política. */
  estado: EstadoFerramenta;
  exposicao: { chat: boolean; mcp: boolean };
  /** Operação externa (Bling etc.)? Escrita real só passa pelo executor. */
  escreveExterno: boolean;
}

export interface ContextoPolicy {
  origem: Origem;
  /** Escopos da chave MCP (origem gateway_mcp). */
  escopos?: readonly Permissao[];
  /** Execução em modo simulado (mock) em vez de real. */
  simulado?: boolean;
  /** Aprovação humana válida (hash confere, não expirou) para ESTA operação. */
  aprovacaoValida?: boolean;
  /** Para escrita real: existe liberação explícita da ferramenta para a loja. */
  escritaRealLiberada?: boolean;
  /** Estado de trava do produto-alvo, quando houver. */
  produtoTravado?: boolean;
}

export interface ResultadoPolicy { decisao: Decisao; motivo: string }

export type SanitizadoParaLog = Record<string, unknown>;
