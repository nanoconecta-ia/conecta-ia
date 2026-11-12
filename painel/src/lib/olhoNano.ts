// Olho do Nano (E02): geometria pura da animação. Só interface; não lê nem envia o que a pessoa digita.

export type Caixa = { left: number; top: number; right: number; bottom: number; width: number; height: number };
export type Ponto = { x: number; y: number };

const MARGEM = 34;
const limitar = (v: number, min: number, max: number) => Math.max(min, Math.min(Math.max(min, max), v));

/** Ponto de repouso: canto direito da âncora (o cabeçalho do Estúdio, que existe em qualquer largura). Âncora sem área → null. */
export function pontoCasa(ancora: Caixa | null, largura: number, altura: number): Ponto | null {
  if (!ancora || !ancora.width || !ancora.height) return null;
  const recuo = largura < 780 ? 30 : 46;
  return { x: limitar(ancora.right - recuo, MARGEM, largura - MARGEM), y: limitar(ancora.top + ancora.height / 2, MARGEM, altura - MARGEM) };
}

/** Ponto de observação: ao lado do campo em foco (direita se couber, senão esquerda), sem sair da tela. Campo sem área → null. */
export function pontoFoco(campo: Caixa | null, largura: number, altura: number): Ponto | null {
  if (!campo || !campo.width || !campo.height) return null;
  const x = campo.right + 42 < largura ? campo.right + 37 : campo.left - 37;
  return { x: limitar(x, MARGEM, largura - MARGEM), y: limitar(campo.top + Math.min(campo.height / 2, MARGEM), MARGEM, altura - MARGEM) };
}

export const ESCALA_FOCO = 0.72;
export const VOLTA_MS = 1350;
export const SOME_MS = 6500;
