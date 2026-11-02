// Intercâmbio por MEDIDAS e material (PR #242, requisito 2; teste de aceite 3). Complementa `validarIntercambiabilidade` (aplicacoes/regras_aplicacao.ts), que exige
// "medidas conferidas" mas não as comparava. Aqui a comparação é feita, a relação é registrada com TIPO e DIREÇÃO, e código OEM igual NÃO basta.
// O QUE PROVA: se os dados informados divergem (então a relação é rejeitada) ou não divergem (então fica candidata, nunca confirmada só por isto).
// O QUE NÃO PROVA: que a peça serve; sem medidas dos dois lados o resultado é "pendente".
export type RelacaoTecnica = "substitui" | "equivalente" | "semelhante" | "incompativel";
export type Direcao = "a_para_b" | "b_para_a" | "bidirecional";
export interface Medidas {
  diametro_mm?: number; espessura_mm?: number; altura_mm?: number; comprimento_mm?: number; largura_mm?: number; dentes?: number; furos?: number;
  material?: string;
}
const NUMERICAS = ["diametro_mm", "espessura_mm", "altura_mm", "comprimento_mm", "largura_mm", "dentes", "furos"] as const;
const normMat = (s?: string) => (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

export interface ComparacaoMedidas { comparadas: string[]; divergencias: string[]; sem_dado: string[] }
export function compararMedidas(a: Medidas, b: Medidas, tolMm = 0.05): ComparacaoMedidas {
  const comparadas: string[] = [], divergencias: string[] = [], sem = new Set<string>();
  for (const k of NUMERICAS) {
    const x = a[k], y = b[k];
    if (x == null && y == null) continue;
    if (x == null || y == null) { sem.add(k); continue; }
    comparadas.push(k);
    const tol = k === "dentes" || k === "furos" ? 0 : tolMm;
    if (Math.abs(x - y) > tol) divergencias.push(`${k}: ${x} x ${y}`);
  }
  if (a.material || b.material) {
    if (!a.material || !b.material) sem.add("material");
    else { comparadas.push("material"); if (normMat(a.material) !== normMat(b.material)) divergencias.push(`material: ${a.material} x ${b.material}`); }
  }
  return { comparadas, divergencias, sem_dado: [...sem] };
}

export interface EntradaIntercambio { oemA: string; oemB: string; medidasA?: Medidas; medidasB?: Medidas; declarada: RelacaoTecnica; direcao: Direcao; evidenciaForte: boolean }
export type DecisaoIntercambio = "rejeitada" | "pendente_medidas" | "candidata" | "confirmavel";
export interface ResultadoIntercambio { decisao: DecisaoIntercambio; relacao_registrada: RelacaoTecnica; direcao: Direcao; motivos: string[]; comparacao: ComparacaoMedidas }
const cod = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "");

export function avaliarIntercambio(e: EntradaIntercambio): ResultadoIntercambio {
  const cmp = compararMedidas(e.medidasA ?? {}, e.medidasB ?? {});
  const motivos: string[] = [];
  const mesmoOem = !!cod(e.oemA) && cod(e.oemA) === cod(e.oemB);
  if (mesmoOem) motivos.push("OEM coincide: isto sozinho não prova equivalência mecânica");
  if (cmp.divergencias.length) {
    motivos.push(`medidas divergem (${cmp.divergencias.join("; ")}): intercâmbio rejeitado`);
    return { decisao: "rejeitada", relacao_registrada: "incompativel", direcao: e.direcao, motivos, comparacao: cmp };
  }
  if (e.declarada === "incompativel") return { decisao: "rejeitada", relacao_registrada: "incompativel", direcao: e.direcao, motivos: [...motivos, "relação declarada como incompatível"], comparacao: cmp };
  if (cmp.comparadas.length === 0) {
    motivos.push("sem medidas comparáveis dos dois lados: pendente");
    return { decisao: "pendente_medidas", relacao_registrada: e.declarada === "equivalente" || e.declarada === "substitui" ? "semelhante" : e.declarada, direcao: e.direcao, motivos, comparacao: cmp };
  }
  if (cmp.sem_dado.length) motivos.push(`faltam dados para comparar: ${cmp.sem_dado.join(", ")}`);
  if (e.declarada === "semelhante") return { decisao: "candidata", relacao_registrada: "semelhante", direcao: e.direcao, motivos: [...motivos, "semelhante nunca é equivalente"], comparacao: cmp };
  if (!e.evidenciaForte) return { decisao: "candidata", relacao_registrada: e.declarada, direcao: e.direcao, motivos: [...motivos, "sem evidência forte com aplicação: candidata"], comparacao: cmp };
  if (cmp.sem_dado.length) return { decisao: "candidata", relacao_registrada: e.declarada, direcao: e.direcao, motivos, comparacao: cmp };
  return { decisao: "confirmavel", relacao_registrada: e.declarada, direcao: e.direcao, motivos: [...motivos, "medidas conferem e há evidência forte: confirmável por uma pessoa"], comparacao: cmp };
}
