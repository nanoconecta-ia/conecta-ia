import { redirect } from "next/navigation";
import { supabaseServidor } from "@/lib/supabase/server";

export const metadata = { title: "Recuperar senha" };

async function pedirLink(form: FormData) {
  "use server";
  const email = String(form.get("email") ?? "").trim();
  if (email) {
    const supabase = await supabaseServidor();
    const origem = process.env.APP_URL ?? "http://localhost:3000";
    // Resultado ignorado de propósito: a resposta é sempre a mesma, para não revelar quais e-mails têm conta.
    await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${origem}/auth/callback?next=/redefinir-senha` });
  }
  redirect("/recuperar-senha?enviado=1");
}

export default async function RecuperarSenha({ searchParams }: { searchParams: Promise<{ enviado?: string }> }) {
  const { enviado } = await searchParams;
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-5 p-6">
      <h1 className="text-2xl font-semibold">Recuperar senha</h1>
      {enviado ? (
        <p role="status" className="rounded-lg border border-ok/40 bg-ok/10 p-3 text-sm">
          Se houver uma conta com esse e-mail, enviamos um link para criar uma nova senha. Confira também o spam.
        </p>
      ) : (
        <form action={pedirLink} className="flex flex-col gap-3">
          <label className="text-sm">
            E-mail da conta
            <input name="email" type="email" required autoComplete="email" className="mt-1 w-full rounded-lg border border-borda bg-card px-3 py-2.5" />
          </label>
          <button className="rounded-lg bg-marca px-4 py-2.5 font-medium text-marca-texto">Enviar link</button>
        </form>
      )}
      <a href="/entrar" className="text-sm text-suave underline">Voltar para entrar</a>
    </main>
  );
}
