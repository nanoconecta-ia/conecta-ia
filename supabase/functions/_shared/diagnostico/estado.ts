// Diagnóstico de IA e do gateway da loja, SOMENTE LEITURA, para o Nano (chat e MCP) responder "quem está respondendo, por que falhou, quanto demorou".
// Entrada = linhas já lidas do banco (loja_chaves_ia sem chave/cifra/base_url; mensagens.metadados). Saída = fatos, nunca segredo nem texto de conversa.
import { categoriaDoStatus, type CategoriaErro } from "./correlacao.ts";

export interface LinhaProvedor { provedor: string; ativa: boolean; modelo: string | null; principal: boolean; failover: boolean; limite_mensal_tokens: number | null; tokens_mes: number | null; ultimo_uso_em: string | null }
export interface LinhaTurno { criada_em: string; metadados: Record<string, unknown> | null }

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v: unknown, max = 80): string | null => (typeof v === "string" && v ? v.slice(0, max) : null);

export function resumirTurno(l: LinhaTurno) {
  const m = l.metadados ?? {};
  const status = num(m.http_status);
  return {
    quando: l.criada_em, request_id: str(m.request_id, 40), provedor: str(m.provedor_efetivo) ?? str(m.provedor), modelo: str(m.modelo), http_status: status,
    categoria: (str(m.categoria_erro) as CategoriaErro | null) ?? (status != null ? categoriaDoStatus(status) : null), latencia_ms: num(m.latencia_ms),
    desfecho: str(m.desfecho), troca_de: str(String(m.troca_de ?? ""), 40), troca_motivo: num(m.troca_motivo), codigo: str(m.codigo, 40),
  };
}

export function montarDiagnostico(provedores: LinhaProvedor[], turnos: LinhaTurno[], agora = new Date()) {
  const resumo = turnos.map(resumirTurno);
  const porCategoria: Record<string, number> = {};
  for (const t of resumo) if (t.categoria) porCategoria[t.categoria] = (porCategoria[t.categoria] ?? 0) + 1;
  const lat = resumo.map((t) => t.latencia_ms).filter((v): v is number => v != null).sort((a, b) => a - b);
  const modo = (p: LinhaProvedor) => (p.provedor === "openrouter_free" ? (p.failover ? "automatico" : p.ativa ? "manual" : "desligado") : undefined);
  return {
    gerado_em: agora.toISOString(),
    provedores: provedores.map((p) => ({
      provedor: p.provedor, ativo: p.ativa, tem_modelo: !!p.modelo, modelo: p.modelo, principal: p.principal, modo_gratuito: modo(p),
      limite_mensal_tokens: p.limite_mensal_tokens, tokens_mes: p.tokens_mes, limite_atingido: p.limite_mensal_tokens != null && (p.tokens_mes ?? 0) >= p.limite_mensal_tokens, ultimo_uso_em: p.ultimo_uso_em,
    })),
    provedores_ativos: provedores.filter((p) => p.ativa).map((p) => p.provedor),
    ultimos_turnos: resumo.slice(0, 10),
    contagem_por_categoria: porCategoria,
    latencia_ms: lat.length ? { p50: lat[Math.floor((lat.length - 1) * 0.5)], max: lat[lat.length - 1], amostras: lat.length } : null,
    ausencias_conhecidas: [
      "Os turnos só carregam request_id/latência a partir da versão com correlação; turnos anteriores aparecem sem esses campos.",
      "Chamadas via gateway MCP não gravam turno: o request_id vem na resposta (_meta.request_id e cabeçalho x-request-id) e no log da plataforma.",
    ],
  };
}
