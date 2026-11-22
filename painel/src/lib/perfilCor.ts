// Perfil de cor do painel E da esfera do Nano.IA (uma escolha só: os dois seguem as mesmas variáveis). Guardado neste aparelho; sem storage, volta ao padrão aplicado.
// Puro e testável: quem toca no DOM é aplicarPerfil. O CSS vem de perfisCorGerador.ts (perfis-cor.css).
import { PADRAO, PERFIS } from "./perfisCorGerador.ts";

export { PERFIS, PADRAO };
/** Perfil APLICADO por padrão no boot: identidade Mobis (grafite + vermelho). terracota segue sendo a base do CSS (sem data-cor), como fallback. */
export const APLICADO = "mobis";
const CHAVE = "conecta:cor";
const IDS = new Set(PERFIS.map((p) => p.id));

export function perfilValido(v: unknown): string { return typeof v === "string" && IDS.has(v) ? v : APLICADO; }
export function lerPerfil(a: Pick<Storage, "getItem"> | null): string { try { return perfilValido(a?.getItem(CHAVE)); } catch { return APLICADO; } }
export function gravarPerfil(a: Pick<Storage, "setItem" | "removeItem"> | null, id: string): void {
  // O padrão aplicado (mobis) não precisa de storage; qualquer outra escolha (inclusive voltar ao terracota) é gravada.
  try { if (id === APLICADO) a?.removeItem(CHAVE); else a?.setItem(CHAVE, perfilValido(id)); } catch { /* sem storage: vale só nesta sessão */ }
}
/** terracota é a base do CSS (sem atributo); os demais perfis — inclusive o padrão Mobis — escrevem data-cor na raiz. */
export function aplicarPerfil(id: string, raiz: HTMLElement = document.documentElement): void {
  const v = perfilValido(id);
  if (v === PADRAO) raiz.removeAttribute("data-cor"); else raiz.setAttribute("data-cor", v);
}
