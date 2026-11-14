// POST { loja_id } com o JWT do usuário logado -> { url } para autorizar o Google Drive da loja.
// State assinado (loja + usuário + validade + nonce de uso único). Nada sensível volta ao navegador.
import { createClient } from "npm:@supabase/supabase-js@2.117.3";
import { assinarEstado } from "../_shared/estado.ts";
import { segredoEstado } from "../_shared/plataforma.ts";
import { clienteDoAmbiente, urlAutorizacao } from "../_shared/google_oauth.ts";

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

  const cliente = clienteDoAmbiente((n) => Deno.env.get(n));
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const segredo = await segredoEstado(admin, (n) => Deno.env.get(n));
  if (!cliente || !segredo) return json({ erro: "Conexão com o Google ainda não configurada no servidor." }, 503);

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
  const { data: pode } = await sb.rpc("pode_administrar_loja", { p_loja_id: loja.id });
  if (pode !== true) return json({ erro: "Só o responsável da loja pode conectar o Google." }, 403);

  const { data: livre } = await admin.rpc("limite_chamada", { p_chave: `google-conectar:${loja.id}`, p_max: 10, p_janela_s: 600 });
  if (livre !== true) return json({ erro: "Muitas tentativas. Aguarde alguns minutos." }, 429);

  const { data: nonce } = await admin.rpc("google_estado_criar", { p_loja_id: loja.id, p_user_id: u.user.id, p_ttl_s: 600 });
  if (typeof nonce !== "string") return json({ erro: "Não foi possível iniciar a conexão." }, 500);
  const state = await assinarEstado({ l: loja.id, u: u.user.id, e: Date.now() + 10 * 60_000, n: nonce }, segredo);
  return json({ url: urlAutorizacao({ clientId: cliente.clientId, redirectUri: cliente.redirectUri, state, loginHint: u.user.email ?? undefined }) });
});
