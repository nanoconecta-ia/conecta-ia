// Estado da esfera do Nano.ia. Só muda por (a) evento `estado` enviado pelo servidor ou (b) algo que o app realmente está
// fazendo (microfone aberto, requisição que falhou ou foi cancelada). Nunca é simulado para "parecer ocupado".
export const ESTADOS_AGENTE = [
  "ocioso", "escutando", "interpretando", "consultando_ferramentas", "pesquisando_fontes", "preparando_proposta",
  "aguardando_aprovacao", "executando", "sincronizando_bling", "concluido", "erro", "bloqueado",
] as const;
export type EstadoAgente = typeof ESTADOS_AGENTE[number];

export const ROTULO_ESTADO: Record<EstadoAgente, string> = {
  ocioso: "Ocioso", escutando: "Escutando", interpretando: "Interpretando", consultando_ferramentas: "Consultando ferramentas",
  pesquisando_fontes: "Pesquisando fontes", preparando_proposta: "Preparando proposta", aguardando_aprovacao: "Aguardando aprovação",
  executando: "Executando operação", sincronizando_bling: "Sincronizando com o Bling", concluido: "Concluído", erro: "Erro", bloqueado: "Operação bloqueada",
};

export const ehEstadoAgente = (v: unknown): v is EstadoAgente => typeof v === "string" && (ESTADOS_AGENTE as readonly string[]).includes(v);

export type EventoEstado =
  | { tipo: "servidor"; estado: unknown }       // evento SSE `estado`
  | { tipo: "fim" }                             // evento SSE `fim` (o servidor terminou)
  | { tipo: "microfone"; ouvindo: boolean }     // reconhecimento de voz do navegador
  | { tipo: "falha_rede" }                      // a requisição falhou (sem servidor para dizer o estado)
  | { tipo: "cancelado" };                      // a pessoa cancelou

const TERMINAIS: EstadoAgente[] = ["concluido", "erro", "bloqueado", "aguardando_aprovacao"];

export function reduzirEstado(atual: EstadoAgente, e: EventoEstado): EstadoAgente {
  switch (e.tipo) {
    case "servidor": return ehEstadoAgente(e.estado) ? e.estado : atual; // valor desconhecido é ignorado, não inventado
    case "fim": return TERMINAIS.includes(atual) ? atual : "ocioso";
    case "microfone": return e.ouvindo ? "escutando" : atual === "escutando" ? "ocioso" : atual;
    case "falha_rede": return "erro";
    case "cancelado": return "ocioso";
  }
}

/** Estados em que a esfera se move; nos demais fica parada (cor + texto indicam o estado). */
export const ESTADO_ATIVO: Record<EstadoAgente, boolean> = {
  ocioso: false, escutando: true, interpretando: true, consultando_ferramentas: true, pesquisando_fontes: true, preparando_proposta: true,
  aguardando_aprovacao: false, executando: true, sincronizando_bling: true, concluido: false, erro: false, bloqueado: false,
};
