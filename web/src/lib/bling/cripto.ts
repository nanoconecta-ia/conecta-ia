import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const VERSAO = "v1";

function chave(env: NodeJS.ProcessEnv): Buffer {
  const b64 = env.CREDENCIAIS_CHAVE_CIFRA;
  if (!b64) throw new Error("CREDENCIAIS_CHAVE_CIFRA não configurada");
  const k = Buffer.from(b64, "base64");
  if (k.length !== 32) throw new Error("CREDENCIAIS_CHAVE_CIFRA deve ter 32 bytes (base64)");
  return k;
}

/** AES-256-GCM. Formato: v1.<iv>.<tag>.<texto> (base64url). Sem limite de tamanho (JWT longo). */
export function cifrar(texto: string, env: NodeJS.ProcessEnv = process.env): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", chave(env), iv);
  const ct = Buffer.concat([c.update(texto, "utf8"), c.final()]);
  return [VERSAO, iv, c.getAuthTag(), ct].map((p, i) => (i === 0 ? p : (p as Buffer).toString("base64url"))).join(".");
}

export function decifrar(valor: string, env: NodeJS.ProcessEnv = process.env): string {
  const [v, iv, tag, ct] = valor.split(".");
  if (v !== VERSAO || !iv || !tag || ct === undefined) throw new Error("Formato de segredo cifrado inválido");
  const d = createDecipheriv("aes-256-gcm", chave(env), Buffer.from(iv, "base64url"));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([d.update(Buffer.from(ct, "base64url")), d.final()]).toString("utf8");
}
