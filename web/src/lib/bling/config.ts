export const BLING_AUTORIZAR = "https://www.bling.com.br/Api/v3/oauth/authorize";
export const BLING_TOKEN = "https://www.bling.com.br/Api/v3/oauth/token";
export const BLING_API = "https://api.bling.com.br/Api/v3";

export type ConfigBling = { clientId: string; clientSecret: string; appUrl: string };

/** Lê a configuração do ambiente (nunca do repositório). Lança se faltar algo. */
export function configBling(env: NodeJS.ProcessEnv = process.env): ConfigBling {
  const clientId = env.BLING_CLIENT_ID;
  const clientSecret = env.BLING_CLIENT_SECRET;
  const appUrl = env.APP_URL?.replace(/\/+$/, "");
  if (!clientId || !clientSecret || !appUrl) {
    throw new Error("BLING_CLIENT_ID, BLING_CLIENT_SECRET e APP_URL não configurados");
  }
  return { clientId, clientSecret, appUrl };
}

export const urlCallback = (c: ConfigBling) => `${c.appUrl}/api/bling/callback`;
