// Extrai do TEXTO LITERAL do nome do produto. Nunca infere: o que não está escrito volta null.
// Tudo que sai daqui entra como a_confirmar (fonte = nome do produto no Bling).
export interface ExtraidoDoNome {
  marca: string | null;
  veiculo: string | null;
  cilindrada: string | null;
  valvulas: number | null;
  anoInicial: number | null;
  motor: string | null;
}

const NAO_E_MOTOR = new Set(["EURO", "BIOD", "TURBO", "DIESEL", "NOVO", "MARCA"]);

export function extrairDoNome(nome: string): ExtraidoDoNome {
  const n = nome.replace(/\s+/g, " ").trim();
  const marcaM = n.match(/MARCA:\s*(.+?)\s*$/i);
  const marca = marcaM ? marcaM[1].trim() : null;

  // Veículo = trecho "HR/K2500" imediatamente antes da cilindrada "2.5".
  const veic = n.match(/\b([A-Z0-9]{1,8}(?:\s*\/\s*[A-Z0-9]{1,8})*)\s+(\d[.,]\d)\b/i);
  const veiculo = veic ? veic[1].replace(/\s*\/\s*/g, "/").toUpperCase() : null;
  const cilindrada = veic ? veic[2].replace(",", ".") : null;

  const valv = n.match(/\b(\d{1,2})V\b/i);
  const valvulas = valv ? Number(valv[1]) : null;

  // "13/" = a partir de 2013. Marcado como inferência de ano de 2 dígitos (confiança menor no plano).
  const ano = n.match(/\b(\d{2})\/(?=\s|$)/);
  const anoInicial = ano ? (Number(ano[1]) <= 50 ? 2000 : 1900) + Number(ano[1]) : null;

  // Motor = token alfanumérico logo depois de cilindrada/válvulas/ano. Só aceita letra+dígito (ex.: D4CB).
  let motor: string | null = null;
  if (veic) {
    const resto = n.slice((veic.index ?? 0) + veic[0].length);
    const m = resto.match(/^(?:\s+\d{1,2}V)?(?:\s+\d{2}\/)?\s+([A-Z][A-Z0-9]{2,5}|[0-9][A-Z0-9]{2,5})\b/);
    if (m && /[A-Z]/.test(m[1]) && /\d/.test(m[1]) && !NAO_E_MOTOR.has(m[1])) motor = m[1];
  }
  return { marca, veiculo, cilindrada, valvulas, anoInicial, motor };
}

// Palavras-chave -> slug da taxonomia. Sem correspondência clara, null (o agente não chuta).
// O nome é normalizado (maiúsculas, sem acento) e as regras valem em QUALQUER posição do nome, porque há
// cadastros que começam por código ("10215 - BOMBA DE OLEO"). A ORDEM importa: a primeira regra que casa vence,
// então as mais específicas vêm antes (motor de partida antes de motor; bronzina de biela antes de biela).
// Classificar pelo nome é só um palpite rastreável: o dado entra como a_confirmar, nunca como fato.
const EXCLUIR: RegExp[] = [
  /^(TAMPA|CAIXA|CARCACA|SUPORTE)\b.*\bFILTRO\b/, // caixa/tampa de filtro não é o filtro
  /^(TUBO|MANGUEIRA|SENSOR|BATENTE|BUCHA|COXIM)\b/, // acessórios que só citam a peça na aplicação
];
const REGRAS: Array<[RegExp, string]> = [
  [/\bMOTOR\s+(DE\s+)?PARTIDA\b/, "motores-partida"],
  [/\bBOMBA\b.*\b(AGUA|DAGUA)\b/, "bombas-agua"],
  [/\bBOMBA\b.*\bOLEO\b/, "bomba-oleo"],
  [/\bFILTRO\b.*\b(OLEO|LUBRIFICANTE)\b/, "filtro-oleo"],
  [/\bFILTRO\b.*\bCOMBUSTIVEL\b/, "filtro-combustivel"],
  [/\bFILTRO\b.*\bCABINE\b/, "filtro-cabine"],
  [/\bFILTRO\b.*\bAR\b(?!\s*CONDICIONADO)/, "filtro-ar"],
  [/\bBRONZINA\b.*\bBIELA\b/, "bronzinas-biela"],
  [/\b(JUNTA|JUNTAS|RETENTOR)\b/, "juntas-retentores"],
  [/\b(CORREIA|CORREIAS|TENSOR|TENSIONADOR|DISTRIBUICAO)\b/, "correias-tensores"],
  [/\bBLOCO\b.*\bMOTOR\b|^MOTOR\b/, "blocos-motores"], // antes de cabeçote: "MOTOR PARCIAL C/ CABECOTE" é motor
  [/\b(CABECOTE|BALANCIM|TUCHO)\b|\bCOMANDO\s+(DE\s+)?VALVULAS?\b|\bEIXO\s+COMANDO\b/, "cabecote-valvulas"],
  [/\bBIELA\b/, "bielas"],
  [/^BANDEJA\b/, "bandejas"],
  [/^OLEO\b.*\bMOTOR\b/, "oleos-motor"],
];

export function normalizarNome(nome: string): string {
  return nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/['\u2019`\u00b4]/g, "").replace(/\s+/g, " ").trim();
}

export function classificarSlug(nome: string): string | null {
  const n = normalizarNome(nome);
  if (EXCLUIR.some((re) => re.test(n))) return null;
  for (const [re, slug] of REGRAS) if (re.test(n)) return slug;
  return null;
}
