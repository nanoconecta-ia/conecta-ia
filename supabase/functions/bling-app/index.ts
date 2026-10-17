// POST { loja_id, client_id, client_secret, cnpj } com o login do lojista. Guarda o app do Bling DA LOJA: o secret é cifrado
// no servidor (AES-256-GCM, chave identificada) e nunca volta ao navegador, nem em erro. Só quem ADMINISTRA a loja
// (papel lojista, ou super_admin com MFA) pode cadastrar/trocar; limite de tentativas por loja e usuário.
import { createClient } from "npm:@supabase/supabase-js@2";
import { chaveiroDoAmbiente, cifrar } from "../_shared/cripto.ts";
import { cnpjValido, somenteDigitos } from "../_shared/bling_conta.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ erro: "Método não permitido." }, 405);
  const chaveiro = chaveiroDoAmbiente((n) => Deno.env.get(n));
  if (!chaveiro) return json({ erro: "O servidor ainda não está pronto para guardar credenciais." }, 503);

  const url = Deno.env.get("SUPABASE_URL")!;
  const usuario = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } }, auth: { persistSession: false },
  });
  const { data: u } = await usuario.auth.getUser();
  if (!u.user) return json({ erro: "Não autenticado." }, 401);

  const c = await req.json().catch(() => ({}));
  const lojaId = typeof c?.loja_id === "string" ? c.loja_id : "";
  const clientId = typeof c?.client_id === "string" ? c.client_id.trim() : "";
  const secret = typeof c?.client_secret === "string" ? c.client_secret.trim() : "";
  const cnpj = typeof c?.cnpj === "string" ? somenteDigitos(c.cnpj) : "";

  // Permissão administrativa (o RLS sozinho não basta: esta função usa privilégio elevado para gravar).
  const { data: admin } = await usuario.rpc("pode_administrar_loja", { p_loja_id: lojaId });
  if (admin !== true) return json({ erro: "Só o responsável da loja pode alterar a integração com o Bling." }, 403);

  const sb = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data: dentro } = await sb.rpc("limite_chamada", { p_chave: `bling-app:${lojaId}:${u.user.id}`, p_max: 5, p_janela_s: 3600 });
  if (dentro !== true) return json({ erro: "Muitas tentativas. Aguarde um pouco e tente de novo." }, 429);

  if (clientId.length < 8 || clientId.length > 200 || secret.length < 8 || secret.length > 400) {
    return json({ erro: "Confira o Client ID e o Client Secret copiados do Bling." }, 400);
  }
  if (!cnpjValido(cnpj)) return json({ erro: "Informe o CNPJ da empresa no Bling (14 dígitos válidos)." }, 400);

  const { error } = await sb.rpc("bling_salvar_app", { p_loja_id: lojaId, p_client_id: clientId, p_secret_cifrado: await cifrar(secret, chaveiro), p_cnpj: cnpj });
  if (error) return json({ erro: "Não foi possível salvar. Tente de novo." }, 500);
  await sb.from("auditoria").insert({ loja_id: lojaId, user_id: u.user.id, acao: "bling.app_cadastrado", tabela: "private.bling_apps", depois: { client_id_final: clientId.slice(-4), cnpj_final: cnpj.slice(-4) } });
  return json({ ok: true });
});
