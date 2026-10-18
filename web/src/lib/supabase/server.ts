import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** Cliente com a sessão da pessoa logada (chave anon + RLS). Só no servidor. */
export async function supabaseServidor() {
  const jar = await cookies(); // antes da checagem: marca a rota como dinâmica (depende da sessão)
  const url = process.env.SUPABASE_URL;
  const chave = process.env.SUPABASE_ANON_KEY;
  if (!url || !chave) throw new Error("SUPABASE_URL e SUPABASE_ANON_KEY não configurados");
  return createServerClient(url, chave, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (lista) => {
        try {
          lista.forEach(({ name, value, options }) => jar.set(name, value, options));
        } catch {
          // chamado de um Server Component: a renovação da sessão é feita no middleware
        }
      },
    },
  });
}
