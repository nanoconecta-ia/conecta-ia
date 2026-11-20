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

export type EstadoAgente = { situacao: "agindo" | "conectado" | "acabando" | "parado"; restante_min: number };
/** Situação para a faixa do painel. "parado" = o token de acesso (15 min) venceu sem renovação: a janela da sessão ainda vale, mas o agente não consegue agir.
 *  "agindo" = chamada nos últimos 60 s; "acabando" = falta < 60 min na janela. Tudo calculado de dados reais. */
export function estadoAgente(limiteAte: string, ultimaChamada: string | null, agora: number, tokenAte?: string | null): EstadoAgente {
  const restante_min = Math.floor((Date.parse(limiteAte) - agora) / 60000);
  if (tokenAte && Date.parse(tokenAte) <= agora) return { situacao: "parado", restante_min };
  if (restante_min < 60) return { situacao: "acabando", restante_min };
  const agindo = ultimaChamada !== null && agora - Date.parse(ultimaChamada) < 60_000;
  return { situacao: agindo ? "agindo" : "conectado", restante_min };
}

/** Um agente por nome: fica a sessão com a janela mais longa (a mais recente). Evita repetir "Claude Code" para cada pareamento antigo. */
export function maisRecentePorNome<T extends { nome: string; limite_ate: string }>(linhas: T[]): T[] {
  const por = new Map<string, T>();
  for (const l of linhas) { const a = por.get(l.nome); if (!a || Date.parse(l.limite_ate) > Date.parse(a.limite_ate)) por.set(l.nome, l); }
  return [...por.values()];
}
/** Nome curto para a faixa: "Claude Code (desenvolvedor do Conecta.IA)" → "Claude Code". O nome completo fica no title. */
export const nomeCurto = (nome: string) => nome.replace(/\s*\(.*$/, "").trim() || nome;

/** Texto sempre visível da faixa quando há agente conectado pelo QR (antes era só um ícone "IA"). */
export function resumoFaixa(nomes: readonly string[], restanteTexto: string | null): string {
  if (nomes.length === 0) return "";
  if (nomes.length > 1) return `${nomes.length} sessões autorizadas · conferir atividade`;
  return `Sessão autorizada · ${nomeCurto(nomes[0])}${restanteTexto ? ` · ${restanteTexto}` : ""}`;
}
