// Perfil de cor do painel E da esfera do Nano.IA (uma escolha só: os dois seguem as mesmas variáveis). Guardado neste aparelho; sem storage, volta ao padrão.
// Puro e testável: quem toca no DOM é aplicarPerfil. O CSS vem de perfisCorGerador.ts (perfis-cor.css).
import { PADRAO, PERFIS } from "./perfisCorGerador.ts";

export { PERFIS, PADRAO };
const CHAVE = "conecta:cor";
const IDS = new Set(PERFIS.map((p) => p.id));
// Perfil aplicado por omissão no painel (sem escolha gravada). O PADRAO continua sendo a base do CSS.
export const APLICADO = "mobis";

export function perfilValido(v: unknown): string { return typeof v === "string" && IDS.has(v) ? v : APLICADO; }
export function lerPerfil(a: Pick<Storage, "getItem"> | null): string { try { return perfilValido(a?.getItem(CHAVE)); } catch { return APLICADO; } }
export function gravarPerfil(a: Pick<Storage, "setItem" | "removeItem"> | null, id: string): void {
  try { if (id === APLICADO) a?.removeItem(CHAVE); else a?.setItem(CHAVE, perfilValido(id)); } catch { /* sem storage: vale só nesta sessão */ }
}
/** O padrão não escreve atributo (o CSS base já é o terracota). */
export function aplicarPerfil(id: string, raiz: HTMLElement = document.documentElement): void {
  const v = perfilValido(id);
  if (v === PADRAO) raiz.removeAttribute("data-cor"); else raiz.setAttribute("data-cor", v);
}
