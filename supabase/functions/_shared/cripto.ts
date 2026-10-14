// AES-256-GCM no formato v1.<iv>.<tag>.<texto> (base64url), compatível com web/src/lib/bling/cripto.ts.
import { b64u, unb64u } from "./estado.ts";

const enc = new TextEncoder();
const dec = new TextDecoder();

async function chave(b64: string | undefined): Promise<CryptoKey> {
  if (!b64) throw new Error("CREDENCIAIS_CHAVE_CIFRA não configurada");
  const raw = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  if (raw.length !== 32) throw new Error("CREDENCIAIS_CHAVE_CIFRA deve ter 32 bytes (base64)");
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function cifrar(texto: string, chaveB64: string | undefined): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const tudo = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await chave(chaveB64), enc.encode(texto)));
  const tag = tudo.slice(tudo.length - 16);
  const corpo = tudo.slice(0, tudo.length - 16);
  return `v1.${b64u(iv)}.${b64u(tag)}.${b64u(corpo)}`;
}

export async function decifrar(valor: string, chaveB64: string | undefined): Promise<string> {
  const [v, iv, tag, ct] = valor.split(".");
  if (v !== "v1" || !iv || !tag || ct === undefined) throw new Error("Formato de segredo cifrado inválido");
  const corpo = unb64u(ct);
  const t = unb64u(tag);
  const junto = new Uint8Array(corpo.length + t.length);
  junto.set(corpo);
  junto.set(t, corpo.length);
  return dec.decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64u(iv) }, await chave(chaveB64), junto));
}
