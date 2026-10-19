import { NextResponse, type NextRequest } from "next/server";
import { supabaseServidor } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = await supabaseServidor();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/entrar", req.url), 303);
}
