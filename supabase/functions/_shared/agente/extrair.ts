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
const REGRAS: Array<[RegExp, string]> = [
  [/\bFILTRO\b.*\b(OLEO|ÓLEO)\b/i, "filtro-oleo"],
  [/\bFILTRO\b.*\bAR\b(?!\s*CONDICIONADO)/i, "filtro-ar"],
  [/\bFILTRO\b.*\bCOMBUSTIVEL|COMBUSTÍVEL\b/i, "filtro-combustivel"],
  [/\bFILTRO\b.*\bCABINE\b/i, "filtro-cabine"],
];
export function classificarSlug(nome: string): string | null {
  for (const [re, slug] of REGRAS) if (re.test(nome)) return slug;
  return null;
}
