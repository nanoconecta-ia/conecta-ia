// Cópia de apresentação 1200×1200: amplia APENAS a área branca, nunca os pixels da peça.
// Nenhum arquivo de origem é escrito, enviado para a API ou modificado.
export const LADO_APRESENTACAO = 1200;
export type QuadroBranco = { lado: number; x: number; y: number; largura: number; altura: number; ampliado: false };

export function enquadrarEmBranco(largura: number, altura: number, lado = LADO_APRESENTACAO, margem = 0.05): QuadroBranco {
  if (![largura, altura, lado, margem].every(Number.isFinite) ||
      largura <= 0 || altura <= 0 || !Number.isInteger(lado) || lado < 100 || lado > 4096 ||
      margem < 0 || margem >= 0.45) throw new Error("Dimensões da imagem inválidas.");
  const disponivel = Math.max(1, Math.floor(lado * (1 - 2 * margem)));
  const escala = Math.min(1, disponivel / largura, disponivel / altura); // sem ampliar origem pequena
  const w = Math.max(1, Math.floor(largura * escala));
  const h = Math.max(1, Math.floor(altura * escala));
  return { lado, x: Math.floor((lado - w) / 2), y: Math.floor((lado - h) / 2),
    largura: w, altura: h, ampliado: false };
}

export type CopiaBranca = { arquivo: Blob; quadro: QuadroBranco; larguraOriginal: number; alturaOriginal: number };

/** Decodifica arquivo local, desenha uma cópia sobre branco, sem remoção artificial de fundo ou upscaling.
 * O JPG é preparado SOMENTE no navegador e baixado por ação explícita do lojista. */
export async function prepararCopiaBranca(origem: File): Promise<CopiaBranca> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(origem.type) ||
      origem.size === 0 || origem.size > 15 * 1024 * 1024) throw new Error("Use JPG, PNG ou WebP com até 15 MB.");
  const bitmap = await createImageBitmap(origem, { imageOrientation: "from-image" });
  try {
    const quadro = enquadrarEmBranco(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = quadro.lado;
    canvas.height = quadro.lado;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("O navegador não oferece edição local de imagens.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, quadro.lado, quadro.lado);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, quadro.x, quadro.y, quadro.largura, quadro.altura);
    const arquivo = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Não foi possível preparar a cópia.")), "image/jpeg", 0.94));
    return { arquivo, quadro, larguraOriginal: bitmap.width, alturaOriginal: bitmap.height };
  } finally {
    bitmap.close();
  }
}

export function nomeDaCopia(nomeOriginal: string): string {
  const base = nomeOriginal.replace(/\.[^.]*$/, "").replace(/[^\w-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70) || "produto";
  return `${base}-fundo-branco-1200x1200.jpg`;
}
