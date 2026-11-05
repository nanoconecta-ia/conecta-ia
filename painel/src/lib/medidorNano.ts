/** Resumo de consumo por provedor: dados do cadastro da loja, nunca a cota externa da API. */
export type RegistroMedidor = {
  provedor: string;
  ativa: boolean;
  principal: boolean;
  modelo: string | null;
  base_url?: string | null;
  tokens_mes: number | null;
  limite_mensal_tokens: number | null;
  mes_ref: string | null;
};

export type EstadoCota = "desativado" | "desatualizado" | "sem_teto" | "disponivel" | "atencao" | "bloqueado" | "desconhecido";
export type CotaMedidor = {
  estado: EstadoCota;
  usados: number | null;
  limite: number | null;
  restante: number | null;
  percentual: number | null;
  descricao: string;
};

const numeroValido = (v: unknown): v is number =>
  typeof v === "number" && Number.isSafeInteger(v) && v >= 0;

export function nomeProvedor(r: Pick<RegistroMedidor, "provedor" | "base_url">): string {
  if (r.provedor === "openrouter_free") return "OpenRouter";
  if (r.provedor === "gemini") return "Gemini";
  if (r.provedor === "claude") return "Claude";
  if (r.provedor === "compativel_openai") {
    if (r.base_url === "https://api.groq.com/openai/v1" || r.base_url === "https://api.groq.com/openai/v1/") return "Groq";
    if (r.base_url === "https://api.cerebras.ai/v1" || r.base_url === "https://api.cerebras.ai/v1/") return "Cerebras";
    return "API compatível";
  }
  return "Outro provedor";
}

export function calcularCota(r: RegistroMedidor, mesAtual: string): CotaMedidor {
  const usados = numeroValido(r.tokens_mes) ? r.tokens_mes : null;
  const limite = numeroValido(r.limite_mensal_tokens) && r.limite_mensal_tokens > 0
    ? r.limite_mensal_tokens : null;
  const base = { usados, limite, restante: null, percentual: null };
  if (!r.ativa) return { ...base, estado: "desativado", descricao: "Desativado" };
  if (!/^\d{4}-\d{2}$/.test(mesAtual) || r.mes_ref?.slice(0, 7) !== mesAtual) {
    return { ...base, estado: "desatualizado", descricao: "Consumo do mês atual ainda não confirmado" };
  }
  if (usados === null) return { ...base, estado: "desconhecido", descricao: "Consumo indisponível" };
  if (limite === null) return { ...base, estado: "sem_teto", descricao: "Sem teto mensal interno" };
  const percentual = Math.min(100, Math.round((usados / limite) * 100));
  const restante = Math.max(0, limite - usados);
  if (usados >= limite) return { usados, limite, restante, percentual, estado: "bloqueado", descricao: "Teto mensal interno atingido" };
  if (usados >= limite * 0.8) return { usados, limite, restante, percentual, estado: "atencao", descricao: "Próximo do teto mensal interno" };
  return { usados, limite, restante, percentual, estado: "disponivel", descricao: "Dentro do teto mensal interno" };
}

export function diagnosticarFalhaNano(erro: unknown): string {
  const e = erro as { categoria_erro?: unknown; message?: unknown } | null;
  const mensagem = typeof e?.message === "string" ? e.message : "";
  if (/limite mensal do provedor atingido/i.test(mensagem)) return "Teto mensal interno atingido";
  if (e?.categoria_erro === "limite" || /\b429\b/.test(mensagem)) return "Limite de requisições (429); origem não confirmada";
  if (e?.categoria_erro === "tempo_esgotado") return "Tempo de resposta esgotado";
  if (e?.categoria_erro === "indisponivel") return "Provedor indisponível";
  if (e?.categoria_erro === "configuracao" || /\b401\b|\b403\b/.test(mensagem)) return "Verifique a configuração da chave";
  return "Falha na consulta; verifique os detalhes";
}
