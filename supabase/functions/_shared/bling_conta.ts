// Identidade da conta Bling: o CNPJ da conta que autorizou precisa ser o da loja (evita conectar a conta errada).
export const somenteDigitos = (s: string) => s.replace(/\D/g, "");

/** CNPJ válido (14 dígitos e dígitos verificadores). */
export function cnpjValido(entrada: string): boolean {
  const c = somenteDigitos(entrada);
  if (c.length !== 14 || /^(\d)\1{13}$/.test(c)) return false;
  const dv = (base: string, pesos: number[]) => {
    const soma = base.split("").reduce((t, d, i) => t + Number(d) * pesos[i], 0) % 11;
    return soma < 2 ? 0 : 11 - soma;
  };
  const d1 = dv(c.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = dv(c.slice(0, 12) + d1, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return c.endsWith(`${d1}${d2}`);
}

export const cnpjConfere = (a: string, b: string) => somenteDigitos(a) === somenteDigitos(b) && somenteDigitos(a).length === 14;
