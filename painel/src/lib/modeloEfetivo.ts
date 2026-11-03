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
  if (contingencia && m.provedor_efetivo !== "openrouter-free") return null;
  const provedor = contingencia || m.provedor === "openrouter_free" ? "OpenRouter Free"
    : m.provedor === "gemini" ? "Gemini"
    : m.provedor === "claude" ? "Claude"
    : m.provedor === "compativel_openai" ? "API compatível"
    : null;
  return provedor ? { rotulo: `${provedor} · ${modelo}`, contingencia } : null;
}
