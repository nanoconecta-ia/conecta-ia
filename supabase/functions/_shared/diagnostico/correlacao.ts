// Correlação e telemetria do Nano.ia: um `request_id` por turno/chamada, latência por etapa e uma CATEGORIA de erro estável.
// Módulo puro (sem rede, sem banco, sem segredo): o chat e o gateway MCP usam o MESMO vocabulário, e o diagnóstico lê o mesmo registro.

export type CategoriaErro = "limite" | "indisponivel" | "tempo_esgotado" | "configuracao" | "nao_configurado" | "entrada" | "outro";

export interface LatenciaProvedor { provedor: string; ms: number; status: number }

/** Id curto e opaco por requisição (não revela nada; serve para casar app, banco e log da plataforma). */
export const novoRequestId = (): string => `req_${crypto.randomUUID().replaceAll("-", "").slice(0, 20)}`;

export const requestIdValido = (v: unknown): v is string => typeof v === "string" && /^req_[a-f0-9]{20}$/.test(v);

/** Status HTTP (do provedor ou nosso) → categoria estável. 502/503 do provedor = indisponível; 504 = tempo esgotado. */
export function categoriaDoStatus(status: number): CategoriaErro | null {
  if (status < 400) return null;
  if (status === 429) return "limite";
  if (status === 504) return "tempo_esgotado";
  if (status === 502) return "indisponivel";
  if (status === 401 || status === 403) return "configuracao";
  if (status === 503) return "nao_configurado";
  if (status === 400 || status === 409 || status === 413) return "entrada";
  return "outro";
}

/** Linha de log estruturada (JSON numa linha) para a plataforma: nunca leva texto do usuário, resposta, chave nem token. */
export function linhaLog(o: { origem: "chat" | "mcp"; request_id: string; loja_id?: string; provedor?: string; status: number; latencia_ms: number; desfecho?: string; categoria?: CategoriaErro | null; troca_de?: string | number | null; ferramenta?: string }): string {
  const { origem, request_id, loja_id, provedor, status, latencia_ms, desfecho, categoria, troca_de, ferramenta } = o;
  return JSON.stringify({ evento: "nano_requisicao", origem, request_id, loja_id, provedor, status, latencia_ms, desfecho, categoria, troca_de, ferramenta });
}
