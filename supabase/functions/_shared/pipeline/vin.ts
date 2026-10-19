// Decodificação OFFLINE e gratuita da estrutura do chassi (VIN, 17 caracteres). Só informativa:
// quem identifica o veículo é o prefixo OFICIAL cadastrado e aprovado (veiculo_por_chassi no banco).
// Não há tabela de montadoras aqui de propósito: nada é inventado.

const ALFABETO = "ABCDEFGHJKLMNPRSTVWXY123456789";
const PESOS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];
const VALORES: Record<string, number> = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8, J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9,
  S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
};

export interface VinDecodificado {
  valido: boolean;
  vin: string;
  erro?: string;
  wmi?: string;
  vds?: string;
  vis?: string;
  anoModeloCandidatos?: number[];
  plantaCodigo?: string;
  /** Dígito verificador (9ª posição) só vale na norma norte-americana; no Brasil NÃO é motivo de rejeição. */
  digitoVerificadorConfere?: boolean;
}

export function decodificarVin(entrada: string, anoAtual = new Date().getFullYear()): VinDecodificado {
  const vin = (entrada ?? "").toUpperCase().replace(/[\s-]/g, "");
  if (vin.length !== 17) return { valido: false, vin, erro: "o chassi tem 17 caracteres" };
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) return { valido: false, vin, erro: "caracteres inválidos (I, O e Q não existem no chassi)" };
  const idx = ALFABETO.indexOf(vin[9]);
  const candidatos: number[] = [];
  if (idx >= 0) for (let a = 1980 + idx; a <= anoAtual + 1; a += 30) candidatos.push(a);
  let soma = 0;
  for (let i = 0; i < 17; i++) soma += (/\d/.test(vin[i]) ? Number(vin[i]) : VALORES[vin[i]]) * PESOS[i];
  const r = soma % 11;
  const dv = r === 10 ? "X" : String(r);
  return {
    valido: true, vin, wmi: vin.slice(0, 3), vds: vin.slice(3, 9), vis: vin.slice(9),
    anoModeloCandidatos: candidatos, plantaCodigo: vin[10], digitoVerificadorConfere: dv === vin[8],
  };
}
