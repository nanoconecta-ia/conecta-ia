// Processador REAL de pixels das variantes (400/1200/800/og). Lógica pura sobre uma porta de codecs: testável sem rede nem WASM.
// Regras: nunca amplia (sem upscaling); a proporção é preservada (contain); JPG e fundo branco achatam transparência sobre branco.
// Não decide direitos nem aprovação: quem chama deve passar só imagem publicável (veja `gerarVariantes`, que já filtra).
import type { EspecVariante } from "./variantes.ts";

export interface Bitmap { width: number; height: number; data: Uint8ClampedArray } // RGBA 8 bits, linha a linha
export interface Codecs {
  decodificar(bytes: Uint8Array, tipo: TipoImagem): Promise<Bitmap>;
  redimensionar(b: Bitmap, largura: number, altura: number): Promise<Bitmap>;
  codificar(b: Bitmap, formato: "webp" | "jpg"): Promise<Uint8Array>;
}
export type TipoImagem = "jpeg" | "png" | "webp";

export const MAX_BYTES_ORIGEM = 15 * 1024 * 1024;
export const MAX_PIXELS_ORIGEM = 40_000_000; // protege memória da função; foto de celular 12 MP passa folgada

/** Tipo pelo conteúdo (assinatura), nunca pela extensão ou cabeçalho enviado por terceiros. */
export function detectarTipo(b: Uint8Array): TipoImagem | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return "png";
  if (b.length >= 12 && String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP") return "webp";
  return null;
}

/** Tamanho final: cabe na caixa da variante, mantém a proporção, NUNCA maior que a origem. */
export function tamanhoFinal(lo: number, ao: number, spec: Pick<EspecVariante, "largura" | "altura">): { largura: number; altura: number } {
  if (!(lo > 0 && ao > 0)) throw new Error("dimensões da origem inválidas");
  const escala = Math.min(spec.largura / lo, spec.altura / ao, 1);
  return { largura: Math.max(1, Math.round(lo * escala)), altura: Math.max(1, Math.round(ao * escala)) };
}

/** Achata a transparência sobre branco (JPG não tem alfa). Devolve cópia; não altera a entrada. */
export function achatarSobreBranco(b: Bitmap): Bitmap {
  const out = new Uint8ClampedArray(b.data.length);
  for (let i = 0; i < b.data.length; i += 4) {
    const a = b.data[i + 3] / 255;
    out[i] = Math.round(b.data[i] * a + 255 * (1 - a));
    out[i + 1] = Math.round(b.data[i + 1] * a + 255 * (1 - a));
    out[i + 2] = Math.round(b.data[i + 2] * a + 255 * (1 - a));
    out[i + 3] = 255;
  }
  return { width: b.width, height: b.height, data: out };
}

export interface VarianteBytes { spec: EspecVariante["id"]; formato: "webp" | "jpg"; largura: number; altura: number; bytes: Uint8Array; fundoBrancoAplicado: boolean }
export type ResultadoPixels = { ok: true; origem: { largura: number; altura: number; tipo: TipoImagem }; variantes: VarianteBytes[] } | { ok: false; motivo: string };

/** Decodifica UMA vez e gera todas as variantes. Recusa (sem lançar) arquivo vazio, grande demais, tipo desconhecido ou corrompido. */
export async function processarVariantes(origem: Uint8Array, specs: readonly EspecVariante[], c: Codecs): Promise<ResultadoPixels> {
  if (!origem.length) return { ok: false, motivo: "arquivo vazio" };
  if (origem.length > MAX_BYTES_ORIGEM) return { ok: false, motivo: "arquivo maior que o limite de 15 MB" };
  const tipo = detectarTipo(origem);
  if (!tipo) return { ok: false, motivo: "formato não suportado (use JPG, PNG ou WebP)" };
  let src: Bitmap;
  try { src = await c.decodificar(origem, tipo); } catch { return { ok: false, motivo: "imagem corrompida ou ilegível" }; }
  if (!(src.width > 0 && src.height > 0) || src.data.length !== src.width * src.height * 4) return { ok: false, motivo: "imagem decodificada inconsistente" };
  if (src.width * src.height > MAX_PIXELS_ORIGEM) return { ok: false, motivo: "resolução acima do limite de processamento" };
  const variantes: VarianteBytes[] = [];
  for (const spec of specs) {
    const { largura, altura } = tamanhoFinal(src.width, src.height, spec);
    let bmp = largura === src.width && altura === src.height ? src : await c.redimensionar(src, largura, altura);
    if (bmp.width > src.width || bmp.height > src.height) throw new Error("o redimensionador ampliou a imagem (upscaling proibido)");
    const achatar = spec.fundoBranco || spec.formato === "jpg";
    if (achatar) bmp = achatarSobreBranco(bmp);
    variantes.push({ spec: spec.id, formato: spec.formato, largura: bmp.width, altura: bmp.height, bytes: await c.codificar(bmp, spec.formato), fundoBrancoAplicado: achatar });
  }
  return { ok: true, origem: { largura: src.width, altura: src.height, tipo }, variantes };
}
