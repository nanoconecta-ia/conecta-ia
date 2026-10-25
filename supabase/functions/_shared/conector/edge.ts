// Cola das Edge Functions do Nano.ia (somente Deno; nunca importada pelos testes). Autentica a PESSOA (JWT do Supabase),
// confere que é membro da loja e monta os clientes. A lógica de negócio está em acoes.ts/chat.ts, testada contra o banco.
import { createClient } from "npm:@supabase/supabase-js@2";
import { decifrar } from "../cripto.ts";
import { chaveiroPlataforma } from "../plataforma.ts";
import { armazemSupabase } from "../bling_armazem.ts";
import { BlingLeituraReal } from "./porta_bling.ts";

export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
export const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });

export interface Sessao {
  url: string;
  // deno-lint-ignore no-explicit-any
  admin: any;
  userId: string;
  lojaId: string;
  papel: "lojista" | "editor";
  nomeLoja: string;
}

/** JWT do usuário -> pessoa autenticada e membro da loja pedida. Qualquer falha devolve a Response pronta. */
export async function autenticar(req: Request, lojaId: unknown): Promise<Sessao | Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ erro: "Método não permitido." }, 405);
  const url = Deno.env.get("SUPABASE_URL")!;
  const usuario = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } }, auth: { persistSession: false } });
  const { data: u } = await usuario.auth.getUser();
  if (!u.user) return json({ erro: "Não autenticado." }, 401);
  if (typeof lojaId !== "string" || !/^[0-9a-f-]{36}$/i.test(lojaId)) return json({ erro: "Informe loja_id." }, 400);
  const { data: m } = await usuario.from("usuarios_loja").select("papel").eq("loja_id", lojaId).eq("user_id", u.user.id).maybeSingle();
  if (!m) return json({ erro: "Você não tem acesso a esta loja." }, 403);
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data: loja } = await admin.from("lojas").select("nome, ativa").eq("id", lojaId).maybeSingle();
  if (!loja || loja.ativa === false) return json({ erro: "Loja não encontrada." }, 404);
  return { url, admin, userId: u.user.id, lojaId, papel: m.papel, nomeLoja: loja.nome };
}

/** Leitura do Bling com o token da loja (nunca escreve). undefined se a plataforma ainda não tem chave de cifra. */
export async function blingLeitura(s: Sessao) {
  const chaveCifra = await chaveiroPlataforma(s.admin, (n) => Deno.env.get(n));
  return chaveCifra ? new BlingLeituraReal(armazemSupabase(s.admin), s.lojaId, { chaveCifra }) : undefined;
}

export const decifrarComChaveiro = async (s: Sessao) => {
  const chaveiro = await chaveiroPlataforma(s.admin, (n) => Deno.env.get(n));
  if (!chaveiro) throw new Error("Chave de cifra da plataforma não configurada.");
  return (cifrada: string) => decifrar(cifrada, chaveiro);
};
