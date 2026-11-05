/** Modelo comprovado pelo retorno final de um turno (nunca apenas pela configuração da chave). */
export type ModeloEfetivo = { rotulo: string; contingencia: boolean };

export function identificarModeloEfetivo(dados: unknown): ModeloEfetivo | null {
  if (!dados || typeof dados !== "object" || Array.isArray(dados)) return null;
  const m = dados as Record<string, unknown>;
  // Um provedor configurado, um streaming parcial ou um erro não provam inferência real.
  if (m.simulado === true || m.ia === false || m.completa === false ||
      (m.desfecho !== "ok" && m.desfecho !== "contingencia_publica" && m.desfecho !== "contingencia_automatica") ||
      (typeof m.http_status === "number" && m.http_status >= 400)) return null;
  const modelo = typeof m.modelo === "string" ? m.modelo.trim() : "";
  if (!modelo || modelo.length > 100 || /[\r\n\t]/.test(modelo)) return null;

  const contingencia = m.desfecho === "contingencia_publica" || m.desfecho === "contingencia_automatica";
  const host = typeof m.host_provedor === "string" ? m.host_provedor : "";
  const auxiliarPermitido = host === "api.groq.com" || host === "api.cerebras.ai";
  // Contingência pública pode terminar no OpenRouter ou no auxiliar independente Groq/Cerebras.
  // A etiqueta só é confirmada pelo resultado final do servidor, nunca pela chave cadastrada.
  if (contingencia && m.provedor_efetivo !== "openrouter-free" &&
      !(m.desfecho === "contingencia_publica" && m.provedor === "compativel_openai" &&
        m.provedor_efetivo === "compativel_openai" && auxiliarPermitido)) return null;
  const provedor = m.provedor_efetivo === "openrouter-free" || m.provedor === "openrouter_free" ? "OpenRouter Free"
    : m.provedor === "gemini" ? "Gemini"
    : m.provedor === "claude" ? "Claude"
    : m.provedor === "compativel_openai" && host === "api.groq.com" ? "Groq"
    : m.provedor === "compativel_openai" && host === "api.cerebras.ai" ? "Cerebras"
    : m.provedor === "compativel_openai" ? "API compatível"
    : null;
  return provedor ? { rotulo: `${provedor} · ${modelo}`, contingencia } : null;
}
