// Reduz a foto NO NAVEGADOR antes de qualquer envio: o servidor (plano gratuito, 2 s de CPU e 256 MB) não aguenta foto de celular inteira.
// Regras: nunca amplia; foto que já cabe nos limites segue INTACTA (sem recompressão, sem perda); a reduzida é uma cópia nova
// (a original do lojista não é alterada). Reduzir reencoda e, com isso, descarta os metadados (EXIF/GPS) da cópia.
export const LADO_MAX_ENVIO = 1600;
export const PIXELS_MAX_ENVIO = 2_000_000; // ≈1600×1250; mantém o processamento do servidor dentro do limite medido
export const BYTES_MAX_ENTRADA = 15 * 1024 * 1024;
export const PIXELS_MAX_ENTRADA = 100_000_000; // acima disso o próprio celular pode travar ao decodificar
const TIPOS = ["image/jpeg", "image/png", "image/webp"] as const;

export interface PlanoReducao { reduzir: boolean; largura: number; altura: number }

/** Decide se precisa reduzir e para quanto: lado longo ≤ 1600 e ≤ 2 MP, proporção mantida, nunca maior que a origem. */
export function planejarReducao(largura: number, altura: number, ladoMax = LADO_MAX_ENVIO, pixelsMax = PIXELS_MAX_ENVIO): PlanoReducao {
  if (!(Number.isFinite(largura) && Number.isFinite(altura) && largura > 0 && altura > 0)) throw new Error("Dimensões da imagem inválidas.");
  const k = Math.min(1, ladoMax / Math.max(largura, altura), Math.sqrt(pixelsMax / (largura * altura)));
  if (k >= 1) return { reduzir: false, largura, altura };
  return { reduzir: true, largura: Math.max(1, Math.floor(largura * k)), altura: Math.max(1, Math.floor(altura * k)) };
}

export interface FotoPronta { arquivo: Blob; nome: string; tipo: string; larguraOriginal: number; alturaOriginal: number; largura: number; altura: number; reduzida: boolean }

/** Partes do navegador, injetáveis para testar sem DOM. */
export interface Ambiente {
  criarBitmap(arq: Blob): Promise<{ width: number; height: number; close(): void }>;
  reduzir(bmp: { width: number; height: number }, largura: number, altura: number, tipo: "image/jpeg" | "image/png", qualidade: number): Promise<Blob | null>;
}

export const ambienteNavegador: Ambiente = {
  criarBitmap: (arq) => createImageBitmap(arq, { imageOrientation: "from-image" }),
  async reduzir(bmp, largura, altura, tipo, qualidade) {
    const c = document.createElement("canvas"); c.width = largura; c.height = altura;
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    if (tipo === "image/jpeg") { ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, largura, altura); } // JPG não tem transparência
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bmp as ImageBitmap, 0, 0, largura, altura);
    return new Promise<Blob | null>((ok) => c.toBlob(ok, tipo, qualidade));
  },
};

const extensao = (t: string) => (t === "image/png" ? "png" : "jpg");
function nomeReduzido(nome: string, tipo: string): string {
  const base = nome.replace(/\.[^.]*$/, "").replace(/[^\w-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70) || "foto";
  return `${base}-reduzida.${extensao(tipo)}`;
}

/** Prepara a foto para envio. Lança Error com mensagem em português para o lojista quando não dá. */
export async function prepararFotoParaEnvio(origem: File, amb: Ambiente = ambienteNavegador): Promise<FotoPronta> {
  if (!(TIPOS as readonly string[]).includes(origem.type)) throw new Error("Use JPG, PNG ou WebP.");
  if (origem.size === 0) throw new Error("O arquivo está vazio.");
  if (origem.size > BYTES_MAX_ENTRADA) throw new Error("A foto passa de 15 MB. Escolha uma menor.");
  let bmp: Awaited<ReturnType<Ambiente["criarBitmap"]>>;
  try { bmp = await amb.criarBitmap(origem); } catch { throw new Error("Não consegui abrir a foto. Ela pode estar corrompida."); }
  try {
    const lo = bmp.width, ao = bmp.height;
    if (lo * ao > PIXELS_MAX_ENTRADA) throw new Error("A foto tem resolução alta demais para este aparelho.");
    const plano = planejarReducao(lo, ao);
    if (!plano.reduzir) return { arquivo: origem, nome: origem.name, tipo: origem.type, larguraOriginal: lo, alturaOriginal: ao, largura: lo, altura: ao, reduzida: false };
    const tipo = origem.type === "image/png" ? "image/png" : "image/jpeg"; // PNG pode ter transparência: segue PNG
    const blob = await amb.reduzir(bmp, plano.largura, plano.altura, tipo, 0.9);
    if (!blob || blob.size === 0) throw new Error("Não foi possível reduzir a foto neste navegador.");
    if (blob.size >= origem.size && origem.type === tipo) {
      // reduzir não compensou (arquivo já era leve): mantém a original, mas ela precisa caber nos limites de pixels do servidor
      throw new Error("Não foi possível reduzir a foto sem aumentar o arquivo. Tente outra foto.");
    }
    return { arquivo: blob, nome: nomeReduzido(origem.name, tipo), tipo, larguraOriginal: lo, alturaOriginal: ao, largura: plano.largura, altura: plano.altura, reduzida: true };
  } finally { bmp.close(); }
}
