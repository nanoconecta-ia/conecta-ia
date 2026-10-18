// Policy Engine do Conector IA: guardião único. Nenhuma ferramenta roda sem passar por aqui.
// Puro e determinístico. Ordem das regras = ordem de severidade; a primeira que nega encerra.
import type { ContextoPolicy, DefinicaoFerramenta, ResultadoPolicy } from "./tipos.ts";
import { ORDEM_RISCO } from "./tipos.ts";

const nega = (motivo: string): ResultadoPolicy => ({ decisao: "negada", motivo });

export function decidir(def: DefinicaoFerramenta | undefined, c: ContextoPolicy): ResultadoPolicy {
  if (!def) return nega("ferramenta_desconhecida");

  // Execução externa: só o executor, e nunca por chat nem por cliente externo.
  if (def.permissao === "executar") {
    if (c.origem !== "executor") return nega("somente_executor: LLM e clientes externos não executam escrita");
    if (c.produtoTravado) return nega("produto_travado: só sugestão");
    if (!c.aprovacaoValida) return { decisao: "requer_aprovacao", motivo: "sem aprovação humana válida para esta versão" };
    if (c.simulado) return def.simulacao ? { decisao: "simulada", motivo: "execução simulada (mock)" } : nega("sem_modo_simulado");
    if (def.estado !== "ativa") return nega(`ferramenta_${def.estado}: escrita real desligada`);
    if (def.escreveExterno && !c.escritaRealLiberada) return nega("escrita_real_nao_liberada: falta liberação explícita da loja para esta ferramenta");
    return { decisao: "permitida", motivo: "aprovada e liberada" };
  }

  if (def.estado !== "ativa") return nega(`ferramenta_${def.estado}`);

  if (c.origem === "executor") return nega("executor_so_executa_aprovado");
  if (c.origem === "chat" && !def.exposicao.chat) return nega("nao_exposta_ao_chat");
  if (c.origem === "gateway_mcp") {
    if (!def.exposicao.mcp) return nega("nao_exposta_ao_mcp");
    if (!c.escopos?.includes(def.permissao)) return nega(`escopo_insuficiente: precisa de '${def.permissao}'`);
  }
  if (def.exigeAprovacao && !c.aprovacaoValida) return { decisao: "requer_aprovacao", motivo: "exige aprovação humana" };
  if (def.escreveExterno) return nega("escrita_externa_so_pelo_executor");
  if (ORDEM_RISCO[def.risco] >= ORDEM_RISCO.HIGH && def.permissao !== "leitura" && !c.aprovacaoValida) {
    return { decisao: "requer_aprovacao", motivo: `risco ${def.risco}` };
  }
  return { decisao: "permitida", motivo: def.permissao === "leitura" ? "leitura" : "gera apenas proposta (aprovação humana depois)" };
}
