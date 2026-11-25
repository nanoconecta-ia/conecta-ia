import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Cliente público da vitrine (chave anônima — RESPEITA RLS).
 * Lê apenas o que as políticas anônimas permitem: loja ativa, produto publicado,
 * enriquecimento aprovado e imagem aprovada. Nunca usa a service_role, para que a
 * frente de loja possa rodar sem segredo no servidor público.
 */
export function supabasePublico() {
  const url = process.env.SUPABASE_URL;
  const chave = process.env.SUPABASE_ANON_KEY;
  if (!url || !chave) throw new Error("SUPABASE_URL e SUPABASE_ANON_KEY não configurados");
  return createClient(url, chave, { auth: { persistSession: false, autoRefreshToken: false } });
}
