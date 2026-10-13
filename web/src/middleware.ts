import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Renova a sessão e exige login em /painel e /admin. A checagem de papel é feita no servidor de cada área. */
export async function middleware(req: NextRequest) {
  const url = process.env.SUPABASE_URL;
  const chave = process.env.SUPABASE_ANON_KEY;
  const protegida = req.nextUrl.pathname.startsWith("/painel") || req.nextUrl.pathname.startsWith("/admin");
  if (!url || !chave) {
    return protegida ? NextResponse.redirect(new URL("/entrar?erro=config", req.url)) : NextResponse.next();
  }

  let res = NextResponse.next({ request: req });
  const supabase = createServerClient(url, chave, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (lista) => {
        lista.forEach(({ name, value }) => req.cookies.set(name, value));
        res = NextResponse.next({ request: req });
        lista.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
      },
    },
  });

  const { data } = await supabase.auth.getUser();
  if (protegida && !data.user) return NextResponse.redirect(new URL("/entrar", req.url));
  return res;
}

export const config = { matcher: ["/painel/:path*", "/admin/:path*", "/auth/:path*", "/redefinir-senha"] };
