// Confere os anos escritos contra os eventos do veículo NO BRASIL. Espelha scripts/catalogo_ia/periodos.py.
// O período de venda no Brasil não é o lançamento mundial nem o ano-modelo de outro mercado.
import type { AnoInformado } from "./extracao.ts";

export interface EventoBrasil { tipo: string; ano: number; fonte?: string }
const INICIO_BR = ["inicio_importacao", "inicio_comercializacao_br", "inicio_montagem_nacional"];
const FIM_BR = ["fim_importacao", "fim_comercializacao_br", "fim_montagem_nacional"];

export function confereAnos(anos: AnoInformado[], eventos: EventoBrasil[] | null | undefined): string[] {
  if (anos.length === 0) return [];
  const validos = (eventos ?? []).filter((e) => e.fonte && e.ano);
  const inicios = validos.filter((e) => INICIO_BR.includes(e.tipo)).map((e) => e.ano);
  const fins = validos.filter((e) => FIM_BR.includes(e.tipo)).map((e) => e.ano);
  if (inicios.length === 0) return ["ano informado sem evidência do início da importação/comercialização no Brasil: ano a confirmar"];
  const pend: string[] = [];
  const iniBr = Math.min(...inicios);
  const fimBr = fins.length ? Math.max(...fins) : null;
  for (const a of anos) {
    if (a.inicio < iniBr) pend.push(`ano ${a.inicio} anterior ao início no Brasil (${iniBr}): conferir ano de fabricação x ano-modelo`);
    const limite = a.fim !== null ? a.fim : a.em_aberto ? null : a.inicio;
    if (fimBr !== null && (limite === null || limite > fimBr)) pend.push(`período informado passa do fim comprovado no Brasil (${fimBr})`);
  }
  return pend;
}
