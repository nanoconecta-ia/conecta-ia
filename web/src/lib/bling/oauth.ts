import { BLING_AUTORIZAR, BLING_TOKEN, urlCallback, type ConfigBling } from "./config.ts";

export type TokensBling = { accessToken: string; refreshToken: string; expiraEm: Date };

export function urlAutorizacao(c: ConfigBling, state: string): string {
  const u = new URL(BLING_AUTORIZAR);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("client_id", c.clientId);
  u.searchParams.set("state", state);
  return u.toString();
}

async function pedirToken(c: ConfigBling, corpo: Record<string, string>, f: typeof fetch): Promise<TokensBling> {
  const basic = Buffer.from(`${c.clientId}:${c.clientSecret}`).toString("base64");
  const r = await f(BLING_TOKEN, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "1.0",
      "enable-jwt": "1",
    },
    body: new URLSearchParams(corpo).toString(),
  });
  if (!r.ok) throw new Error(`Bling OAuth falhou (HTTP ${r.status})`); // nunca incluir o corpo: pode ecoar segredos
  const j = (await r.json()) as { access_token?: string; refresh_token?: string; expires_in?: number };
  if (!j.access_token || !j.refresh_token || !j.expires_in) throw new Error("Resposta de token do Bling incompleta");
  return { accessToken: j.access_token, refreshToken: j.refresh_token, expiraEm: new Date(Date.now() + j.expires_in * 1000) };
}

export const trocarCodigo = (c: ConfigBling, code: string, f: typeof fetch = fetch) =>
  pedirToken(c, { grant_type: "authorization_code", code, redirect_uri: urlCallback(c) }, f);

export const renovar = (c: ConfigBling, refreshToken: string, f: typeof fetch = fetch) =>
  pedirToken(c, { grant_type: "refresh_token", refresh_token: refreshToken }, f);
