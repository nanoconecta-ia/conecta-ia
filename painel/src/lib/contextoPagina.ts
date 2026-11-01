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

/** Pedido que sai de OUTRA tela (ex.: a ficha do produto) e ainda não tem a conversa aberta: guardado por poucos segundos
 *  para a conversa preencher a caixa ao montar. Só preenche; quem envia é o lojista. */
let pendente: { texto: string; em: number } | null = null;
export const VALIDADE_PEDIDO_MS = 15_000;
export function pedirAoNanoNaConversa(texto: string, irPara: () => void = () => { window.location.hash = "#/assistente"; }): void {
  pendente = { texto, em: Date.now() };
  irPara();
  perguntarAoNano(texto); // se a conversa já estiver aberta, o evento a preenche na hora
}
/** Entrega o pedido pendente uma única vez; vencido ou já consumido devolve null. */
export function consumirPedidoPendente(agora = Date.now()): string | null {
  const p = pendente; pendente = null;
  return p && agora - p.em <= VALIDADE_PEDIDO_MS ? p.texto : null;
}
