// Contraste WCAG 2.x entre duas cores hexadecimais (usado nos testes dos tokens de cor). Puro, sem DOM.
export function luminancia(hex: string): number {
  const h = hex.replace("#", "");
  const c = (h.length === 3 ? [...h].map((x) => x + x) : h.match(/../g) ?? []).map((x) => parseInt(x, 16) / 255);
  const [r, g, b] = c.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function razao(a: string, b: string): number {
  const x = luminancia(a), y = luminancia(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
/** Lê "--nome:#hex" de um bloco de CSS. Ignora valores que não são hexadecimais. */
export function lerTokens(bloco: string): Record<string, string> {
  const t: Record<string, string> = {};
  for (const m of bloco.matchAll(/--([a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3}|#[0-9a-fA-F]{6})\b/g)) t[m[1]] = m[2];
  return t;
}
