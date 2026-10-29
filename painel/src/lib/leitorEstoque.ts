/** Normalização conservadora: nunca inferir aplicação de produto a partir de QR arbitrário. */
export function codigoDaLeitura(valor: string): string | null {
  const texto = valor.trim();
  if (!texto || texto.length > 256) return null;
  if (/^https?:\/\//i.test(texto)) {
    try {
      const u = new URL(texto);
      const v = u.searchParams.get("gtin") ?? u.searchParams.get("ean");
      return v && /^\d{8,14}$/.test(v) ? v : null;
    } catch { return null; }
  }
  if (/^\d{8,14}$/.test(texto)) return texto;
  if (/^[\p{L}\p{N}_./-]{2,80}$/u.test(texto)) return texto;
  return null;
}
export function campoCsvSeguro(valor: string): string {
  const texto = /^[=+@\-\t\r]/.test(valor.trimStart()) ? "'" + valor : valor;
  return '"' + texto.replace(/"/g, '""') + '"';
}
