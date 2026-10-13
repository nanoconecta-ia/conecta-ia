import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { exigirLojista } from "@/lib/sessao";
import { configBling } from "@/lib/bling/config";
import { trocarCodigo } from "@/lib/bling/oauth";
import { salvarTokens } from "@/lib/bling/credenciais";

export const dynamic = "force-dynamic";

const igual = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export async function GET(req: NextRequest) {
  const base = process.env.APP_URL ?? req.nextUrl.origin;
  const volta = (q: string) => {
    const r = NextResponse.redirect(new URL(`/painel/bling?${q}`, base));
    r.cookies.delete({ name: "bling_oauth", path: "/api/bling" });
    return r;
  };
  const { loja, lojas } = await exigirLojista();
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const [stEsperado, lojaId] = (req.cookies.get("bling_oauth")?.value ?? "").split(".");
  if (!code || !state || !stEsperado || !lojaId || !igual(state, stEsperado)) return volta("erro=estado");
  // a loja do cookie tem de ser uma das lojas que a pessoa logada enxerga (RLS)
  if (!loja || !lojas.some((l) => l.id === lojaId)) return volta("erro=loja");
  try {
    await salvarTokens(lojaId, await trocarCodigo(configBling(), code));
  } catch {
    return volta("erro=troca");
  }
  return volta("ok=1");
}
