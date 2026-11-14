// POST { loja_id } com o JWT do responsável da loja. Revoga o token no Google e apaga os tokens guardados.
// Se o Google não confirmar a revogação, os tokens locais são apagados mesmo assim e o aviso diz isso.
import { createClient } from "npm:@supabase/supabase-js@2.117.3";
import { decifrar } from "../_shared/cripto.ts";
import { chaveiroPlataforma } from "../_shared/plataforma.ts";
import { revogar } from "../_shared/google_oauth.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ erro: "Método não permitido." }, 405);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const chaveCifra = await chaveiroPlataforma(admin, (n) => Deno.env.get(n));
  if (!chaveCifra) return json({ erro: "Conexão com o Google ainda não configurada no servidor." }, 503);

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    auth: { persistSession: false },
  });
  const { data: u } = await sb.auth.getUser();
  if (!u.user) return json({ erro: "Não autenticado." }, 401);

  const corpo = await req.json().catch(() => ({}));
  const lojaId = typeof corpo?.loja_id === "string" ? corpo.loja_id : "";
  const { data: loja } = await sb.from("lojas").select("id").eq("id", lojaId).maybeSingle();
  if (!loja) return json({ erro: "Loja não encontrada." }, 404);
  const { data: pode } = await sb.rpc("pode_administrar_loja", { p_loja_id: loja.id });
  if (pode !== true) return json({ erro: "Só o responsável da loja pode desconectar o Google." }, 403);

  let revogado = true;
  const { data: cred } = await admin.rpc("google_ler_credenciais", { p_loja_id: loja.id });
  const c0 = (cred as { refresh_token_cifrado: string }[] | null)?.[0];
  if (c0) {
    try { revogado = await revogar(await decifrar(c0.refresh_token_cifrado, chaveCifra)); } catch { revogado = false; }
  }
  const { error } = await admin.rpc("google_desconectar", { p_loja_id: loja.id, p_user_id: u.user.id });
  if (error) return json({ erro: "Não foi possível desconectar." }, 500);
  return json({ ok: true, revogado_no_google: revogado });
});
