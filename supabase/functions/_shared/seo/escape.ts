// Escapes de saída. Nada vindo do banco ou do Bling entra em HTML, XML ou JSON-LD sem passar por aqui.
const CTRL_XML = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g;

/** Texto/atributo HTML. */
export function esc(s: unknown): string {
  return String(s ?? "").replace(CTRL_XML, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
/** Texto XML (feed, sitemap): mesmo escape, sem caracteres de controle inválidos em XML 1.0. */
export const escXml = esc;

/** JSON seguro dentro de <script type="application/ld+json">: nada fecha a tag nem quebra o parser. */
export function jsonSeguro(obj: unknown): string {
  return JSON.stringify(obj).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}
export const scriptJsonLd = (obj: unknown) => `<script type="application/ld+json">${jsonSeguro(obj)}</script>`;

/** Corta em limite de caracteres, preferindo fronteira de palavra. Não acrescenta reticências (não inventa texto). */
export function truncar(s: string, max: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const corte = t.slice(0, max);
  const i = corte.lastIndexOf(" ");
  return (i > max * 0.6 ? corte.slice(0, i) : corte).trim();
}
