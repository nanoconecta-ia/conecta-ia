// OAuth do Google (Drive) por loja. Só Web Crypto/fetch: roda no Deno das Edge Functions e no Node dos testes.
// Escopo mínimo: drive.file (arquivos criados pelo app ou escolhidos pelo usuário). Sem Gmail, sem Drive inteiro.
// Nunca registra nem devolve token. O corpo de resposta do Google não é repassado ao navegador.
import { unb64u } from "./estado.ts";

export const ESCOPO_DRIVE_ARQUIVO = "https://www.googleapis.com/auth/drive.file";
export const ESCOPOS_PADRAO = ["openid", "email", ESCOPO_DRIVE_ARQUIVO] as const;

const AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN = "https://oauth2.googleapis.com/token";
const REVOGAR = "https://oauth2.googleapis.com/revoke";

type Fetch = typeof fetch;
export type Cliente = { clientId: string; clientSecret: string; redirectUri: string };

const emailValido = (e: unknown): e is string => typeof e === "string" && e.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

/** URL de autorização. login_hint só pré-seleciona a conta; o Google sempre pede o consentimento na 1ª vez. */
export function urlAutorizacao(c: { clientId: string; redirectUri: string; state: string; loginHint?: string }): string {
  const u = new URL(AUTH);
  u.searchParams.set("client_id", c.clientId);
  u.searchParams.set("redirect_uri", c.redirectUri);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", ESCOPOS_PADRAO.join(" "));
  u.searchParams.set("access_type", "offline"); // precisa do refresh token
  u.searchParams.set("prompt", "consent"); // sem isso o Google pode não devolver refresh token em reconexão
  u.searchParams.set("include_granted_scopes", "false"); // não herda escopos de outros apps/consentimentos
  u.searchParams.set("state", c.state);
  if (emailValido(c.loginHint)) u.searchParams.set("login_hint", c.loginHint);
  return u.toString();
}

export type Tokens = { access: string; refresh: string; expiraEm: Date; escopos: string[]; sub: string; email: string };

/** O id_token vem direto do endpoint de token do Google por TLS: ler o corpo basta (sem verificar assinatura). */
export function lerIdToken(idToken: unknown): { sub: string; email: string; emailVerificado: boolean } | null {
  if (typeof idToken !== "string") return null;
  const p = idToken.split(".");
  if (p.length !== 3) return null;
  try {
    const j = JSON.parse(new TextDecoder().decode(unb64u(p[1])));
    if (typeof j.sub !== "string" || !j.sub || !emailValido(j.email)) return null;
    return { sub: j.sub, email: j.email.toLowerCase(), emailVerificado: j.email_verified === true };
  } catch {
    return null;
  }
}

/** Troca o código por tokens. Devolve null em qualquer falha ou resposta incompleta (sem eco do corpo). */
export async function trocarCodigo(c: Cliente, code: string, f: Fetch = fetch, agora = Date.now()): Promise<Tokens | null> {
  let j: Record<string, unknown>;
  try {
    const r = await f(TOKEN, {
      method: "POST", redirect: "manual", signal: AbortSignal.timeout(15_000),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code, client_id: c.clientId, client_secret: c.clientSecret, redirect_uri: c.redirectUri, grant_type: "authorization_code",
      }).toString(),
    });
    if (!r.ok) return null;
    j = await r.json();
  } catch {
    return null;
  }
  const id = lerIdToken(j.id_token);
  const escopos = typeof j.scope === "string" ? j.scope.split(" ").filter(Boolean) : [];
  const exp = j.expires_in;
  if (
    typeof j.access_token !== "string" || !j.access_token || typeof j.refresh_token !== "string" || !j.refresh_token ||
    typeof exp !== "number" || !Number.isFinite(exp) || exp <= 0 || exp > 86_400 || !id || !id.emailVerificado
  ) return null;
  // O usuário pode desmarcar a permissão na tela do Google: sem drive.file a conexão não serve.
  if (!escopos.includes(ESCOPO_DRIVE_ARQUIVO)) return null;
  return { access: j.access_token, refresh: j.refresh_token, expiraEm: new Date(agora + exp * 1000), escopos, sub: id.sub, email: id.email };
}

/** Renova o access token. null se o Google recusar (token revogado ou expirado). */
export async function renovarAccess(c: Cliente, refresh: string, f: Fetch = fetch, agora = Date.now()): Promise<{ access: string; expiraEm: Date } | null> {
  try {
    const r = await f(TOKEN, {
      method: "POST", redirect: "manual", signal: AbortSignal.timeout(15_000),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: c.clientId, client_secret: c.clientSecret, refresh_token: refresh, grant_type: "refresh_token" }).toString(),
    });
    if (!r.ok) return null;
    const j = await r.json();
    if (typeof j.access_token !== "string" || !j.access_token || typeof j.expires_in !== "number" || !(j.expires_in > 0) || j.expires_in > 86_400) return null;
    return { access: j.access_token, expiraEm: new Date(agora + j.expires_in * 1000) };
  } catch {
    return null;
  }
}

/** Revoga o token no Google. true se o Google confirmou (ou o token já era inválido). */
export async function revogar(token: string, f: Fetch = fetch): Promise<boolean> {
  try {
    const r = await f(REVOGAR, {
      method: "POST", redirect: "manual", signal: AbortSignal.timeout(15_000),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }).toString(),
    });
    return r.ok || r.status === 400; // 400 = token já inválido: o objetivo (sem acesso) está cumprido
  } catch {
    return false;
  }
}

export function clienteDoAmbiente(get: (n: string) => string | undefined): Cliente | undefined {
  const clientId = get("GOOGLE_CLIENT_ID"), clientSecret = get("GOOGLE_CLIENT_SECRET"), redirectUri = get("GOOGLE_REDIRECT_URI");
  return clientId && clientSecret && redirectUri ? { clientId, clientSecret, redirectUri } : undefined;
}
