// Regras de apresentação e de decisão das propostas do Conector IA (espelham o que o banco impõe; o banco é quem manda).
import type { Risco } from "./chat.ts";

export type EstadoProposta = "rascunho" | "pendente" | "aprovada" | "rejeitada" | "expirada" | "invalidada" | "executando" | "executada" | "parcial" | "falhou" | "cancelada";
export type EstadoItem = "pendente" | "travado" | "aprovado" | "em_execucao" | "executado" | "confirmado" | "falhou" | "desconhecido" | "ignorado";

export interface Proposta {
  id: string; loja_id: string; solicitante_user: string; agente: string; provedor: string | null; modelo: string | null; titulo: string; resumo: string | null;
  risco: Risco; versao: number; lote: boolean; estado: EstadoProposta; hash: string | null; expira_em: string | null; criado_em: string; enviado_em: string | null; decidido_em: string | null;
}
export interface ItemProposta {
  id: string; proposta_id: string; produto_id: string | null; ordem: number; operacao: string; alvo: string | null; campos: string[];
  antes: Record<string, unknown> | null; depois: Record<string, unknown>; fontes: { url?: string; documento?: string; titulo?: string }[];
  validacoes: { nome?: string; ok?: boolean; detalhe?: string }[]; risco: Risco; estado: EstadoItem; motivo: string | null;
}
export interface Operacao { id: string; item_id: string; tentativa: number; ferramenta: string; estado: "pendente" | "enviada" | "confirmada" | "falhou" | "desconhecida"; erro: string | null; evidencia: unknown; iniciado_em: string; concluido_em: string | null }

export const ROTULO_PROPOSTA: Record<EstadoProposta, string> = {
  rascunho: "Rascunho", pendente: "Aguardando decisão", aprovada: "Aprovada", rejeitada: "Rejeitada", expirada: "Expirada", invalidada: "Substituída por nova versão",
  executando: "Em execução", executada: "Executada e confirmada", parcial: "Executada em parte", falhou: "Falhou", cancelada: "Cancelada",
};
export const ROTULO_ITEM: Record<EstadoItem, string> = {
  pendente: "Pendente", travado: "Sugestão — produto travado", aprovado: "Aprovado", em_execucao: "Em execução", executado: "Executado", confirmado: "Confirmado por leitura",
  falhou: "Falhou", desconhecido: "Resultado desconhecido", ignorado: "Fora do escopo",
};
export const ROTULO_RISCO: Record<Risco, string> = { LOW: "Baixo", MEDIUM: "Médio", HIGH: "Alto", CRITICAL: "Crítico" };
export const exigeConfirmacao = (r: Risco) => r === "HIGH" || r === "CRITICAL";

const mostrar = (v: unknown): string => v === null || v === undefined || v === "" ? "—" : typeof v === "string" ? v : JSON.stringify(v);
export interface LinhaComparacao { campo: string; antes: string; depois: string; mudou: boolean }

/** Comparação antes/depois por campo. Sem `antes` (criação) tudo aparece como novo. */
export function compararCampos(antes: Record<string, unknown> | null, depois: Record<string, unknown>, campos: string[]): LinhaComparacao[] {
  const chaves = campos.length ? campos : [...new Set([...Object.keys(antes ?? {}), ...Object.keys(depois)])];
  return chaves.map((campo) => {
    const a = mostrar(antes?.[campo]), d = mostrar(depois[campo]);
    return { campo, antes: a, depois: d, mudou: a !== d };
  });
}

export function prazo(expira: string | null, agora = Date.now()): { expirada: boolean; texto: string } {
  if (!expira) return { expirada: false, texto: "sem prazo" };
  const ms = Date.parse(expira) - agora;
  if (Number.isNaN(ms)) return { expirada: false, texto: "sem prazo" };
  if (ms <= 0) return { expirada: true, texto: "expirada" };
  const h = Math.floor(ms / 3_600_000), min = Math.floor((ms % 3_600_000) / 60_000);
  return { expirada: false, texto: h > 0 ? `expira em ${h} h ${min} min` : `expira em ${min} min` };
}

export const itensAprovaveis = (itens: ItemProposta[]) => itens.filter((i) => i.estado === "pendente");

export function podeDecidir(p: Proposta, itens: ItemProposta[], agora = Date.now()): { ok: boolean; motivo?: string } {
  if (p.estado !== "pendente") return { ok: false, motivo: `A proposta está "${ROTULO_PROPOSTA[p.estado]}".` };
  if (prazo(p.expira_em, agora).expirada) return { ok: false, motivo: "A proposta expirou. Peça uma revisão." };
  if (!p.hash) return { ok: false, motivo: "A proposta não tem identificação de versão (hash)." };
  if (itensAprovaveis(itens).length === 0) return { ok: false, motivo: "Nenhum item aprovável: todos estão travados ou fora do escopo. Destrave o produto e peça uma revisão." };
  return { ok: true };
}

export interface CorpoDecisao { acao: "decidir"; loja_id: string; proposta_id: string; versao: number; hash: string; decisao: "aprovada" | "rejeitada"; itens?: string[]; confirmacao_explicita?: boolean }

/** Monta o corpo exato do contrato: a aprovação vale para ESTA versão e ESTE hash. */
export function corpoDecisao(p: Proposta, decisao: "aprovada" | "rejeitada", selecionados: string[] | null, confirmou: boolean): CorpoDecisao {
  if (!p.hash) throw new Error("Proposta sem hash.");
  if (decisao === "aprovada" && exigeConfirmacao(p.risco) && !confirmou) throw new Error("Risco alto ou crítico exige confirmação explícita.");
  const c: CorpoDecisao = { acao: "decidir", loja_id: p.loja_id, proposta_id: p.id, versao: p.versao, hash: p.hash, decisao };
  if (decisao === "aprovada" && selecionados) c.itens = selecionados;
  if (decisao === "aprovada" && exigeConfirmacao(p.risco)) c.confirmacao_explicita = true;
  return c;
}

export function resumoOperacoes(ops: Operacao[]): Record<Operacao["estado"], number> {
  const r = { pendente: 0, enviada: 0, confirmada: 0, falhou: 0, desconhecida: 0 };
  for (const o of ops) r[o.estado]++;
  return r;
}
/** Operações cujo resultado é desconhecido e a última tentativa ainda não foi reconciliada. */
export const aReconciliar = (ops: Operacao[]) => ops.filter((o) => o.estado === "desconhecida");

export function agruparPorProduto(itens: ItemProposta[]): Map<string, ItemProposta[]> {
  const m = new Map<string, ItemProposta[]>();
  for (const i of itens) { const k = i.produto_id ?? "sem-produto"; m.set(k, [...(m.get(k) ?? []), i]); }
  return m;
}
