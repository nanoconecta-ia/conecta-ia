// Comparação de evidências de fontes diferentes. Nenhum conflito é resolvido sozinho: quem decide é o lojista.
// A precedência (oficial > fornecedor > inferida) é só uma SUGESTÃO exibida junto do conflito.
export type TipoFonte = "oficial" | "fornecedor" | "bling" | "inferida";
export interface AplicacaoEvidencia { modelo: string; motor?: string; ano_inicio?: number; ano_fim?: number | null }
export interface DadosEvidencia { oem?: string[]; gtin?: string; aplicacoes?: AplicacaoEvidencia[]; peso_kg?: number; marca?: string; nome?: string }
export interface Evidencia { fonte: string; tipo_fonte: TipoFonte; consultado_em: string; dados: DadosEvidencia; nao_confiavel?: boolean; alertas?: number }
export interface LadoConflito { valor: unknown; fonte: string; tipo_fonte: TipoFonte }
export interface Conflito { tipo: "aplicacao" | "oem" | "gtin" | "medidas" | "bling_vs_enriquecimento" | "auditoria"; campo: string; lado_a: LadoConflito; lado_b: LadoConflito; sugestao?: string }

const PESO: Record<TipoFonte, number> = { oficial: 3, bling: 2, fornecedor: 2, inferida: 1 };
const normOem = (c: string) => c.toUpperCase().replace(/[^0-9A-Z]/g, "");
const norm = (s: string) => s.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const lado = (e: Evidencia, valor: unknown): LadoConflito => ({ valor, fonte: e.fonte, tipo_fonte: e.tipo_fonte });
const sugestao = (a: Evidencia, b: Evidencia): string | undefined => PESO[a.tipo_fonte] === PESO[b.tipo_fonte] ? undefined : `fonte ${PESO[a.tipo_fonte] > PESO[b.tipo_fonte] ? a.tipo_fonte : b.tipo_fonte} tende a ser mais confiável (sugestão, não decisão)`;

export function compararEvidencias(evs: Evidencia[]): Conflito[] {
  const out: Conflito[] = [];
  for (let i = 0; i < evs.length; i++) {
    for (let j = i + 1; j < evs.length; j++) {
      const a = evs[i], b = evs[j];
      // OEM: dois conjuntos sem nenhum código em comum para o mesmo SKU
      const oa = new Set((a.dados.oem ?? []).map(normOem)), ob = new Set((b.dados.oem ?? []).map(normOem));
      if (oa.size && ob.size && ![...oa].some((c) => ob.has(c))) out.push({ tipo: "oem", campo: "codigo_oem", lado_a: lado(a, [...oa]), lado_b: lado(b, [...ob]), sugestao: sugestao(a, b) });
      // GTIN diferente
      if (a.dados.gtin && b.dados.gtin && a.dados.gtin.replace(/\D/g, "") !== b.dados.gtin.replace(/\D/g, "")) {
        out.push({ tipo: a.tipo_fonte === "bling" || b.tipo_fonte === "bling" ? "bling_vs_enriquecimento" : "gtin", campo: "gtin", lado_a: lado(a, a.dados.gtin), lado_b: lado(b, b.dados.gtin), sugestao: sugestao(a, b) });
      }
      // peso muito diferente (>25%): um dos dois está errado
      const pa = a.dados.peso_kg, pb = b.dados.peso_kg;
      if (pa && pb && Math.abs(pa - pb) / Math.max(pa, pb) > 0.25) out.push({ tipo: "medidas", campo: "peso_kg", lado_a: lado(a, pa), lado_b: lado(b, pb), sugestao: sugestao(a, b) });
      // aplicação: mesmo modelo, motor diferente ou períodos que não se tocam
      for (const x of a.dados.aplicacoes ?? []) {
        for (const y of b.dados.aplicacoes ?? []) {
          if (norm(x.modelo) !== norm(y.modelo)) continue;
          if (x.motor && y.motor && norm(x.motor) !== norm(y.motor)) out.push({ tipo: "aplicacao", campo: `motor (${x.modelo})`, lado_a: lado(a, x.motor), lado_b: lado(b, y.motor), sugestao: sugestao(a, b) });
          const ia = x.ano_inicio, ib = y.ano_inicio;
          if (ia && ib) {
            const fa = x.ano_fim ?? 9999, fb = y.ano_fim ?? 9999;
            if (fa < ib || fb < ia) out.push({ tipo: "aplicacao", campo: `periodo (${x.modelo})`, lado_a: lado(a, `${ia}-${x.ano_fim ?? ""}`), lado_b: lado(b, `${ib}-${y.ano_fim ?? ""}`), sugestao: sugestao(a, b) });
            // períodos que se tocam mas começam em anos diferentes (ex.: 2013 x 2014) também divergem: é o erro de ano-modelo que gera peça errada
            else if (ia !== ib) out.push({ tipo: "aplicacao", campo: `inicio do periodo (${x.modelo})`, lado_a: lado(a, ia), lado_b: lado(b, ib), sugestao: sugestao(a, b) });
          }
        }
      }
    }
  }
  return out;
}
