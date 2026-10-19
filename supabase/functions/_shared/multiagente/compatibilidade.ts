// Capacidade 4 — Especialista em compatibilidade. Determinística. Avalia cada aplicação por VERSÃO (modelo + motor + período) contra as fontes.
// "confirmada" exige fonte OFICIAL consistente (mesmo modelo, motor e início de período) E evento de início no Brasil com fonte.
// Ausência de prova é "nao_confirmada", nunca "incompatível". O que o cadastro EXCLUI ("NÃO SE APLICA") nunca vira aplicação.
import { compararEvidencias, type Conflito, type Evidencia } from "../pipeline/comparacao.ts";
import type { Extracao } from "../pipeline/extracao.ts";
import { confereAnos, type EventoBrasil } from "../pipeline/periodos.ts";

export type SituacaoAplicacao = "confirmada" | "nao_confirmada" | "conflito" | "excluida";
export interface AvaliacaoAplicacao { modelo: string; motor?: string; ano_inicio?: number; situacao: SituacaoAplicacao; motivos: string[] }
export interface ResultadoCompatibilidade { aplicacoes: AvaliacaoAplicacao[]; conflitos: Conflito[]; pendencias: string[] }
const norm = (s: string) => s.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]/g, "");

export function avaliarCompatibilidade(ext: Extracao, evidencias: Evidencia[], eventosBR: EventoBrasil[] | null | undefined): ResultadoCompatibilidade {
  const conflitos = compararEvidencias(evidencias);
  const pendencias = confereAnos(ext.aplicacao.anos_informados, eventosBR);
  const temInicioBR = (eventosBR ?? []).some((e) => e.fonte && /^inicio_/.test(e.tipo));
  const base = evidencias.filter((e) => e.tipo_fonte === "bling").flatMap((e) => e.dados.aplicacoes ?? []);
  const oficiais = evidencias.filter((e) => e.tipo_fonte === "oficial" && !e.nao_confiavel);
  const aplicacoes: AvaliacaoAplicacao[] = base.map((a) => {
    const motivos: string[] = [];
    if (a.motor && ext.excluido.motores.some((m) => norm(m) === norm(a.motor!))) return { modelo: a.modelo, motor: a.motor, ano_inicio: a.ano_inicio, situacao: "excluida" as const, motivos: ["o cadastro exclui este motor no NÃO SE APLICA"] };
    const tocam = conflitos.filter((c) => c.tipo === "aplicacao" && c.campo.toLowerCase().includes(`(${a.modelo.toLowerCase()})`));
    if (tocam.length) return { modelo: a.modelo, motor: a.motor, ano_inicio: a.ano_inicio, situacao: "conflito" as const, motivos: tocam.map((c) => `${c.campo}: ${JSON.stringify(c.lado_a.valor)} × ${JSON.stringify(c.lado_b.valor)}`) };
    const confere = oficiais.some((e) => (e.dados.aplicacoes ?? []).some((x) => norm(x.modelo) === norm(a.modelo) && (!a.motor || norm(x.motor ?? "") === norm(a.motor)) && (a.ano_inicio === undefined || x.ano_inicio === a.ano_inicio)));
    if (!confere) motivos.push("nenhuma fonte oficial consistente confirma modelo, motor e início do período");
    if (!temInicioBR) motivos.push("sem evento de início no Brasil com fonte");
    return { modelo: a.modelo, motor: a.motor, ano_inicio: a.ano_inicio, situacao: motivos.length ? "nao_confirmada" : "confirmada", motivos };
  });
  if (aplicacoes.length === 0) pendencias.push("sem aplicação por versão do veículo para avaliar");
  return { aplicacoes, conflitos, pendencias };
}
