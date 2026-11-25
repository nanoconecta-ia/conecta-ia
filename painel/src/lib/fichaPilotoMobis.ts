import type { FichaProduto } from "./ficha.ts";
export type CampoTecnicoMobis = { rotulo: string; valor: string; icone: string; origem?: string };

/** CI003696: somente características explícitas no cadastro e combustível documentado
 * para a família D4CB (docs/mobis/catalogo/CI003696-ficha-proposta-web-20261119.md).
 * Não deduz ano, OEM, compatibilidade, preço nem composição de acessórios. */
export function fichaPilotoMobis(p: FichaProduto): CampoTecnicoMobis[] | null {
  if (p.sku !== "CI003696") return null;
  const texto = p.nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  const campos: CampoTecnicoMobis[] = [];
  const add = (rotulo: string, valor: string, icone: string, origem?: string) => campos.push({ rotulo, valor, icone, origem });
  if (/\bD4CB\b/.test(texto) && !/\bD4BH\b/.test(texto)) {
    add("Motor", "D4CB", "motor", "Cadastro Bling");
  }
  if (/\b2[.,]5\b/.test(texto)) add("Cilindrada", "2,5 L", "motor");
  if (/\b16\s*V\b/.test(texto) && !/\b8\s*V\b/.test(texto)) add("Válvulas", "16V", "motor");
  if (campos.some(c => c.rotulo === "Motor")) add("Combustível", "Diesel", "alimentacao", "Família motriz");
  if (/\bEURO\s*(?:V|5)\b/.test(texto) && !/\bEURO\s*(?:III|IV|VI|3|4|6)\b/.test(texto)) add("Emissão", "Euro V", "escapamento");
  if (/\bPARCIAL\b/.test(texto) && /\b(?:C\s*\/|COM)\s*CABECOTE\b/.test(texto)) add("Tipo", "Parcial c/ cabeçote", "motor");
  if (/\bNOVO\b/.test(texto) && !/\b(?:USADO|RETIFICADO|RECONDICIONADO|REMANUFATURADO)\b/.test(texto)) add("Condição", "Novo", "todas");
  if (p.marca?.trim()) add("Marca", p.marca.trim(), "todas");
  add("Código", p.sku, "todas");
  return campos;
}
