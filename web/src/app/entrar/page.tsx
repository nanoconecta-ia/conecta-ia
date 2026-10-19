import { redirect } from "next/navigation";
import { supabaseServidor } from "@/lib/supabase/server";

export const metadata = { title: "Entrar" };

async function entrarComSenha(form: FormData) {
  "use server";
  const supabase = await supabaseServidor();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(form.get("email") ?? ""),
    password: String(form.get("senha") ?? ""),
  });
  if (error) redirect("/entrar?erro=credenciais");
  redirect("/painel");
}

async function entrarComGoogle() {
  "use server";
  const supabase = await supabaseServidor();
  const origem = process.env.APP_URL ?? "http://localhost:3000";
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origem}/auth/callback` },
  });
  if (error || !data.url) redirect("/entrar?erro=google");
  redirect(data.url);
}

const avisos: Record<string, string> = {
  senha: "Senha alterada. Entre com a nova senha.",
};

const mensagens: Record<string, string> = {
  credenciais: "E-mail ou senha incorretos.",
  google: "Não foi possível entrar com o Google.",
  config: "O servidor ainda não está configurado.",
  link: "O link de recuperação é inválido ou expirou. Peça um novo.",
};

export default async function Entrar({ searchParams }: { searchParams: Promise<{ erro?: string; aviso?: string }> }) {
  const { erro, aviso } = await searchParams;
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-5 p-6">
      <h1 className="text-2xl font-semibold">Entrar</h1>
      {aviso && avisos[aviso] && (
        <p role="status" className="rounded-lg border border-ok/40 bg-ok/10 p-3 text-sm">{avisos[aviso]}</p>
      )}
      {erro && (
        <p role="alert" className="rounded-lg border border-erro/40 bg-erro/10 p-3 text-sm">
          {mensagens[erro] ?? "Não foi possível entrar."}
        </p>
      )}
      <form action={entrarComSenha} className="flex flex-col gap-3">
        <label className="text-sm">
          E-mail
          <input name="email" type="email" required autoComplete="email" className="mt-1 w-full rounded-lg border border-borda bg-card px-3 py-2.5" />
        </label>
        <label className="text-sm">
          Senha
          <input name="senha" type="password" required autoComplete="current-password" className="mt-1 w-full rounded-lg border border-borda bg-card px-3 py-2.5" />
        </label>
        <button className="rounded-lg bg-marca px-4 py-2.5 font-medium text-marca-texto">Entrar</button>
        <a href="/recuperar-senha" className="text-sm text-suave underline">Esqueci minha senha</a>
      </form>
      <form action={entrarComGoogle}>
        <button className="w-full rounded-lg border border-borda bg-card px-4 py-2.5 font-medium">Entrar com Google</button>
      </form>
    </main>
  );
}
