import { NextResponse, type NextRequest } from "next/server";
import { supabaseServidor } from "@/lib/supabase/server";

/** Só caminhos internos: evita redirecionar para outro site (open redirect). */
function destinoSeguro(valor: string | null) {
  return valor && /^\/[a-z0-9\-/]*$/i.test(valor) && !valor.startsWith("//") ? valor : "/painel";
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const destino = destinoSeguro(req.nextUrl.searchParams.get("next"));
  if (code) {
    const supabase = await supabaseServidor();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(destino, req.url));
  }
  const erro = destino === "/redefinir-senha" ? "link" : "google";
  return NextResponse.redirect(new URL(`/entrar?erro=${erro}`, req.url));
}
