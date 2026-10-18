import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Cliente de serviço (ignora RLS). SOMENTE servidor, nunca importar em componente de cliente.
 * Usado na vitrine pública para resolver a loja pelo endereço e ler só o que está publicado.
 * Toda consulta aqui DEVE filtrar por loja_id e publicado = true.
 */
export function supabaseServico() {
  const url = process.env.SUPABASE_URL;
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chave) throw new Error("SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY não configurados");
  return createClient(url, chave, { auth: { persistSession: false, autoRefreshToken: false } });
}
