// Extração determinística do texto do cadastro. Cada valor devolvido aparece literalmente no texto de origem.
// Espelha scripts/catalogo_ia (Python); os dois são conferidos pelos mesmos casos em scripts/catalogo_ia/tests/golden_extracao.json.
import { chave, semHtml } from "./texto.ts";

export interface CandidatoOem { original: string; normalizado: string; separador_original: boolean; rotulado: boolean; confianca: "media" | "baixa" }
export interface AnoInformado { inicio: number; fim: number | null; em_aberto: boolean; trecho: string }

// códigos citados no cadastro do piloto e na genealogia; ampliar só com fonte
export const MOTORES_CONHECIDOS = ["D4CB", "D4BH", "4D56", "1KD-FTV", "2KD-FTV", "F1AE", "J2"];
const VEICULOS = ["Hyundai", "Kia", "HR", "Bongo", "K2500", "Sorento", "Starex", "H100", "H-1", "H350", "Porter"];
const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function rotulado(texto: string, ini: number): boolean {
  const antes = texto.slice(Math.max(0, ini - 25), ini).toLowerCase();
  return ["oem", "original", "genuin", "hyundai", "kia", "mobis"].some((p) => antes.includes(p));
}

/** 5 dígitos + 5 alfanuméricos. A mesma forma serve a códigos de outras marcas (ex.: 15105605RS): sem separador e sem rótulo a confiança é "baixa". */
export function candidatosOem(texto: string): CandidatoOem[] {
  const achados = new Map<string, CandidatoOem>();
  for (const m of (texto ?? "").matchAll(/(?<![0-9A-Za-z])([0-9]{5})([ .\-/_]?)([0-9][0-9A-Za-z]{4})(?![0-9A-Za-z])/g)) {
    const norm = `${m[1]}-${m[3].toUpperCase()}`;
    const sep = m[2] !== "";
    const rot = rotulado(texto, m.index ?? 0);
    const c: CandidatoOem = { original: m[0], normalizado: norm, separador_original: sep, rotulado: rot, confianca: sep || rot ? "media" : "baixa" };
    const atual = achados.get(norm);
    if (!atual || atual.confianca === "baixa") achados.set(norm, c);
  }
  return [...achados.values()];
}

export function gtinValido(g: string): boolean {
  const d = (g ?? "").replace(/\D/g, "");
  if (![8, 12, 13, 14].includes(d.length) || d !== (g ?? "").trim()) return false;
  let soma = 0;
  [...d.slice(0, -1)].reverse().forEach((x, i) => { soma += Number(x) * (i % 2 === 0 ? 3 : 1); });
  return (10 - (soma % 10)) % 10 === Number(d[d.length - 1]);
}

/** Só anos que o texto diz. "2013+" vira início 2013 sem fim; nada é expandido. */
export function anosInformados(texto: string): AnoInformado[] {
  const saida: AnoInformado[] = [];
  const vistos = new Set<string>();
  for (const m of (texto ?? "").matchAll(/(?<!\d)((?:19|20)\d{2})(\s*\+|\s*[-/a]\s*((?:19|20)\d{2}))?(?!\d)/g)) {
    const ini = Number(m[1]);
    const fim = m[3] ? Number(m[3]) : null;
    const aberto = (m[2] ?? "").includes("+");
    const k = `${ini}|${fim}|${aberto}`;
    if (vistos.has(k)) continue;
    vistos.add(k);
    saida.push({ inicio: ini, fim, em_aberto: aberto, trecho: m[0].trim() });
  }
  return saida;
}

export function emissoes(texto: string): string[] {
  const romano: Record<string, string> = { I: "1", II: "2", III: "3", IV: "4", V: "5", VI: "6" };
  const achados: string[] = [];
  for (const m of chave(texto).matchAll(/euro\s*([ivx]+|\d)/g)) {
    const v = m[1].toUpperCase();
    const e = `Euro ${romano[v] ?? v}`;
    if (!achados.includes(e)) achados.push(e);
  }
  return achados;
}

export const motores = (texto: string): string[] => MOTORES_CONHECIDOS.filter((c) => new RegExp(`(?<![A-Z0-9])${escapar(c)}(?![A-Z0-9])`).test(texto.toUpperCase()));
export const veiculosCitados = (texto: string): string[] => VEICULOS.filter((v) => new RegExp(`(?<![A-Z0-9])${escapar(v.toUpperCase())}(?![A-Z0-9])`).test(texto.toUpperCase()));

/** Separa a cláusula "NÃO SE APLICA: ..." do resto. O que ela cita é EXCLUSÃO, nunca aplicação. */
export function separarNaoSeAplica(texto: string): { aplicacao: string; clausula: string | null } {
  const t = texto.replace(/[ãÃ]/g, "a");
  const m = /n[aã]o se aplica\s*:?\s*(.+?)(?:\.\s|$)/id.exec(t);
  if (!m || !m.indices) return { aplicacao: texto, clausula: null };
  const [ini, fim] = m.indices[1];
  return { aplicacao: `${texto.slice(0, m.index)} ${texto.slice(m.index + m[0].length)}`.trim(), clausula: texto.slice(ini, fim).trim() };
}
export const naoSeAplica = (texto: string): string | null => separarNaoSeAplica(texto).clausula;

export interface Extracao {
  sku: string;
  codigos_oem: CandidatoOem[];
  marca_fabricante: string | null;
  gtin: { valor: string; valido: boolean } | null;
  aplicacao: { veiculos_citados: string[]; motores: string[]; emissoes: string[]; anos_informados: AnoInformado[] };
  nao_se_aplica: string | null;
  excluido: { motores: string[]; emissoes: string[]; anos_informados: AnoInformado[] };
  texto_fonte: string;
}

/** Motor, emissão e ano só contam como APLICAÇÃO fora da cláusula NÃO SE APLICA; dentro dela são exclusões. */
export function extrair(sku: string, nome: string, descricao: string, marca = "", gtin = ""): Extracao {
  const desc = semHtml(descricao);
  const texto = `${nome}. ${desc}`.trim();
  const { aplicacao: ta, clausula } = separarNaoSeAplica(texto);
  return {
    sku,
    codigos_oem: candidatosOem(ta),
    marca_fabricante: marca.trim() || null,
    gtin: gtin ? { valor: gtin, valido: gtinValido(gtin) } : null,
    aplicacao: { veiculos_citados: veiculosCitados(ta), motores: motores(ta), emissoes: emissoes(ta), anos_informados: anosInformados(ta) },
    nao_se_aplica: clausula,
    excluido: { motores: motores(clausula ?? ""), emissoes: emissoes(clausula ?? ""), anos_informados: anosInformados(clausula ?? "") },
    texto_fonte: texto,
  };
}
