// Painel lateral do Nano.ia: flutuante (como o balão) ou FIXO à esquerda/direita, com largura ajustável.
// Puro e testável: não toca no DOM. O componente lê o estado, aplica a reserva de espaço e grava a escolha por navegador.
export type Modo = "flutuante" | "fixo";
export type LadoPainel = "esq" | "dir";
export interface EstadoPainel { modo: Modo; lado: LadoPainel; largura: number }

export const LARGURA_MIN = 320;
export const LARGURA_MAX = 720;
export const LARGURA_PADRAO = 420;
/** Abaixo disto a tela é de celular/tablet pequeno: o painel fixo vira sobreposição (não há espaço para dividir a tela). */
export const TELA_MIN_PARA_FIXO = 1100;
/** O conteúdo da página nunca fica com menos do que isto ao lado do painel fixo. */
export const CONTEUDO_MIN = 560;
const CHAVE = "conecta:painel";

export const PADRAO: EstadoPainel = { modo: "flutuante", lado: "dir", largura: LARGURA_PADRAO };

/** Largura válida: dentro dos limites e sem deixar menos de CONTEUDO_MIN para a página. */
export function ajustarLargura(largura: number, telaW: number): number {
  const n = Number.isFinite(largura) ? Math.round(largura) : LARGURA_PADRAO;
  const teto = Math.max(LARGURA_MIN, Math.min(LARGURA_MAX, telaW - CONTEUDO_MIN));
  return Math.min(Math.max(n, LARGURA_MIN), teto);
}

/** O painel fixo só divide a tela quando cabe; senão fica por cima (sobreposição). */
export function dividePagina(e: EstadoPainel, telaW: number, aberto: boolean): boolean {
  return aberto && e.modo === "fixo" && telaW >= TELA_MIN_PARA_FIXO;
}

/** Espaço (px) a reservar em cada borda para a página não ficar atrás do painel. */
export function reserva(e: EstadoPainel, telaW: number, aberto: boolean): { esq: number; dir: number } {
  if (!dividePagina(e, telaW, aberto)) return { esq: 0, dir: 0 };
  const l = ajustarLargura(e.largura, telaW);
  return e.lado === "esq" ? { esq: l, dir: 0 } : { esq: 0, dir: l };
}

/** Passos de teclado no separador: setas mexem 24px (Shift: 96px). Seta para dentro do painel aumenta. */
export function passoDeTeclado(tecla: string, lado: LadoPainel, shift: boolean): number {
  const passo = shift ? 96 : 24;
  if (tecla === "ArrowLeft") return lado === "dir" ? passo : -passo;
  if (tecla === "ArrowRight") return lado === "dir" ? -passo : passo;
  return 0;
}

/** Largura nova ao arrastar o separador: `x` é a posição do ponteiro na tela. */
export function larguraPeloPonteiro(x: number, lado: LadoPainel, telaW: number): number {
  return ajustarLargura(lado === "dir" ? telaW - x : x, telaW);
}

export function validar(v: unknown, telaW = 1920): EstadoPainel {
  const o = (v && typeof v === "object" ? v : {}) as Partial<EstadoPainel>;
  return {
    modo: o.modo === "fixo" ? "fixo" : "flutuante",
    lado: o.lado === "esq" ? "esq" : "dir",
    largura: ajustarLargura(typeof o.largura === "number" ? o.largura : LARGURA_PADRAO, telaW),
  };
}
export function ler(telaW = 1920, chave = CHAVE): EstadoPainel {
  try { return validar(JSON.parse(localStorage.getItem(chave) ?? "null"), telaW); } catch { return { ...PADRAO }; }
}
export function gravar(e: EstadoPainel, chave = CHAVE) {
  try { localStorage.setItem(chave, JSON.stringify(e)); } catch { /* sem armazenamento: vale só nesta sessão */ }
}
