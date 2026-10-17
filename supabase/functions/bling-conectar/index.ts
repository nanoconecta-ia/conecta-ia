// POST { loja_id } com o JWT do usuário logado -> { url } para autorizar o app no Bling.
// O state é assinado (loja + usuário + validade). Nada sensível volta ao navegador.
import { createClient } from "npm:@supabase/supabase-js@2";
import { assinarEstado } from "../_shared/estado.ts";
import { segredoEstado } from "../_shared/plataforma.ts";

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

  const adminV = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const segredo = await segredoEstado(adminV, (n) => Deno.env.get(n));
  if (!segredo) return json({ erro: "Conexão com o Bling ainda não configurada no servidor." }, 503);

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
  // Só quem administra a loja inicia a conexão (editor não).
  const { data: admin } = await sb.rpc("pode_administrar_loja", { p_loja_id: loja.id });
  if (admin !== true) return json({ erro: "Só o responsável da loja pode conectar o Bling." }, 403);

  // O Client ID é o do app que o lojista cadastrou para a loja (servidor lê com service role).
  const admin2 = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data: app } = await admin2.rpc("bling_ler_app", { p_loja_id: loja.id });
  const clientId = (app as { client_id: string }[] | null)?.[0]?.client_id;
  if (!clientId) return json({ erro: "Informe primeiro o Client ID e o Client Secret do seu app no Bling." }, 409);

  // State de uso único: o nonce vive no banco e é consumido de forma atômica no callback.
  const { data: nonce } = await admin2.rpc("bling_estado_criar", { p_loja_id: loja.id, p_user_id: u.user.id, p_ttl_s: 600 });
  if (typeof nonce !== "string") return json({ erro: "Não foi possível iniciar a conexão." }, 500);
  const state = await assinarEstado({ l: loja.id, u: u.user.id, e: Date.now() + 10 * 60_000, n: nonce }, segredo);
  const destino = new URL("https://www.bling.com.br/Api/v3/oauth/authorize");
  destino.searchParams.set("response_type", "code");
  destino.searchParams.set("client_id", clientId);
  destino.searchParams.set("state", state);
  return json({ url: destino.toString() });
});
