// Copiar texto para a área de transferência. Usa a API moderna e, se o navegador recusar (página sem permissão, celular), o método antigo com um campo temporário.
export async function copiarTexto(texto: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) { await navigator.clipboard.writeText(texto); return true; }
  } catch { /* cai para o método antigo */ }
  try {
    if (typeof document === "undefined") return false;
    const campo = document.createElement("textarea");
    campo.value = texto; campo.setAttribute("readonly", ""); campo.style.cssText = "position:fixed;top:0;left:0;opacity:0";
    document.body.appendChild(campo); campo.select(); campo.setSelectionRange(0, texto.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(campo);
    return ok;
  } catch { return false; }
}
