import "server-only";
import { redirect } from "next/navigation";
import { supabaseServidor } from "@/lib/supabase/server";

export type Loja = { id: string; nome: string; slug: string; modo_venda: string };

/** Pessoa logada e as lojas que ela enxerga (RLS decide). Redireciona para o login se não houver sessão. */
export async function exigirLojista() {
  const supabase = await supabaseServidor();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/entrar");
  const { data: lojas } = await supabase.from("lojas").select("id, nome, slug, modo_venda").order("nome");
  const lista = (lojas ?? []) as Loja[];
  return { supabase, user: data.user, lojas: lista, loja: lista[0] ?? null };
}

/** Super admin = papel em app_metadata (não editável pelo usuário) E sessão com MFA (aal2). */
export async function exigirSuperAdmin() {
  const supabase = await supabaseServidor();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/entrar");
  if (data.user.app_metadata?.papel !== "super_admin") redirect("/painel");
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel !== "aal2") redirect("/admin/mfa");
  return { supabase, user: data.user };
}
