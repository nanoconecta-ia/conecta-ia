// Modo de aparência: automático (segue o aparelho), claro, escuro, noturno (tons quentes, menos azul) ou alto contraste (fundo preto, bordas fortes, acento amarelo).
// Escolha guardada no aparelho; sem storage, volta ao automático. Puro e testável: quem toca no DOM é aplicarTema.

export type Preferencia = "auto" | "claro" | "escuro" | "noturno" | "contraste";
export const PREFERENCIAS: { valor: Preferencia; rotulo: string; descricao: string }[] = [
  { valor: "auto", rotulo: "Automático", descricao: "Segue o claro ou escuro do aparelho" },
  { valor: "claro", rotulo: "Claro", descricao: "Fundo marfim, para ambientes iluminados" },
  { valor: "escuro", rotulo: "Escuro", descricao: "Fundo grafite, menos brilho" },
  { valor: "noturno", rotulo: "Noturno", descricao: "Tons quentes e menos azul, para a noite" },
  { valor: "contraste", rotulo: "Alto contraste", descricao: "Fundo preto, bordas fortes e acento amarelo" },
];
const CHAVE = "conecta:tema";

export function preferenciaValida(v: unknown): Preferencia {
  return v === "claro" || v === "escuro" || v === "noturno" || v === "contraste" ? v : "auto";
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
