/** Estado de sessões de agentes da loja. Acesso concedido não equivale a presença online. */
export type EscopoConector = "mcp:leitura" | "mcp:propor" | "chat:responder" | string;
export type SessaoConector = {
  id: string;
  escopos: string[];
  expira_em: string;
  limite_ate: string;
  ultimo_uso_em: string | null;
  chat_escuta_em: string | null;
  revogado_em: string | null;
};

export type EstadoSessao = "revogada" | "janela_expirada" | "token_expirado" | "atividade_recente" | "autorizada_sem_atividade";

export function estadoSessaoConector(s: SessaoConector, agora = Date.now()): EstadoSessao {
  if (s.revogado_em) return "revogada";
  if (!Number.isFinite(Date.parse(s.limite_ate)) || Date.parse(s.limite_ate) <= agora) return "janela_expirada";
  if (!Number.isFinite(Date.parse(s.expira_em)) || Date.parse(s.expira_em) <= agora) return "token_expirado";
  const uso = s.ultimo_uso_em ? Date.parse(s.ultimo_uso_em) : NaN;
  return Number.isFinite(uso) && uso <= agora + 5000 && agora - uso <= 75000
    ? "atividade_recente" : "autorizada_sem_atividade";
}

export function permissoesConector(escopos: readonly string[]) {
  return {
    consultar: escopos.includes("mcp:leitura"),
    propor: escopos.includes("mcp:propor"),
    responderNano: escopos.includes("chat:responder"),
    // Tokens de agente externo nunca ganham aprovação ou escrita no ERP.
    aprovar: false,
    executarBling: false,
  };
}

export function situacaoSessao(s: EstadoSessao): string {
  switch (s) {
    case "atividade_recente": return "Atividade recente (últimos 75 s)";
    case "autorizada_sem_atividade": return "Autorizada, sem atividade recente";
    case "token_expirado": return "Token expirado; renovar no agente";
    case "janela_expirada": return "Prazo de autorização encerrado";
    case "revogada": return "Revogada";
  }
}

export function resumoConectores(sessoes: readonly SessaoConector[], agora = Date.now()) {
  const atuais = sessoes.filter(s => !s.revogado_em && Date.parse(s.limite_ate) > agora);
  return {
    autorizadas: atuais.filter(s => Date.parse(s.expira_em) > agora).length,
    emAtividade: atuais.filter(s => estadoSessaoConector(s, agora) === "atividade_recente").length,
    podemPropor: atuais.filter(s => Date.parse(s.expira_em) > agora && s.escopos.includes("mcp:propor")).length,
    podemResponder: atuais.filter(s => Date.parse(s.expira_em) > agora && s.escopos.includes("chat:responder")).length,
  };
}
