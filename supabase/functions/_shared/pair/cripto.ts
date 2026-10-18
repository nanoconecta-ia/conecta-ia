// Primitivas do Conecta Pair. Só Web Crypto (roda no Deno das Edge Functions e no Node dos testes).
// Nada aqui guarda segredo: o servidor só persiste HASHES (SHA-256) do que o solicitante recebe/gera.
import { b64u } from "../estado.ts";

const enc = new TextEncoder();

/** Valor aleatório criptográfico em base64url (32 bytes = 256 bits => 43 caracteres). */
export function aleatorioB64u(bytes = 32): string {
  const b = new Uint8Array(bytes);
  crypto.getRandomValues(b);
  return b64u(b);
}

export async function sha256Hex(texto: string): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(texto)));
  return Array.from(d, (x) => x.toString(16).padStart(2, "0")).join("");
}

/** Código de 6 dígitos mostrado NA TELA do solicitante e digitado pelo aprovador. Uniforme (sem viés de módulo). */
export function codigoVerificacao(): string {
  const limite = Math.floor(0x1_0000_0000 / 1_000_000) * 1_000_000;
  const buf = new Uint32Array(1);
  do crypto.getRandomValues(buf); while (buf[0] >= limite);
  return String(buf[0] % 1_000_000).padStart(6, "0");
}

/** Comparação em tempo constante (strings de mesmo comprimento; comprimento diferente falha cedo, sem segredo envolvido). */
export function iguais(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

/** Formato de segredo/token/código aceito (base64url de 32 a 96 bytes). Barra lixo antes de gastar hash/banco. */
export const SEGREDO_RE = /^[A-Za-z0-9_-]{43,128}$/;
export const HASH_RE = /^[0-9a-f]{64}$/;

/**
 * Token completo = `<token>.<sal>`: a 1ª metade nasce no dispositivo, a 2ª (o "sal", 256 bits) é gerada pelo SERVIDOR e entregue
 * só a quem iniciou o pareamento. Mesmo que o dispositivo escolha uma 1ª metade fraca, o token tem a entropia da 2ª.
 */
export function separarToken(completo: string | null | undefined): { token: string; sal: string } | null {
  const partes = (completo ?? "").split(".");
  if (partes.length !== 2 || !SEGREDO_RE.test(partes[0]) || !SEGREDO_RE.test(partes[1])) return null;
  return { token: partes[0], sal: partes[1] };
}

/**
 * Conteúdo do QR Code: SOMENTE uma URL de navegação com o código de uso único (expira em 2 min).
 * Não leva senha, token de sessão, segredo de consulta, credencial de ERP nem dado da loja.
 */
export function montarUrlPareamento(appUrl: string, codigo: string): string {
  if (!SEGREDO_RE.test(codigo)) throw new Error("código de pareamento inválido");
  const u = new URL(appUrl);
  const local = u.hostname === "localhost" || u.hostname === "127.0.0.1";
  if (u.protocol !== "https:" && !local) throw new Error("APP_URL deve ser https");
  if (u.username || u.password || u.search || u.hash) throw new Error("APP_URL não pode ter credenciais, query nem fragmento");
  return `${u.origin}${u.pathname.replace(/\/+$/, "")}/#/parear?c=${codigo}`;
}

/** Extrai o código de uma URL de pareamento (lado do aprovador que cola o link). Só aceita o formato que montarUrlPareamento gera. */
export function codigoDaUrl(url: string): string | null {
  const m = /#\/parear\?c=([A-Za-z0-9_-]{43,128})$/.exec(url.trim());
  return m ? m[1] : null;
}
