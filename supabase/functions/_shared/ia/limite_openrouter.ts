// Diagnóstico por enumeração: nunca devolve mensagem/corpo bruto, chave ou prompt do provedor.
import { IaErro } from "./tipos.ts";
export function limiteOpenRouter(url: string, status: number, bruto: string, headers: Headers): IaErro | null {
  if (status !== 429) return null;
  try { if (new URL(url).origin !== "https://openrouter.ai") return null; } catch { return null; }
  let e: Record<string, any>;
  try { e = JSON.parse(bruto.slice(0, 16000))?.error ?? {}; } catch { return null; }
  const fonte = e.metadata?.limit_source;
  const msg = typeof e.message === "string" ? e.message : "";
  const diario = fonte === "openrouter_free_tier_daily" || /free-models-per-day/i.test(msg);
  const minuto = fonte === "openrouter_free_tier_minute" || /free-models-per-min/i.test(msg);
  if (!diario && !minuto) return null;
  const erro = new IaErro(429, diario
    ? "A cota diária gratuita do OpenRouter foi esgotada. Aguarde a renovação ou use a reserva configurada. As operações sem IA continuam disponíveis."
    : "O limite por minuto do OpenRouter foi atingido. Aguarde antes de tentar novamente.");
  erro.motivo_ia = diario ? "cota_diaria" : "limite_minuto";
  // A franquia diária é por dia UTC. Se não vier horário válido, a próxima virada é uma previsão identificada.
  const agora = Date.now();
  const valor = headers.get("x-ratelimit-reset");
  let reset = valor && /^\d{10,13}$/.test(valor) ? Number(valor) * (valor.length <= 10 ? 1000 : 1) : NaN;
  if (!(reset > agora && reset <= agora + 172800000)) reset = NaN;
  if (!Number.isFinite(reset) && diario) {
    const dia = new Date(agora); dia.setUTCHours(24, 0, 0, 0); reset = dia.getTime(); erro.renovacao_estimada = true;
  }
  if (Number.isFinite(reset)) erro.tentar_novamente_em = new Date(reset).toISOString();
  return erro;
}
