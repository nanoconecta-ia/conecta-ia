/** Atividade do agente externo (MCP) no chat do Nano: regras puras de apresentação. O resumo é texto do agente (NÃO CONFIÁVEL): aqui só se formata; o React escapa. */
import { iconeDaCategoria, type Peca } from "./icones.ts";

export interface AtividadeExterna {
  id: string; criado_em: string; tipo: string; ferramenta: string | null; resumo: string | null;
  produto: { sku: string | null; nome: string | null } | null;
  categoria: { slug: string; nome: string } | null;
}
const ROTULO: Record<string, string> = { consulta: "Consultou", proposta: "Propôs", resumo: "Registrou um resumo", recusa: "Teve um pedido recusado" };
export const rotuloAtividade = (tipo: string): string => ROTULO[tipo] ?? "Atividade";
/** Ícone da peça pela taxonomia do produto; sem categoria ligada, o ícone genérico (nunca um palpite pelo nome do produto). */
export const iconeDaAtividade = (a: Pick<AtividadeExterna, "categoria">): Peca => (a.categoria ? iconeDaCategoria(a.categoria.slug, a.categoria.nome) : "todas");
export const RESUMO_EXIBIDO_MAX = 600;
/** Texto exibido: sem HTML/controle e no máximo 600 caracteres. */
export function textoDoResumo(r: string | null | undefined): string {
  return (r ?? "").replace(/<[^>]*>/g, " ").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, RESUMO_EXIBIDO_MAX);
}
export const origemRotulo = "agente externo";
