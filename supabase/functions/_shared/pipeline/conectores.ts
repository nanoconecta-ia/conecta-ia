// Conectores de pesquisa modulares. API primeiro; navegação automatizada só quando permitida e autorizada.
// Nunca se contorna autenticação, bloqueio ou controle de acesso: conector sem autorização é ignorado, e erro de acesso é registrado, não driblado.
import { extrair, type Extracao } from "./extracao.ts";
import type { AplicacaoEvidencia, DadosEvidencia, Evidencia, TipoFonte } from "./comparacao.ts";
import { sanearConteudoExterno } from "./saneamento.ts";

export type AcessoConector = "api" | "navegacao" | "fixture";
export interface Consulta { sku: string; oem: string[]; gtin?: string; marca?: string }
export interface ResultadoBruto { fonte: string; tipo_fonte: TipoFonte; texto?: string; dados?: DadosEvidencia; consultado_em?: string }
export interface ConectorPesquisa {
  id: string;
  acesso: AcessoConector;
  /** O dono/contrato autorizou este conector (termos da fonte, chave de API). Sem isso ele não é chamado. */
  autorizado: boolean;
  buscar(consulta: Consulta, sinal?: AbortSignal): Promise<ResultadoBruto[]>;
}
export interface RelatorioConectores { evidencias: Evidencia[]; ignorados: { id: string; motivo: string }[]; falhas: { id: string; erro: string }[]; tentados: number }

const MODELOS = ["HR", "Bongo", "K2500", "Sorento", "Starex", "H100", "H-1", "H350", "Porter"];

/** Aplicação só quando o texto aponta UM veículo e no máximo UM motor; com mais de um, o texto é ambíguo e não se adivinha (um anúncio por versão). */
export function aplicacoesDeExtracao(e: Extracao): { aplicacoes: AplicacaoEvidencia[]; ambigua: boolean } {
  const modelos = e.aplicacao.veiculos_citados.filter((v) => MODELOS.includes(v));
  if (modelos.length === 0) return { aplicacoes: [], ambigua: false };
  if (modelos.length > 1 || e.aplicacao.motores.length > 1) return { aplicacoes: [], ambigua: true };
  const ano = e.aplicacao.anos_informados[0];
  return { aplicacoes: [{ modelo: modelos[0], motor: e.aplicacao.motores[0], ano_inicio: ano?.inicio, ano_fim: ano ? ano.fim : undefined }], ambigua: false };
}

export function paraEvidencia(r: ResultadoBruto, sku: string, agora: string): { evidencia: Evidencia; ambigua: boolean } {
  let dados: DadosEvidencia = { ...(r.dados ?? {}) };
  let alertas = 0, ambigua = false;
  if (r.texto) {
    const limpo = sanearConteudoExterno(r.texto);
    alertas = limpo.alertas.length;
    const e = extrair(sku, "", limpo.texto);
    const ap = aplicacoesDeExtracao(e);
    ambigua = ap.ambigua;
    dados = {
      ...dados,
      oem: dados.oem ?? e.codigos_oem.filter((c) => c.confianca === "media").map((c) => c.normalizado),
      aplicacoes: dados.aplicacoes ?? ap.aplicacoes,
    };
  }
  return { evidencia: { fonte: r.fonte, tipo_fonte: r.tipo_fonte, consultado_em: r.consultado_em ?? agora, dados, nao_confiavel: alertas > 0 || undefined, alertas: alertas || undefined }, ambigua };
}

const comTempo = <T>(p: Promise<T>, ms: number): Promise<T> =>
  new Promise<T>((ok, erro) => { const t = setTimeout(() => erro(new Error(`tempo esgotado (${ms} ms)`)), ms); p.then((v) => { clearTimeout(t); ok(v); }, (e) => { clearTimeout(t); erro(e); }); });

export async function consultarConectores(conectores: ConectorPesquisa[], consulta: Consulta, opc: { agora: string; timeoutMs?: number; permitirNavegacao?: boolean }): Promise<RelatorioConectores & { ambiguas: string[] }> {
  const rel: RelatorioConectores & { ambiguas: string[] } = { evidencias: [], ignorados: [], falhas: [], tentados: 0, ambiguas: [] };
  for (const c of conectores) {
    if (!c.autorizado) { rel.ignorados.push({ id: c.id, motivo: "sem autorização do dono/contrato" }); continue; }
    if (c.acesso === "navegacao" && !opc.permitirNavegacao) { rel.ignorados.push({ id: c.id, motivo: "navegação automatizada não permitida nesta execução" }); continue; }
    rel.tentados++;
    try {
      const brutos = await comTempo(c.buscar(consulta), opc.timeoutMs ?? 15000);
      for (const b of brutos) {
        const { evidencia, ambigua } = paraEvidencia(b, consulta.sku, opc.agora);
        rel.evidencias.push(evidencia);
        if (ambigua) rel.ambiguas.push(b.fonte);
      }
    } catch (e) {
      rel.falhas.push({ id: c.id, erro: e instanceof Error ? e.message : String(e) });
    }
  }
  return rel;
}

/** Conector de teste: devolve resultados fixos. Não acessa rede. */
export const conectorFixture = (id: string, resultados: ResultadoBruto[], tipo: Partial<ConectorPesquisa> = {}): ConectorPesquisa =>
  ({ id, acesso: "fixture", autorizado: true, buscar: async () => resultados, ...tipo });
