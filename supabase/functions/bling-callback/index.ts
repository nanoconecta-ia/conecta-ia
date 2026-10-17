// GET ?code&state (redirecionado pelo Bling). Valida o state, troca o código por tokens NO SERVIDOR,
// cifra e grava via RPC (só service_role). Não registra nem devolve token algum.
import { createClient } from "npm:@supabase/supabase-js@2";
import { verificarEstado } from "../_shared/estado.ts";
import { cifrar, decifrar } from "../_shared/cripto.ts";

const texto = (msg: string, status = 200) =>
  new Response(msg, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });

function voltar(q: string): Response {
  const app = Deno.env.get("APP_URL")?.replace(/\/+$/, "");
  if (!app) return texto(q.startsWith("ok") ? "Conexão com o Bling concluída. Pode fechar esta janela." : `Não foi possível conectar (${q}).`, q.startsWith("ok") ? 200 : 400);
  return Response.redirect(`${app}/#/bling?${q}`, 302);
}

Deno.serve(async (req) => {
  if (req.method !== "GET") return texto("Método não permitido.", 405);
  const segredo = Deno.env.get("ESTADO_SEGREDO");
  const chaveCifra = Deno.env.get("CREDENCIAIS_CHAVE_CIFRA");
  if (!segredo || !chaveCifra) return texto("Conexão com o Bling ainda não configurada no servidor.", 503);

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const est = state ? await verificarEstado(state, segredo) : null;
  if (!code || !est) return voltar("erro=estado");

  // App do Bling cadastrado pelo lojista para ESTA loja (a loja vem do state assinado).
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data: appRows } = await admin.rpc("bling_ler_app", { p_loja_id: est.l });
  const app = (appRows as { client_id: string; client_secret_cifrado: string }[] | null)?.[0];
  if (!app) return voltar("erro=app");
  let clientSecret: string;
  try { clientSecret = await decifrar(app.client_secret_cifrado, chaveCifra); } catch { return voltar("erro=app"); }
  const clientId = app.client_id;

  let tokens: { access_token?: string; refresh_token?: string; expires_in?: number };
  try {
    const r = await fetch("https://www.bling.com.br/Api/v3/oauth/token", {
      method: "POST",
      headers: {
        Authorization: "Basic " + btoa(`${clientId}:${clientSecret}`),
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "1.0",
        "enable-jwt": "1",
      },
      body: new URLSearchParams({ grant_type: "authorization_code", code }).toString(),
    });
    if (!r.ok) return voltar("erro=troca"); // nunca ecoar o corpo da resposta
    tokens = await r.json();
  } catch {
    return voltar("erro=troca");
  }
  if (!tokens.access_token || !tokens.refresh_token || !tokens.expires_in) return voltar("erro=troca");

  try {
    const { error } = await admin.rpc("bling_salvar_credenciais", {
      p_loja_id: est.l,
      p_access: await cifrar(tokens.access_token, chaveCifra),
      p_refresh: await cifrar(tokens.refresh_token, chaveCifra),
      p_expira_em: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    });
    if (error) return voltar("erro=gravar");
  } catch {
    return voltar("erro=gravar");
  }
  return voltar("ok=1");
});
