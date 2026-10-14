import { createClient } from "@supabase/supabase-js";
import { SUPABASE_CHAVE_PUBLICAVEL, SUPABASE_URL } from "./config.ts";

// PKCE: o link de e-mail volta com ?code= na query, sem conflitar com as rotas por #.
export const supabase = createClient(SUPABASE_URL, SUPABASE_CHAVE_PUBLICAVEL, {
  auth: { flowType: "pkce", persistSession: true, detectSessionInUrl: true, autoRefreshToken: true },
});
