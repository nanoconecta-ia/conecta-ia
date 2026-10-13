import { redirect } from "next/navigation";
import { supabaseServidor } from "@/lib/supabase/server";

export const metadata = { title: "Nova senha" };

const MINIMO = 10;

async function salvar(form: FormData) {
  "use server";
  const supabase = await supabaseServidor();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/entrar?erro=link");
  const senha = String(form.get("senha") ?? "");
  if (senha.length < MINIMO) redirect("/redefinir-senha?erro=curta");
  if (senha !== String(form.get("confirmar") ?? "")) redirect("/redefinir-senha?erro=diferente");
  const { error } = await supabase.auth.updateUser({ password: senha });
  if (error) redirect("/redefinir-senha?erro=falhou");
  await supabase.auth.signOut();
  redirect("/entrar?aviso=senha");
}

const mensagens: Record<string, string> = {
  curta: `A senha precisa ter pelo menos ${MINIMO} caracteres.`,
  diferente: "As senhas não são iguais.",
  falhou: "Não foi possível salvar a nova senha. Peça um novo link.",
};

export default async function RedefinirSenha({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const supabase = await supabaseServidor();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/entrar?erro=link"); // só abre a partir do link enviado por e-mail
  const { erro } = await searchParams;
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-5 p-6">
      <h1 className="text-2xl font-semibold">Criar nova senha</h1>
      {erro && mensagens[erro] && (
        <p role="alert" className="rounded-lg border border-erro/40 bg-erro/10 p-3 text-sm">{mensagens[erro]}</p>
      )}
      <form action={salvar} className="flex flex-col gap-3">
        <label className="text-sm">
          Nova senha
          <input name="senha" type="password" required minLength={MINIMO} autoComplete="new-password" className="mt-1 w-full rounded-lg border border-borda bg-card px-3 py-2.5" />
        </label>
        <label className="text-sm">
          Repita a nova senha
          <input name="confirmar" type="password" required minLength={MINIMO} autoComplete="new-password" className="mt-1 w-full rounded-lg border border-borda bg-card px-3 py-2.5" />
        </label>
        <button className="rounded-lg bg-marca px-4 py-2.5 font-medium text-marca-texto">Salvar senha</button>
      </form>
    </main>
  );
}
