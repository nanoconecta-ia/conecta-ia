// Tipos canônicos do agente (formato de blocos no estilo Messages API) e erro de IA.
export interface Ferramenta { name: string; description: string; input_schema: Record<string, unknown> }
export type Bloco =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: unknown }
  | { type: "tool_result"; tool_use_id: string; content: string; is_error?: boolean };
export interface Mensagem { role: "user" | "assistant"; content: string | Bloco[] }

export class IaErro extends Error {
  status: number;
  constructor(status: number, msg: string) { super(msg); this.status = status; }
}

