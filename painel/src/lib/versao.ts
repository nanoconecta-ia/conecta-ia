// Versão do painel: a que está rodando neste aparelho × a que está publicada (version.json). Puro e testável; quem faz a rede é o AvisoVersao.
export type Versao = { commit: string; construido?: string };
export const VERSAO_LOCAL: Versao = { commit: __COMMIT__, construido: __CONSTRUIDO__ };

/** Só afirma "desatualizado" quando as duas pontas são commits reais e diferentes (build local ou resposta estranha nunca dispara o aviso). */
export function desatualizada(local: Versao, remota: unknown): remota is Versao {
  if (!remota || typeof remota !== "object") return false;
  const r = (remota as { commit?: unknown }).commit;
  if (typeof r !== "string" || !/^[0-9a-f]{7}$/.test(r)) return false;
  return /^[0-9a-f]{7}$/.test(local.commit) && r !== local.commit;
}
export const rotuloVersao = (v: Versao) => (/^[0-9a-f]{7}$/.test(v.commit) ? v.commit : "local");
export function quando(v: Versao): string {
  if (!v.construido) return "";
  const d = new Date(v.construido);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}
