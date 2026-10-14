// State assinado (HMAC-SHA256) do fluxo OAuth: liga o retorno do Bling à loja e ao usuário, expira em minutos.
// Só Web Crypto (roda no Deno das Edge Functions e no Node dos testes).
const enc = new TextEncoder();
const dec = new TextDecoder();

export function b64u(b: Uint8Array): string {
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export function unb64u(s: string): Uint8Array {
  const p = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4);
  return Uint8Array.from(atob(p), (c) => c.charCodeAt(0));
}

export type Estado = { l: string; u: string; e: number }; // loja, usuário, expira (ms)

const chaveHmac = (segredo: string) =>
  crypto.subtle.importKey("raw", enc.encode(segredo), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);

export async function assinarEstado(est: Estado, segredo: string): Promise<string> {
  const corpo = b64u(enc.encode(JSON.stringify(est)));
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await chaveHmac(segredo), enc.encode(corpo)));
  return `${corpo}.${b64u(sig)}`;
}

export async function verificarEstado(token: string, segredo: string, agora = Date.now()): Promise<Estado | null> {
  const [corpo, sig, resto] = token.split(".");
  if (!corpo || !sig || resto !== undefined) return null;
  try {
    const ok = await crypto.subtle.verify("HMAC", await chaveHmac(segredo), unb64u(sig), enc.encode(corpo));
    if (!ok) return null;
    const est = JSON.parse(dec.decode(unb64u(corpo)));
    if (typeof est.l !== "string" || typeof est.u !== "string" || typeof est.e !== "number" || est.e < agora) return null;
    return est as Estado;
  } catch {
    return null;
  }
}
