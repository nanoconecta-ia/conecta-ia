// GET ?code&state (redirecionado pelo Google). Valida o state, troca o código por tokens NO SERVIDOR,
// cifra e grava via RPC (só service_role). Não registra nem devolve token algum.
import { createClient } from "npm:@supabase/supabase-js@2.117.3";
import { verificarEstado } from "../_shared/estado.ts";
import { cifrar } from "../_shared/cripto.ts";
import { chaveiroPlataforma, segredoEstado } from "../_shared/plataforma.ts";
import { clienteDoAmbiente, trocarCodigo } from "../_shared/google_oauth.ts";

const texto = (msg: string, status = 200) =>
  new Response(msg, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });

function voltar(q: string): Response {
  const app = Deno.env.get("APP_URL")?.replace(/\/+$/, "");
  if (!app) return texto(q.startsWith("ok") ? "Conexão com o Google concluída. Pode fechar esta janela." : `Não foi possível conectar (${q}).`, q.startsWith("ok") ? 200 : 400);
  return Response.redirect(`${app}/#/integracoes?google_${q}`, 302);
}

Deno.serve(async (req) => {
  if (req.method !== "GET") return texto("Método não permitido.", 405);
  const cliente = clienteDoAmbiente((n) => Deno.env.get(n));
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const segredo = await segredoEstado(admin, (n) => Deno.env.get(n));
  const chaveCifra = await chaveiroPlataforma(admin, (n) => Deno.env.get(n));
  if (!cliente || !segredo || !chaveCifra) return texto("Conexão com o Google ainda não configurada no servidor.", 503);

  const url = new URL(req.url);
  if (url.searchParams.get("error")) return voltar("erro=negado"); // o usuário cancelou ou negou no Google
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const est = state ? await verificarEstado(state, segredo) : null;
  if (!code || !est || !est.n) return voltar("erro=estado");

  // Uso único e atômico; deve pertencer à loja e ao usuário assinados.
  const { data: usado } = await admin.rpc("google_estado_consumir", { p_nonce: est.n });
  const u0 = (usado as { loja_id: string; user_id: string }[] | null)?.[0];
  if (!u0 || u0.loja_id !== est.l || u0.user_id !== est.u) return voltar("erro=estado");
  // Reconfere que a pessoa AINDA administra a loja (o papel pode ter mudado nos 10 minutos).
  const { data: ainda } = await admin.rpc("bling_usuario_administra", { p_loja_id: est.l, p_user_id: est.u });
  if (ainda !== true) return voltar("erro=permissao");

  const t = await trocarCodigo(cliente, code);
  if (!t) return voltar("erro=troca"); // sem refresh token, sem drive.file, e-mail não verificado ou Google recusou

  try {
    const { error } = await admin.rpc("google_salvar_conta", {
      p_loja_id: est.l, p_user_id: est.u, p_sub: t.sub, p_email: t.email, p_escopos: t.escopos,
      p_access: await cifrar(t.access, chaveCifra), p_refresh: await cifrar(t.refresh, chaveCifra),
      p_expira_em: t.expiraEm.toISOString(),
    });
    if (error) return voltar("erro=gravar");
  } catch {
    return voltar("erro=gravar");
  }
  return voltar("ok=1");
});
