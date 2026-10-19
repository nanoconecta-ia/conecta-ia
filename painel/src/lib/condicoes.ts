// Regras puras da tela "Pagamento e entrega". O banco é quem garante (constraints e trigger); aqui só validamos para o lojista
// ver o motivo antes de enviar e para a tela mostrar o estado de cada item: rascunho, aprovada oculta ou visível no site.
export type Situacao = "rascunho" | "aprovada_oculta" | "visivel";
export interface ItemComStatus { status: "rascunho" | "aprovada"; visivel_no_site: boolean }

export const FORMAS: [string, string][] = [
  ["pix", "Pix"], ["cartao_credito", "Cartão de crédito"], ["cartao_debito", "Cartão de débito"],
  ["boleto", "Boleto"], ["transferencia", "Transferência"], ["dinheiro", "Dinheiro"], ["outra", "Outra"],
];
export const TIPOS_ENTREGA: [string, string][] = [["retirada_na_loja", "Retirada na loja"], ["entrega_propria", "Entrega própria"], ["transportadora", "Transportadora"]];

export const situacao = (i: ItemComStatus): Situacao => (i.status !== "aprovada" ? "rascunho" : i.visivel_no_site ? "visivel" : "aprovada_oculta");
export const ROTULO_SITUACAO: Record<Situacao, string> = { rascunho: "Rascunho (não aparece no site)", aprovada_oculta: "Aprovada, oculta do site", visivel: "Visível no site" };

/** CEP só com 8 dígitos; aceita 01310-100. */
export function normalizarCep(s: string): string | null {
  const d = (s ?? "").replace(/\D/g, "");
  return d.length === 8 ? d : null;
}
export const formatarCep = (d: string) => (d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : d);

export interface FormRegra { tipo: string; cepInicio: string; cepFim: string; prazoMin: string; prazoMax: string; valorFrete: string; gratisAcima: string; fonte: string }
export type Resultado<T> = { ok: true; valor: T } | { ok: false; erro: string };

const num = (s: string): number | null => { const t = s.trim().replace(",", "."); if (t === "") return null; const n = Number(t); return Number.isFinite(n) ? n : NaN; };

/** Converte o formulário em linha do banco, ou explica o que está errado. */
export function montarRegra(f: FormRegra): Resultado<{ tipo: string; cep_inicio: string; cep_fim: string; prazo_dias_min: number | null; prazo_dias_max: number | null; valor_frete: number | null; frete_gratis_acima: number | null; fonte: string }> {
  const ini = normalizarCep(f.cepInicio), fim = normalizarCep(f.cepFim);
  if (!ini || !fim) return { ok: false, erro: "CEP inicial e final precisam ter 8 dígitos." };
  if (fim < ini) return { ok: false, erro: "O CEP final não pode ser menor que o inicial." };
  if (!f.fonte.trim()) return { ok: false, erro: "Diga de onde vem a regra (tabela da transportadora, política da loja...)." };
  const min = num(f.prazoMin), max = num(f.prazoMax), frete = num(f.valorFrete), gratis = num(f.gratisAcima);
  for (const [n, v] of [["prazo mínimo", min], ["prazo máximo", max], ["valor do frete", frete], ["frete sem custo acima de", gratis]] as const) if (Number.isNaN(v)) return { ok: false, erro: `${n}: use apenas números.` };
  for (const [n, v] of [["prazo mínimo", min], ["prazo máximo", max]] as const) if (v !== null && (!Number.isInteger(v) || v < 0 || v > 90)) return { ok: false, erro: `${n}: inteiro de 0 a 90 dias.` };
  if (min !== null && max !== null && max < min) return { ok: false, erro: "O prazo máximo não pode ser menor que o mínimo." };
  if ((frete !== null && frete < 0) || (gratis !== null && gratis <= 0)) return { ok: false, erro: "Valores de frete não podem ser negativos (e o limite de frete sem custo precisa ser maior que zero)." };
  return { ok: true, valor: { tipo: f.tipo, cep_inicio: ini, cep_fim: fim, prazo_dias_min: min as number | null, prazo_dias_max: max as number | null, valor_frete: frete as number | null, frete_gratis_acima: gratis as number | null, fonte: f.fonte.trim() } };
}

/** O que falta para o lojista poder aprovar uma regra. */
export const faltaParaAprovarRegra = (r: { prazo_dias_max: number | null }): string | null => (r.prazo_dias_max == null ? "Informe o prazo máximo em dias: sem ele não se promete prazo." : null);
export const faltaParaAprovarForma = (f: { forma: string; parcelas_max: number | null }): string | null => (f.parcelas_max != null && f.forma !== "cartao_credito" ? "Parcelas só valem para cartão de crédito." : null);
