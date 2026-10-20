// Modo de aparência: automático (segue o aparelho), claro, escuro ou noturno (tons quentes, menos azul).
// Escolha guardada no aparelho; sem storage, volta ao automático. Puro e testável: quem toca no DOM é aplicarTema.

export type Preferencia = "auto" | "claro" | "escuro" | "noturno";
export const PREFERENCIAS: { valor: Preferencia; rotulo: string }[] = [
  { valor: "auto", rotulo: "Auto" }, { valor: "claro", rotulo: "Claro" }, { valor: "escuro", rotulo: "Escuro" }, { valor: "noturno", rotulo: "Noturno" },
];
const CHAVE = "conecta:tema";

export function preferenciaValida(v: unknown): Preferencia {
  return v === "claro" || v === "escuro" || v === "noturno" ? v : "auto";
}

/** Valor do atributo data-tema: automático não escreve nada (o CSS segue prefers-color-scheme). */
export function atributoDoTema(p: Preferencia): string | null {
  return p === "auto" ? null : p;
}

export function lerPreferencia(armazem: Pick<Storage, "getItem"> | null): Preferencia {
  try { return preferenciaValida(armazem?.getItem(CHAVE)); } catch { return "auto"; }
}
export function gravarPreferencia(armazem: Pick<Storage, "setItem" | "removeItem"> | null, p: Preferencia): void {
  try { if (p === "auto") armazem?.removeItem(CHAVE); else armazem?.setItem(CHAVE, p); } catch { /* sem storage: vale só nesta sessão */ }
}

export function armazemLocal(): Storage | null {
  try { return typeof localStorage === "undefined" ? null : localStorage; } catch { return null; }
}

export function aplicarTema(p: Preferencia, raiz: HTMLElement = document.documentElement): void {
  const a = atributoDoTema(p);
  if (a) raiz.setAttribute("data-tema", a); else raiz.removeAttribute("data-tema");
}
