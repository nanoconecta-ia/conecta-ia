// GET ?code&state (redirecionado pelo Bling). Valida o state, troca o código por tokens NO SERVIDOR,
// cifra e grava via RPC (só service_role). Não registra nem devolve token algum.
import { createClient } from "npm:@supabase/supabase-js@2";
import { verificarEstado } from "../_shared/estado.ts";
import { chaveiroDoAmbiente, cifrar, decifrar } from "../_shared/cripto.ts";
import { cnpjConfere } from "../_shared/bling_conta.ts";

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
  const chaveCifra = chaveiroDoAmbiente((n) => Deno.env.get(n));
  if (!segredo || !chaveCifra) return texto("Conexão com o Bling ainda não configurada no servidor.", 503);

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const est = state ? await verificarEstado(state, segredo) : null;
  if (!code || !est || !est.n) return voltar("erro=estado");

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  // Uso único e atômico: o mesmo state nunca vale duas vezes; deve pertencer à loja e ao usuário assinados.
  const { data: usado } = await admin.rpc("bling_estado_consumir", { p_nonce: est.n });
  const u0 = (usado as { loja_id: string; user_id: string }[] | null)?.[0];
  if (!u0 || u0.loja_id !== est.l || u0.user_id !== est.u) return voltar("erro=estado");
  // Reconfere que a pessoa AINDA administra a loja (o papel pode ter mudado nos 10 minutos).
  const { data: ainda } = await admin.rpc("bling_usuario_administra", { p_loja_id: est.l, p_user_id: est.u });
  if (ainda !== true) return voltar("erro=permissao");

  // App do Bling cadastrado pelo lojista para ESTA loja (a loja vem do state assinado).
  const { data: appRows } = await admin.rpc("bling_ler_app", { p_loja_id: est.l });
  const app = (appRows as { client_id: string; client_secret_cifrado: string; cnpj: string }[] | null)?.[0];
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

  // Identidade da conta: o CNPJ da conta Bling que autorizou precisa ser o cadastrado para a loja. Divergiu => nada é salvo.
  try {
    const r = await fetch("https://api.bling.com.br/Api/v3/empresas/me/dados-basicos", {
      headers: { Authorization: `Bearer ${tokens.access_token}`, Accept: "application/json", "enable-jwt": "1" },
      signal: AbortSignal.timeout(15_000),
    });
    const j = r.ok ? await r.json().catch(() => null) : null;
    const cnpjConta = typeof j?.data?.cnpj === "string" ? j.data.cnpj : "";
    if (!cnpjConta) return voltar("erro=conta_verificacao");
    if (!cnpjConfere(cnpjConta, app.cnpj)) return voltar("erro=conta");
  } catch {
    return voltar("erro=conta_verificacao");
  }

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
