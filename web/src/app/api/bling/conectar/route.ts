import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { exigirLojista } from "@/lib/sessao";
import { configBling } from "@/lib/bling/config";
import { urlAutorizacao } from "@/lib/bling/oauth";

export const dynamic = "force-dynamic";

/** Inicia o OAuth: grava state + loja em cookie httpOnly e redireciona ao Bling. */
export async function GET() {
  const { loja } = await exigirLojista();
  if (!loja) return NextResponse.redirect(new URL("/painel", process.env.APP_URL));
  const state = randomBytes(24).toString("base64url");
  const res = NextResponse.redirect(urlAutorizacao(configBling(), state));
  res.cookies.set("bling_oauth", `${state}.${loja.id}`, {
    httpOnly: true, secure: true, sameSite: "lax", path: "/api/bling", maxAge: 600,
  });
  return res;
}
