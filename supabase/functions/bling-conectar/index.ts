// POST { loja_id } com o JWT do usuário logado -> { url } para autorizar o app no Bling.
// O state é assinado (loja + usuário + validade). Nada sensível volta ao navegador.
import { createClient } from "npm:@supabase/supabase-js@2";
import { assinarEstado } from "../_shared/estado.ts";

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

  const clientId = Deno.env.get("BLING_CLIENT_ID");
  const segredo = Deno.env.get("ESTADO_SEGREDO");
  if (!clientId || !segredo) return json({ erro: "Conexão com o Bling ainda não configurada no servidor." }, 503);

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    auth: { persistSession: false },
  });
  const { data: u } = await sb.auth.getUser();
  if (!u.user) return json({ erro: "Não autenticado." }, 401);

  const corpo = await req.json().catch(() => ({}));
  const lojaId = typeof corpo?.loja_id === "string" ? corpo.loja_id : "";
  // A RLS decide: só enxerga a loja quem tem acesso a ela.
  const { data: loja } = await sb.from("lojas").select("id").eq("id", lojaId).maybeSingle();
  if (!loja) return json({ erro: "Loja não encontrada." }, 404);

  const state = await assinarEstado({ l: loja.id, u: u.user.id, e: Date.now() + 10 * 60_000 }, segredo);
  const destino = new URL("https://www.bling.com.br/Api/v3/oauth/authorize");
  destino.searchParams.set("response_type", "code");
  destino.searchParams.set("client_id", clientId);
  destino.searchParams.set("state", state);
  return json({ url: destino.toString() });
});
