// Anexos do chat do Nano.ia: limites iguais aos do servidor (que revalida tudo; aqui é só conforto e economia de banda).
export const CHAT_MAX_ANEXOS = 3;
export const CHAT_MAX_BYTES_ARQUIVO = 3_000_000;
export const CHAT_MAX_BYTES_TOTAL = 4_500_000;
const IMAGENS = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const TEXTOS = ["text/plain", "text/csv"];
export const CHAT_ACEITA = [...IMAGENS, "application/pdf", ...TEXTOS].join(",");
export const LADO_MAX_IMAGEM = 1600;

export type AnexoChat = { nome: string; tipo: string; dados: string; bytes: number };

/** Provedor compatível com OpenAI não lê PDF. */
export function validarSelecao(f: { name: string; type: string; size: number }, ja: { bytes: number }[], pdfOk: boolean): string | null {
  if (ja.length >= CHAT_MAX_ANEXOS) return `Máximo de ${CHAT_MAX_ANEXOS} anexos por pergunta.`;
  if (f.size <= 0) return `"${f.name}" está vazio.`;
  if (![...IMAGENS, "application/pdf", ...TEXTOS].includes(f.type)) return `"${f.name}": use imagem (PNG, JPEG, WebP, GIF), PDF, TXT ou CSV.`;
  if (f.type === "application/pdf" && !pdfOk) return `"${f.name}": este modelo lê imagem e texto, não PDF. Escolha outro modelo ou envie a página como imagem.`;
  if (f.size > CHAT_MAX_BYTES_ARQUIVO) return `"${f.name}" passa de ${CHAT_MAX_BYTES_ARQUIVO / 1_000_000} MB.`;
  if (ja.reduce((s, a) => s + a.bytes, 0) + f.size > CHAT_MAX_BYTES_TOTAL) return "O total dos anexos passa do limite desta pergunta.";
  return null;
}

export function paraBase64(b: Uint8Array): string {
  let s = ""; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
}

export const rotuloBytes = (n: number) => (n < 1024 ? `${n} B` : n < 1_048_576 ? `${Math.round(n / 1024)} KB` : `${(n / 1_048_576).toFixed(1)} MB`);

/** Lê o arquivo; foto grande é reduzida no navegador (lado ≤ 1600 px, JPEG) para caber no limite e poupar dados do celular. */
export async function prepararArquivo(f: File): Promise<AnexoChat> {
  let blob: Blob = f; let tipo = f.type;
  if ((f.type === "image/jpeg" || f.type === "image/png" || f.type === "image/webp") && f.size > 400_000 && typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(f); const k = Math.min(1, LADO_MAX_IMAGEM / Math.max(bmp.width, bmp.height));
      const c = document.createElement("canvas"); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
      c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
      const r = await new Promise<Blob | null>((ok) => c.toBlob(ok, "image/jpeg", 0.85));
      if (r && r.size < f.size) { blob = r; tipo = "image/jpeg"; }
    } catch { /* usa o original */ }
  }
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return { nome: f.name, tipo, dados: paraBase64(bytes), bytes: bytes.length };
}
