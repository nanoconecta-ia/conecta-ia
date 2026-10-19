// Utilidades de texto do pipeline: limpeza de HTML e comparação sem acento/caixa. Espelha scripts/catalogo_ia/texto.py.
export function semHtml(s: string): string {
  const t = (s ?? "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  return t.replace(/\s+/g, " ").trim();
}

/** Forma comparável: sem acento, minúscula, espaços únicos. Aceita texto com codificação quebrada ("NãO"). */
export function chave(s: string): string {
  return (s ?? "").normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
}
