import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { exigirLojista } from "@/lib/sessao";
import { oauthLegadoAtivo, podeConectarBling } from "@/lib/bling/permissao";
import { configBling } from "@/lib/bling/config";
import { trocarCodigo } from "@/lib/bling/oauth";
import { salvarTokens } from "@/lib/bling/credenciais";

export const dynamic = "force-dynamic";

const igual = (a: string, b: string) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); };

export async function GET(req: NextRequest) {
  if (!oauthLegadoAtivo()) return NextResponse.json({ erro: "OAuth legado desativado. Use o painel Conecta.IA atual." }, { status: 503 });
  const base = process.env.APP_URL ?? req.nextUrl.origin;
  const volta = (q: string) => {
    const r = NextResponse.redirect(new URL(`/painel/bling?${q}`, base));
    r.cookies.delete({ name: "bling_oauth", path: "/api/bling" });
    return r;
  };
  const { supabase, loja, lojas } = await exigirLojista();
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const [stEsperado, lojaId] = (req.cookies.get("bling_oauth")?.value ?? "").split(".");
  if (!code || !state || !stEsperado || !lojaId || !igual(state, stEsperado)) return volta("erro=estado");
  // a loja do cookie tem de ser uma das lojas que a pessoa logada enxerga (RLS)
  if (!loja || !lojas.some((l) => l.id === lojaId)) return volta("erro=loja");
  if (!await podeConectarBling(supabase, lojaId)) return volta("erro=permissao");
  try {
    await salvarTokens(lojaId, await trocarCodigo(configBling(), code));
  } catch {
    return volta("erro=troca");
  }
  return volta("ok=1");
}
