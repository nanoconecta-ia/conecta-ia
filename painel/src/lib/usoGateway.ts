// Uso do gateway por dispositivo, a partir da auditoria. Dado MEDIDO pelo Conecta.IA (não inclui tokens do provedor do agente).
export type UsoGateway = { ok: number; negado: number; invalido: number; erro: number; ultima: string | null; ferramenta: string | null };
export type EventoGateway = { acao: string; quando: string; depois: { dispositivo_id?: string; ferramenta?: string } | null };
export const LIMITE_EVENTOS = 1000;
/** Agrega os registros de auditoria `gateway.*` por dispositivo. Dado MEDIDO pelo Conecta.IA; não inclui tokens do provedor do agente. */
export function agregarUso(eventos: readonly EventoGateway[]): Map<string, UsoGateway> {
  const m = new Map<string, UsoGateway>();
  for (const e of eventos) {
    const id = e.depois?.dispositivo_id; if (!id || !e.acao.startsWith("gateway.")) continue;
    const u = m.get(id) ?? { ok: 0, negado: 0, invalido: 0, erro: 0, ultima: null, ferramenta: null };
    const r = e.acao.slice(8);
    if (r === "ok") u.ok++; else if (r === "negado") u.negado++; else if (r === "invalido") u.invalido++; else u.erro++;
    if (!u.ultima || e.quando > u.ultima) { u.ultima = e.quando; u.ferramenta = e.depois?.ferramenta ?? null; }
    m.set(id, u);
  }
  return m;
}
