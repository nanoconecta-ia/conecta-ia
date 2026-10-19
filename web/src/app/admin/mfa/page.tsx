import { redirect } from "next/navigation";
import { supabaseServidor } from "@/lib/supabase/server";

export const metadata = { title: "Verificação em duas etapas" };

/** A área do super admin exige MFA (aal2). O cadastro do segundo fator ainda será implementado aqui. */
export default async function Mfa() {
  const supabase = await supabaseServidor();
  const { data } = await supabase.auth.getUser();
  if (!data.user || data.user.app_metadata?.papel !== "super_admin") redirect("/painel");
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-3 p-6">
      <h1 className="text-xl font-semibold">Verificação em duas etapas necessária</h1>
      <p className="text-sm text-suave">
        O acesso de administrador da plataforma só abre com a verificação em duas etapas concluída. A tela de cadastro e
        confirmação do segundo fator ainda não foi implementada.
      </p>
    </main>
  );
}
