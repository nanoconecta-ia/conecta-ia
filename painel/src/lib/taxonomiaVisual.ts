/** Regras puras de apresentação técnica. Nunca inferem aplicação, marca, ano ou potência sem dado validado. */
export type Status = "a_confirmar" | "aprovado" | "rejeitado" | string;
export interface ImagemAutorizada { url: string; aprovada: boolean; direitos_confirmados_em?: string | null; tipo?: string | null; removida_em?: string | null }
export const normalizarBusca = (s: string): string => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim();
export const atendeBusca = (termo: string, ...campos: (string | null | undefined)[]) => !termo.trim() || campos.some(c => normalizarBusca(c ?? "").includes(normalizarBusca(termo)));
export function urlExternaSegura(s: string | null | undefined): string | null {
  if (!s) return null;
  try {
    const u = new URL(s);
    if (u.protocol !== "https:" || u.username || u.password || u.port || u.hostname === "localhost"
      || u.hostname.endsWith(".local") || /^(?:127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(u.hostname)) return null;
    return u.href;
  } catch { return null; }
}
export function fotoUtilizavel(f: ImagemAutorizada): boolean {
  return f.aprovada === true && !!f.direitos_confirmados_em && !f.removida_em
    && f.tipo === "real" && urlExternaSegura(f.url) !== null;
}
export function cvVerificado(potenciaKw: number | null, status: Status): string | null {
  return status === "aprovado" && potenciaKw !== null && Number.isFinite(potenciaKw) && potenciaKw > 0
    ? (potenciaKw * 1.3596216173).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) : null;
}
export function tituloSeoCategoria(categoria: string, montadora?: string | null, modelo?: string | null): string {
  // Prévia administrativa, não publicável: jamais menciona motorização ou compatibilidade presumida.
  return [categoria.trim(), montadora?.trim(), modelo?.trim()].filter(Boolean).join(" | ").slice(0, 65);
}
export function indicadoresCadastro(d: { foto: boolean; codigoOem: boolean; versaoConfirmada: boolean; fonte?: boolean }) {
  return [
    { chave: "foto", nome: "Foto real autorizada", ok: d.foto },
    { chave: "oem", nome: "Referência OEM aprovada", ok: d.codigoOem },
    { chave: "versao", nome: "Versão e motorização verificadas", ok: d.versaoConfirmada },
    { chave: "fonte", nome: "Documento técnico identificado", ok: !!d.fonte },
  ];
}
