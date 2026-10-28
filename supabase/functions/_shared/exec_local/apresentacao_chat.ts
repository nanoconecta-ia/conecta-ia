// Como o chat mostra o resultado de uma tarefa local: origem, horário, hash, auditoria e o AMBIENTE (nunca finge "real").
// Puro: o chat só renderiza este objeto; texto vindo da página/PowerShell é DADO e aparece só como trecho citado.
import type { Veredito } from "./executor.ts";

export type Ambiente = "simulado" | "local_isolado" | "dispositivo_real";
export interface MetaApresentacao { capacidade: string; dispositivo_id: string; agente: string; tarefa_id: string; ambiente: Ambiente }
export interface CartaoChat {
  titulo: string; estado: Veredito["estado"]; ambiente: Ambiente; aviso: string | null;
  linhas: { rotulo: string; valor: string }[]; trecho_citado: string | null; tom: "ok" | "atencao" | "erro";
}
const AVISO: Record<Ambiente, string | null> = {
  simulado: "Resultado de teste SIMULADO: não veio de um dispositivo real.",
  local_isolado: "Resultado de teste LOCAL isolado: não veio do computador da loja.",
  dispositivo_real: null,
};
const MAX_TRECHO = 400;
const limpar = (s: string) => s.replace(/[\u0000-\u001f\u007f‪-‮⁦-⁩]/g, " ").replace(/\s+/g, " ").trim();

export function cartaoDoVeredito(v: Veredito, m: MetaApresentacao): CartaoChat {
  const base = [
    { rotulo: "Ferramenta", valor: m.capacidade }, { rotulo: "Origem", valor: `executor local · dispositivo ${m.dispositivo_id}` },
    { rotulo: "Pedido por", valor: m.agente }, { rotulo: "Tarefa", valor: m.tarefa_id },
  ];
  if (v.estado === "CONCLUIDA") {
    const e = v.evidencia;
    return { titulo: "Consulta concluída", estado: v.estado, ambiente: m.ambiente, aviso: AVISO[m.ambiente], tom: "ok",
      linhas: [...base, { rotulo: "Horário", valor: new Date(e.em).toISOString() }, { rotulo: "Hash", valor: e.sha256.slice(0, 12) }, { rotulo: "Auditoria", valor: "registrada" }],
      trecho_citado: limpar(e.saida).slice(0, MAX_TRECHO) };
  }
  const tom = v.estado === "REQUER_APROVACAO" || v.estado === "DESCONHECIDO" ? "atencao" : "erro";
  const titulo = { NEGADA: "Pedido negado", REQUER_APROVACAO: "Aguardando sua aprovação", FALHOU: "Falhou", DESCONHECIDO: "Resultado não confirmado" }[v.estado];
  return { titulo, estado: v.estado, ambiente: m.ambiente, aviso: AVISO[m.ambiente], tom,
    linhas: [...base, { rotulo: "Motivo", valor: limpar(v.motivo) }, ...(v.estado === "DESCONHECIDO" ? [{ rotulo: "Atenção", valor: "não repetir às cegas: confirme antes" }] : [])], trecho_citado: null };
}
