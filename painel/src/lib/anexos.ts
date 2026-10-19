// Regras dos anexos do chat (o banco impõe o mesmo limite: 20 MB, tipo imagem/documento/audio, sha256 em hex).
export const LIMITE_BYTES = 20 * 1024 * 1024;
export const MAX_ANEXOS = 5;
const IMAGENS = ["image/png", "image/jpeg", "image/webp"];
const DOCUMENTOS = ["application/pdf", "text/plain", "text/csv"];
export const ACEITA = [...IMAGENS, ...DOCUMENTOS].join(",");

export type TipoAnexo = "imagem" | "documento";
export function classificar(f: { name: string; type: string; size: number }): { ok: true; tipo: TipoAnexo } | { ok: false; erro: string } {
  if (f.size <= 0) return { ok: false, erro: `"${f.name}" está vazio.` };
  if (f.size > LIMITE_BYTES) return { ok: false, erro: `"${f.name}" passa de 20 MB.` };
  if (IMAGENS.includes(f.type)) return { ok: true, tipo: "imagem" };
  if (DOCUMENTOS.includes(f.type)) return { ok: true, tipo: "documento" };
  return { ok: false, erro: `"${f.name}": tipo não aceito (use imagem PNG/JPEG/WebP, PDF, TXT ou CSV).` };
}

export function nomeSeguro(nome: string): string {
  const limpo = nome.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^[-.]+/, "").slice(-120);
  return limpo || "arquivo";
}
export async function sha256Hex(dados: ArrayBuffer): Promise<string> {
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", dados));
  return [...h].map((b) => b.toString(16).padStart(2, "0")).join("");
}
