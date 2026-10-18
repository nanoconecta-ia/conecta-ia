// AES-256-GCM autenticado (a etiqueta GCM de 16 bytes autentica o texto), com chave identificada para ROTAÇÃO.
// Formato novo:   v2.<kid>.<iv>.<tag>.<texto>   (base64url).   Formato antigo (sem kid): v1.<iv>.<tag>.<texto>.
// Chaveiro: string (uma chave, kid "k1") ou { atual, chaves: { kid: base64(32 bytes) } }. Rotação: acrescentar a
// chave nova ao chaveiro, mudar `atual`, recifrar os valores (recifrar) e só então retirar a chave antiga.
import { b64u, unb64u } from "./estado.ts";

const enc = new TextEncoder();
const dec = new TextDecoder();

export type Chaveiro = string | { atual: string; chaves: Record<string, string> };

function anel(c: Chaveiro | undefined): { atual: string; chaves: Record<string, string> } {
  if (!c) throw new Error("chave de cifra não configurada");
  return typeof c === "string" ? { atual: "k1", chaves: { k1: c } } : c;
}

/** Lê o chaveiro do ambiente: CREDENCIAIS_CHAVES (JSON {kid: base64}) + CREDENCIAIS_CHAVE_ATUAL; senão CREDENCIAIS_CHAVE_CIFRA (k1). */
export function chaveiroDoAmbiente(get: (n: string) => string | undefined): Chaveiro | undefined {
  const json = get("CREDENCIAIS_CHAVES");
  if (json) {
    try {
      const chaves = JSON.parse(json) as Record<string, string>;
      const atual = get("CREDENCIAIS_CHAVE_ATUAL") ?? Object.keys(chaves).sort().at(-1)!;
      if (chaves[atual]) return { atual, chaves };
    } catch { /* cai no formato simples */ }
  }
  return get("CREDENCIAIS_CHAVE_CIFRA");
}

async function importar(b64: string): Promise<CryptoKey> {
  const raw = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  if (raw.length !== 32) throw new Error("a chave de cifra deve ter 32 bytes (base64)");
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function cifrar(texto: string, chaveiro: Chaveiro | undefined): Promise<string> {
  const a = anel(chaveiro);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const tudo = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await importar(a.chaves[a.atual]), enc.encode(texto)));
  const tag = tudo.slice(tudo.length - 16);
  const corpo = tudo.slice(0, tudo.length - 16);
  return `v2.${a.atual}.${b64u(iv)}.${b64u(tag)}.${b64u(corpo)}`;
}

async function abrir(chaveB64: string, iv: string, tag: string, ct: string): Promise<string> {
  const corpo = unb64u(ct), t = unb64u(tag);
  const junto = new Uint8Array(corpo.length + t.length);
  junto.set(corpo); junto.set(t, corpo.length);
  return dec.decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64u(iv) }, await importar(chaveB64), junto));
}

export async function decifrar(valor: string, chaveiro: Chaveiro | undefined): Promise<string> {
  const a = anel(chaveiro);
  const p = valor.split(".");
  if (p[0] === "v2" && p.length === 5) {
    const chave = a.chaves[p[1]];
    if (!chave) throw new Error("chave de cifra desconhecida (kid)");
    return abrir(chave, p[2], p[3], p[4]);
  }
  if (p[0] === "v1" && p.length === 4) { // legado: tenta cada chave do chaveiro
    for (const k of [a.atual, ...Object.keys(a.chaves).filter((x) => x !== a.atual)]) {
      try { return await abrir(a.chaves[k], p[1], p[2], p[3]); } catch { /* tenta a próxima */ }
    }
    throw new Error("não foi possível decifrar (formato v1)");
  }
  throw new Error("Formato de segredo cifrado inválido");
}

/** Recifra com a chave atual (usar na rotação). Idempotente. */
export async function recifrar(valor: string, chaveiro: Chaveiro): Promise<string> {
  const a = anel(chaveiro);
  if (valor.startsWith(`v2.${a.atual}.`)) return valor;
  return cifrar(await decifrar(valor, chaveiro), chaveiro);
}
