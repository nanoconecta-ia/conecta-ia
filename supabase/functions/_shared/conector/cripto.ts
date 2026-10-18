// Hash e tokens do gateway. O token da chave MCP aparece uma única vez; só o hash (sha256) fica no banco.
const enc = new TextEncoder();
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");

export async function sha256Hex(texto: string): Promise<string> {
  return hex(await crypto.subtle.digest("SHA-256", enc.encode(texto)));
}

export const PREFIXO_TOKEN = "cia_mcp_";

/** 256 bits de entropia: sha256 simples basta (não é senha escolhida por pessoa). */
export function gerarToken(): { token: string; prefixo: string } {
  const b = crypto.getRandomValues(new Uint8Array(32));
  const corpo = btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const token = PREFIXO_TOKEN + corpo;
  return { token, prefixo: token.slice(0, PREFIXO_TOKEN.length + 6) };
}

export const pareceTokenMcp = (t: string) => /^cia_mcp_[A-Za-z0-9_-]{43}$/.test(t);

export function igualConstante(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
