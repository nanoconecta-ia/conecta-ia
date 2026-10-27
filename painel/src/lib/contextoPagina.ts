// Contexto da tela atual para o painel lateral: a página PUBLICA o mapa dela (só contagens e rótulos já higienizados) e o painel
// assina. Nada sai do navegador por aqui: o mapa só vira pergunta ao Nano.ia quando o lojista clica em "Perguntar".
import { higienizar, type MapaNo } from "./mapaPagina.ts";

export interface ContextoPagina { rota: string; titulo: string; mapa: MapaNo; em: number }
let atual: ContextoPagina | null = null;
const ouvintes = new Set<() => void>();

export function publicar(rota: string, titulo: string, mapa: MapaNo | null): void {
  const limpo = mapa ? higienizar(mapa) : null;
  atual = limpo ? { rota, titulo, mapa: limpo, em: Date.now() } : null;
  ouvintes.forEach((f) => f());
}
/** Despublica só se o contexto ainda for da rota que está saindo (evita apagar o da tela nova). */
export function despublicar(rota: string): void { if (atual?.rota === rota) { atual = null; ouvintes.forEach((f) => f()); } }
export const assinar = (f: () => void) => { ouvintes.add(f); return () => { ouvintes.delete(f); }; };
export const obter = () => atual;

/** Pedido do painel para o chat do Nano.ia: preenche a caixa de texto (não envia sozinho). */
export function perguntarAoNano(texto: string): void {
  window.dispatchEvent(new CustomEvent("nano:perguntar", { detail: { texto } }));
}
