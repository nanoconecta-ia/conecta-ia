// Modelo da esfera do Nano.IA no cabeçalho: cristal (padrão), olho, sol, átomo ou aurora. Escolha guardada no aparelho; sem storage, volta ao cristal.
// Puro e testável: quem toca no DOM é aplicarOrbe.
export type ModeloOrbe = "cristal" | "olho" | "sol" | "atomo" | "aurora";
export const MODELOS_ORBE: { valor: ModeloOrbe; rotulo: string; descricao: string }[] = [
  { valor: "cristal", rotulo: "Cristal", descricao: "Esfera de vidro com fitas de luz azuis e magenta" },
  { valor: "olho", rotulo: "Olho", descricao: "Núcleo com pupila e órbita, olho de máquina" },
  { valor: "sol", rotulo: "Sol", descricao: "Corona dourada com raios girando" },
  { valor: "atomo", rotulo: "Átomo", descricao: "Três órbitas com elétrons de luz" },
  { valor: "aurora", rotulo: "Aurora", descricao: "Brilho em cores girando, efeito suave" },
];
const CHAVE = "conecta:orbe";

export function orbeValido(v: unknown): ModeloOrbe {
  return v === "olho" || v === "sol" || v === "atomo" || v === "aurora" ? v : "cristal";
}
export function lerOrbe(armazem: Pick<Storage, "getItem"> | null): ModeloOrbe {
  try { return orbeValido(armazem?.getItem(CHAVE)); } catch { return "cristal"; }
}
export function gravarOrbe(armazem: Pick<Storage, "setItem" | "removeItem"> | null, m: ModeloOrbe): void {
  try { if (m === "cristal") armazem?.removeItem(CHAVE); else armazem?.setItem(CHAVE, m); } catch { /* sem storage: vale só nesta sessão */ }
}
export function aplicarOrbe(m: ModeloOrbe, raiz: HTMLElement = document.documentElement): void {
  raiz.dataset.orbe = m;
}
