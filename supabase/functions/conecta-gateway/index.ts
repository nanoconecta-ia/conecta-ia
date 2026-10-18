// Conecta.IA — gateway MCP/API para agentes externos (verify_jwt = false; autenticação própria por sessão do Conecta Pair).
// POST JSON-RPC 2.0 com "Authorization: Bearer <token da sessão>". Nenhuma credencial do Supabase ou do Bling chega ao agente.
// A lógica fica em ../_shared/pair/gateway.ts (testada sem rede); aqui só se liga o Supabase.
import { createClient } from "npm:@supabase/supabase-js@2.117.3";
import { tratar, type Sessao } from "../_shared/pair/gateway.ts";
import { dadosSupabase } from "../_shared/pair/gateway_dados.ts";
import { chaveiroDoAmbiente } from "../_shared/cripto.ts";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type, mcp-protocol-version, mcp-session-id", "Access-Control-Allow-Methods": "POST, OPTIONS" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || undefined;
  try {
  const chaveCifra = chaveiroDoAmbiente((k) => Deno.env.get(k));
  const ambiente = Deno.env.get("PAIR_AMBIENTE");
  const r = await tratar(
    { metodo: req.method, authorization: req.headers.get("Authorization"), corpo: await req.text(), ip },
    {
      async validar(hash, salHash) { const { data } = await admin.rpc("pair_validar", { p_token_hash: hash, p_sal_hash: salHash }); return (data as Sessao | null) ?? null; },
      limite: async (chave, max, janelaS) => (await admin.rpc("limite_chamada", { p_chave: chave, p_max: max, p_janela_s: janelaS })).data === true,
      async auditar(e) {
        const { error } = await admin.from("auditoria").insert({
          loja_id: e.loja_id, user_id: e.usuario_id, acao: `gateway.${e.resultado}`, tabela: "pair_sessoes",
          depois: { ferramenta: e.ferramenta, sessao_id: e.sessao_id, dispositivo_id: e.dispositivo_id, argumentos: e.chaves_argumentos, detalhe: e.detalhe ?? null },
        });
        if (error) throw new Error("Falha na auditoria."); // bloqueia entrega; sem dados do pedido no log
      },
      dados: dadosSupabase(admin as never, undefined, chaveCifra ? {
        cfg: { chaveCifra }, ambiente: ambiente === "real" || ambiente === "sintetico" ? ambiente : "nao_validado",
      } : undefined),
    },
  );
  if (r.status === 202) return new Response(null, { status: 202, headers: CORS });
  return new Response(JSON.stringify(r.corpo ?? {}), { status: r.status, headers: { ...CORS, "Content-Type": "application/json", ...(r.headers ?? {}) } });
  } catch {
    return new Response(JSON.stringify({ erro: "Gateway temporariamente indisponível." }), { status: 503, headers: { ...CORS, "Content-Type": "application/json" } });
  }
});
