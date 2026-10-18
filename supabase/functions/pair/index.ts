// Conecta Pair — lado do solicitante (verify_jwt = false; a função valida tudo e limita taxa). POST { acao: iniciar|consultar|renovar|encerrar, ... }.
// O lado do APROVADOR (pair_detalhe/pair_aprovar/pair_recusar/revogações) é chamado direto pelo painel com o JWT do lojista, via RPC.
import { createClient } from "npm:@supabase/supabase-js@2.117.3";
import { tratarPair } from "../_shared/pair/servico.ts";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const appUrl = Deno.env.get("APP_URL");
  if (!appUrl) return new Response(JSON.stringify({ erro: "Pareamento ainda não configurado no servidor." }), { status: 503, headers: { ...CORS, "Content-Type": "application/json" } });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || undefined;
  const r = await tratarPair(
    { metodo: req.method, authorization: req.headers.get("Authorization"), corpo: await req.text(), ip },
    {
      appUrl,
      rpc: (fn, args) => admin.rpc(fn, args),
      limite: async (chave, max, janelaS) => (await admin.rpc("limite_chamada", { p_chave: chave, p_max: max, p_janela_s: janelaS })).data === true,
    },
  );
  return new Response(JSON.stringify(r.corpo), { status: r.status, headers: { ...CORS, "Content-Type": "application/json", ...(r.headers ?? {}) } });
});
