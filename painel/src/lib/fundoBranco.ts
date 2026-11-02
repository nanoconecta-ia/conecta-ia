/** Emolduramento não destrutivo: acrescenta pixels brancos ao redor, sem tentar remover o fundo existente. */
export const LADO_CATALOGO = 1200;
export type Posicao = { x: number; y: number; largura: number; altura: number };
export function enquadrarNoQuadrado(largura: number, altura: number, lado = LADO_CATALOGO, ocupacao = 0.86): Posicao {
  if (![largura, altura, lado, ocupacao].every(Number.isFinite) || largura <= 0 || altura <= 0 || lado <= 0 || ocupacao <= 0 || ocupacao > 1) throw new Error("Dimensões inválidas");
  const fator = Math.min((lado * ocupacao) / largura, (lado * ocupacao) / altura);
  const w = Math.max(1, Math.round(largura * fator));
  const h = Math.max(1, Math.round(altura * fator));
  return { x: Math.floor((lado - w) / 2), y: Math.floor((lado - h) / 2), largura: w, altura: h };
}
/** Exporta uma NOVA cópia, somente no navegador; original permanece byte a byte intocado. */
export async function criarCopiaFundoBranco(arquivo: File, lado = LADO_CATALOGO): Promise<Blob> {
  const bitmap = await createImageBitmap(arquivo, { imageOrientation: "from-image" });
  try {
    const tela = document.createElement("canvas");
    tela.width = tela.height = lado;
    const c = tela.getContext("2d", { alpha: false });
    if (!c) throw new Error("Canvas não disponível.");
    c.fillStyle = "#ffffff";
    c.fillRect(0, 0, lado, lado);
    c.imageSmoothingEnabled = true;
    c.imageSmoothingQuality = "high";
    const area = enquadrarNoQuadrado(bitmap.width, bitmap.height, lado);
    c.drawImage(bitmap, area.x, area.y, area.largura, area.altura);
    return await new Promise<Blob>((resolve, reject) => tela.toBlob(b => b ? resolve(b) : reject(new Error("Não foi possível exportar a cópia.")), "image/png"));
  } finally { bitmap.close(); }
}
