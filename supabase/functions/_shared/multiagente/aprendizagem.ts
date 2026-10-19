// Aprendizagem controlada (lado TypeScript). O agente só PROPÕE; ativar, rejeitar e reverter são do lojista (funções do banco).
// Escopos permitidos: sinônimo de termo, regra de classificação, padrão de extração, fonte confiável. Fiscal, segurança e aplicação técnica não existem aqui.
import { termoCandidato, type RegraAprendida } from "./taxonomista.ts";

type Rpc = (fn: string, args: Record<string, unknown>) => Promise<{ data: any; error: { message: string } | null }>;
const chamar = async (rpc: Rpc, fn: string, args: Record<string, unknown>) => { const { data, error } = await rpc(fn, args); if (error) throw new Error(error.message); return data; };

export async function carregarRegrasAtivas(rpc: Rpc, lojaId: string): Promise<RegraAprendida[]> {
  return (await chamar(rpc, "aprendizado_ativas", { p_loja: lojaId, p_escopo: "regra_classificacao" })) ?? [];
}

/** O lojista corrigiu a categoria proposta: o agente propõe uma regra (a confirmar), com a decisão como procedência. Não ativa nada. */
export async function proporRegraDeCorrecao(rpc: Rpc, lojaId: string, o: { nomeProduto: string; destino: { sistema: string; subsistema: string; familia: string }; decisaoId: string; sku: string }): Promise<string | null> {
  const termo = termoCandidato(o.nomeProduto);
  if (termo.length < 4) return null;                      // termo curto demais generaliza errado: melhor não propor
  return chamar(rpc, "aprendizado_propor", { p_loja: lojaId, p_escopo: "regra_classificacao", p_chave: termo, p_valor: o.destino, p_origem: "correcao_aprovada",
    p_fonte: `correção aprovada ${o.decisaoId} (SKU ${o.sku})`, p_por: "agente" });
}
