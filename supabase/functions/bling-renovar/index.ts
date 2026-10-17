// Chamada pelo cron (pg_cron + pg_net) a cada 30 min. verify_jwt = false; autenticação própria:
// cabeçalho x-cron-segredo comparado com o segredo gerado no Vault pelo próprio banco.
// Renova só o que vence em até 60 min. Responde apenas contagens (nunca token, loja ou erro detalhado).
import { createClient } from "npm:@supabase/supabase-js@2";
import { armazemSupabase } from "../_shared/bling_armazem.ts";
import { renovarLoja } from "../_shared/bling_token.ts";

const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json" } });

function igual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ erro: "Método não permitido." }, 405);
  const clientId = Deno.env.get("BLING_CLIENT_ID");
  const clientSecret = Deno.env.get("BLING_CLIENT_SECRET");
  const chaveCifra = Deno.env.get("CREDENCIAIS_CHAVE_CIFRA");
  if (!clientId || !clientSecret || !chaveCifra) return json({ erro: "Conexão com o Bling ainda não configurada no servidor." }, 503);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const enviado = req.headers.get("x-cron-segredo") ?? "";
  const { data: esperado } = await admin.rpc("bling_cron_segredo");
  if (typeof esperado !== "string" || !esperado || !igual(enviado, esperado)) return json({ erro: "Não autorizado." }, 401);

  const { data: lojas } = await admin.rpc("bling_lojas_para_renovar", { p_janela_min: 60 });
  const arm = armazemSupabase(admin);
  const cont: Record<string, number> = {};
  for (const l of (lojas ?? []) as { loja_id: string }[]) {
    const r = await renovarLoja(arm, l.loja_id, { clientId, clientSecret, chaveCifra });
    cont[r] = (cont[r] ?? 0) + 1;
  }
  return json({ verificadas: (lojas ?? []).length, resultado: cont });
});
