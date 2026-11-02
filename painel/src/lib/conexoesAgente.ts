/** Central de conexões do lojista: resume, em uma linha por caminho, o que é VERIFICÁVEL (cadastro no banco). Nunca declara "funcionando" sem prova; nunca nomeia provedor de IA (regra 5 do design system). */
export type EstadoConexao = "ok" | "atencao" | "inativo" | "nao_verificado";
export interface CartaoConexao { id: "nativo" | "api" | "mcp" | "plugins" | "contingencia"; titulo: string; estado: EstadoConexao; resumo: string; detalhe: string; rota: string; acao: string }

export interface EntradaConexoes {
  chavesIa: { provedor: string; ativa: boolean; principal: boolean }[];
  chavesMcp: { revogada_em: string | null; expira_em: string | null; ultimo_uso_em: string | null }[];
  plugins: { ativo: boolean; ultimo_teste_ok: boolean | null }[];
  agora?: number;
}
export const ROTULO_ESTADO: Record<EstadoConexao, string> = { ok: "cadastrado", atencao: "atenção", inativo: "não configurado", nao_verificado: "não verificado" };
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

export function montarConexoes(e: EntradaConexoes): CartaoConexao[] {
  const agora = e.agora ?? Date.now();
  const ativasIa = e.chavesIa.filter((c) => c.ativa);
  const provedoresDistintos = new Set(ativasIa.map((c) => c.provedor)).size;
  const principal = ativasIa.some((c) => c.principal);
  const mcpAtivas = e.chavesMcp.filter((c) => !c.revogada_em && !(c.expira_em && Date.parse(c.expira_em) < agora));
  const ultimoUso = mcpAtivas.map((c) => c.ultimo_uso_em).filter((x): x is string => !!x).sort().pop() ?? null;
  const pluginsAtivos = e.plugins.filter((p) => p.ativo);
  const pluginsComFalha = pluginsAtivos.filter((p) => p.ultimo_teste_ok === false).length;

  return [
    { id: "nativo", titulo: "Agente nativo (Genesis IA)", estado: principal ? "ok" : "atencao",
      resumo: principal ? "Chave principal cadastrada." : "Sem chave principal ativa.",
      detalhe: principal ? "Cadastrada não prova que está respondendo: se o provedor estiver sobrecarregado, o chat avisa." : "O Nano precisa de uma chave de IA ativa para conversar.", rota: "/assistente", acao: "Abrir o chat" },
    { id: "api", titulo: "API de IA (suas chaves)", estado: ativasIa.length === 0 ? "atencao" : provedoresDistintos < 2 ? "atencao" : "ok",
      resumo: ativasIa.length === 0 ? "Nenhuma chave ativa." : `${plural(ativasIa.length, "chave ativa", "chaves ativas")}.`,
      detalhe: ativasIa.length === 0 ? "Cadastre uma chave em Integrações de IA." : provedoresDistintos < 2 ? "Só um provedor cadastrado: se ele falhar, não há alternativa. Cadastre um segundo." : "Mais de um provedor cadastrado: há alternativa se um falhar.", rota: "/integracoes", acao: "Integrações de IA" },
    { id: "mcp", titulo: "Agente externo (MCP)", estado: mcpAtivas.length ? "ok" : "inativo",
      resumo: mcpAtivas.length ? `${plural(mcpAtivas.length, "chave ativa", "chaves ativas")}.` : "Nenhuma chave criada.",
      detalhe: mcpAtivas.length ? `Último uso: ${ultimoUso ? new Date(ultimoUso).toLocaleString("pt-BR") : "nunca usada"}. O endereço não pode ser testado daqui (não verificado).` : "Crie uma chave em Gateway MCP para conectar um agente externo, só consulta ou consulta e propostas.", rota: "/gateway", acao: "Gateway MCP" },
    { id: "plugins", titulo: "Plugins e serviços", estado: pluginsAtivos.length === 0 ? "inativo" : pluginsComFalha ? "atencao" : "ok",
      resumo: pluginsAtivos.length === 0 ? "Nenhum plugin ativo." : `${plural(pluginsAtivos.length, "plugin ativo", "plugins ativos")}.`,
      detalhe: pluginsComFalha ? `${plural(pluginsComFalha, "plugin falhou", "plugins falharam")} no último teste.` : pluginsAtivos.length ? "Sem falha no último teste registrado." : "Integre serviços um a um em Integrações de IA.", rota: "/integracoes", acao: "Integrações de IA" },
    { id: "contingencia", titulo: "Contingência gratuita", estado: "nao_verificado",
      resumo: "Não verificado.",
      detalhe: "Só responde perguntas de glossário, sem consultar nem alterar produto, e depende de uma chave guardada no servidor que este painel não consegue conferir.", rota: "/integracoes", acao: "Ver ajustes" },
  ];
}
