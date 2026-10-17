// POST { loja_id, client_id, client_secret } com o login do lojista. Guarda o app do Bling DA LOJA: o secret é cifrado
// no servidor (AES-256-GCM) e nunca volta ao navegador, nem em erro. Trocar o app apaga os tokens do app anterior.
import { createClient } from "npm:@supabase/supabase-js@2";
import { cifrar } from "../_shared/cripto.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ erro: "Método não permitido." }, 405);
  const chaveCifra = Deno.env.get("CREDENCIAIS_CHAVE_CIFRA");
  if (!chaveCifra) return json({ erro: "O servidor ainda não está pronto para guardar credenciais." }, 503);

  const url = Deno.env.get("SUPABASE_URL")!;
  const usuario = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } }, auth: { persistSession: false },
  });
  const { data: u } = await usuario.auth.getUser();
  if (!u.user) return json({ erro: "Não autenticado." }, 401);

  const c = await req.json().catch(() => ({}));
  const clientId = typeof c?.client_id === "string" ? c.client_id.trim() : "";
  const secret = typeof c?.client_secret === "string" ? c.client_secret.trim() : "";
  if (clientId.length < 8 || clientId.length > 200 || secret.length < 8 || secret.length > 400) {
    return json({ erro: "Confira o Client ID e o Client Secret copiados do Bling." }, 400);
  }
  // A RLS decide: só enxerga a loja quem tem acesso a ela.
  const { data: loja } = await usuario.from("lojas").select("id").eq("id", typeof c?.loja_id === "string" ? c.loja_id : "").maybeSingle();
  if (!loja) return json({ erro: "Loja não encontrada." }, 404);

  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { error } = await admin.rpc("bling_salvar_app", { p_loja_id: loja.id, p_client_id: clientId, p_secret_cifrado: await cifrar(secret, chaveCifra) });
  if (error) return json({ erro: "Não foi possível salvar. Tente de novo." }, 500);
  await admin.from("auditoria").insert({ loja_id: loja.id, user_id: u.user.id, acao: "bling.app_cadastrado", tabela: "private.bling_apps", depois: { client_id_final: clientId.slice(-4) } });
  return json({ ok: true });
});
