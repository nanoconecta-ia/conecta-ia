// Posição do balão do Nano.ia: arrasta, gruda na borda mais próxima e lembra onde ficou. Puro e testável.
export type Lado = "esq" | "dir";
export interface PosicaoSalva { lado: Lado; y: number | null }
export const MARGEM = 12;

/** Borda mais próxima do ponto largado e Y limitado à tela (cabeçalho e barra de status ficam livres). */
export function encaixar(x: number, y: number, tela: { w: number; h: number }, balao: { w: number; h: number }, topo = 64, rodape = 36): PosicaoSalva {
  const lado: Lado = x + balao.w / 2 < tela.w / 2 ? "esq" : "dir";
  const minY = topo + MARGEM, maxY = Math.max(minY, tela.h - balao.h - rodape - MARGEM);
  return { lado, y: Math.min(Math.max(y, minY), maxY) };
}
export function coordenadas(p: PosicaoSalva, tela: { w: number; h: number }, balao: { w: number; h: number }, rodape = 36): { x: number; y: number } {
  const x = p.lado === "esq" ? MARGEM : tela.w - balao.w - MARGEM;
  const y = p.y ?? tela.h - balao.h - rodape - MARGEM;
  return { x, y: Math.min(Math.max(y, MARGEM), Math.max(MARGEM, tela.h - balao.h - rodape - MARGEM)) };
}
/** Ponto de guia: o balão sobe para perto do título da tela que acabou de abrir (lado oposto ao conteúdo principal, fora da frente do menu). */
export function pontoDeGuia(tela: { w: number; h: number }, balao: { w: number; h: number }, topo = 64): PosicaoSalva {
  return { lado: "dir", y: Math.min(topo + 24, Math.max(MARGEM, tela.h - balao.h - 48)) };
}
export function ler(chave = "conecta:balao"): PosicaoSalva {
  try { const j = JSON.parse(localStorage.getItem(chave) ?? "null"); if (j && (j.lado === "esq" || j.lado === "dir") && (j.y === null || Number.isFinite(j.y))) return j; } catch { /* sem armazenamento */ }
  return { lado: "dir", y: null };
}
export function gravar(p: PosicaoSalva, chave = "conecta:balao") { try { localStorage.setItem(chave, JSON.stringify(p)); } catch { /* sem armazenamento */ } }
