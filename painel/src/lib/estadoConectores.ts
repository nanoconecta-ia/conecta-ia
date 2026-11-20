/** Estado de sessões de agentes da loja. Acesso concedido não equivale a presença online. */
export type EscopoConector = "mcp:leitura" | "mcp:propor" | "chat:responder" | string;
export type SessaoConector = {
  id: string;
  criado_em?: string | null;
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

/** Um agente lógico pode abrir várias sessões OAuth. Não confundir sessão antiga com outro agente. */
export type DispositivoComSessoes = {
  id: string;
  nome: string;
  tipo: string;
  revogado_em: string | null;
  pair_sessoes: SessaoConector[];
};
export type GrupoIdentidadeAgente<T extends DispositivoComSessoes> = {
  dispositivo: T;
  sessao: SessaoConector;
  quantidadeSessoes: number;
  historicas: number;
};

const canalDaSessao = (s: SessaoConector): string =>
  s.escopos.includes("chat:responder") ? "chat" :
  s.escopos.some(x => x.startsWith("mcp:")) ? "mcp" : "outro";

const pontuacaoSessao = (s: SessaoConector, agora: number): number => {
  if (s.revogado_em) return 0;
  if (Date.parse(s.limite_ate) <= agora) return 0;
  return Date.parse(s.expira_em) > agora ? 2 : 1;
};
const ordemSessao = (s: SessaoConector): number =>
  Date.parse(s.criado_em ?? "") || Date.parse(s.expira_em) || 0;

/** Agrupa sessões repetidas do MESMO nome/tipo/canal sem misturar escopos de tokens.
 * Seleciona o token válido mais recente. Antigos ficam contabilizados no histórico,
 * nunca reaparecem como novos agentes online. Claude e ChatGPT permanecem separados.
 * Não revoga tokens, não concede permissões e não modifica nenhum registro.
 */
export function consolidarAgentes<T extends DispositivoComSessoes>(
  dispositivos: readonly T[], agora = Date.now(),
): GrupoIdentidadeAgente<T>[] {
  const grupos = new Map<string, Array<{ dispositivo: T; sessao: SessaoConector }>>();
  for (const dispositivo of dispositivos) {
    if (dispositivo.revogado_em) continue;
    for (const sessao of dispositivo.pair_sessoes ?? []) {
      const identidade = dispositivo.nome.trim().toLocaleLowerCase("pt-BR").replace(/\s+/g, " ");
      const chave = [identidade, dispositivo.tipo, canalDaSessao(sessao)].join("|");
      const entradas = grupos.get(chave) ?? [];
      entradas.push({ dispositivo, sessao });
      grupos.set(chave, entradas);
    }
  }
  const resultado: GrupoIdentidadeAgente<T>[] = [];
  for (const entradas of grupos.values()) {
    entradas.sort((a, b) =>
      pontuacaoSessao(b.sessao, agora) - pontuacaoSessao(a.sessao, agora)
      || ordemSessao(b.sessao) - ordemSessao(a.sessao));
    const atual = entradas[0];
    if (!atual) continue;
    resultado.push({
      dispositivo: atual.dispositivo,
      sessao: atual.sessao,
      quantidadeSessoes: entradas.length,
      historicas: Math.max(0, entradas.length - 1),
    });
  }
  return resultado.sort((a, b) =>
    pontuacaoSessao(b.sessao, agora) - pontuacaoSessao(a.sessao, agora)
    || ordemSessao(b.sessao) - ordemSessao(a.sessao));
}
