// Assistente do lojista (JWT do usuário). POST { loja_id, acao: "perguntar", texto } ou { loja_id, acao: "decidir", id, decisao: "aprovar"|"rejeitar" }.
// Responde só com dados da própria loja (a RLS decide o acesso). Decidir grava via service role e registra auditoria.
import { createClient } from "npm:@supabase/supabase-js@2";
import { AJUDA_LOJISTA, intencaoLojista } from "../_shared/assistente/intencao.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ erro: "Método não permitido." }, 405);
  const url = Deno.env.get("SUPABASE_URL")!;
  const usuario = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } }, auth: { persistSession: false },
  });
  const { data: u } = await usuario.auth.getUser();
  if (!u.user) return json({ erro: "Não autenticado." }, 401);
  const c = await req.json().catch(() => ({}));
  const lojaId = typeof c?.loja_id === "string" ? c.loja_id : "";
  const { data: loja } = await usuario.from("lojas").select("id, nome").eq("id", lojaId).maybeSingle();
  if (!loja) return json({ erro: "Loja não encontrada." }, 404);

  if (c.acao === "decidir") {
    const id = typeof c.id === "string" ? c.id : "";
    const decisao = c.decisao === "aprovar" ? "aprovado" : c.decisao === "rejeitar" ? "rejeitado" : "";
    if (!id || !decisao) return json({ erro: "Informe id e decisao (aprovar ou rejeitar)." }, 400);
    const { data: item } = await usuario.from("produto_enriquecimento").select("id, loja_id, campo, status, fonte, coletado_em").eq("id", id).eq("loja_id", loja.id).maybeSingle();
    if (!item) return json({ erro: "Item não encontrado." }, 404);
    if (item.status !== "a_confirmar") return json({ erro: "Este item já foi decidido." }, 409);
    if (decisao === "aprovado" && (!item.fonte || !item.coletado_em)) return json({ erro: "Sem fonte e data, o item não pode ser aprovado." }, 422);
    const sb = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const { error } = await sb.from("produto_enriquecimento").update({ status: decisao }).eq("id", id).eq("loja_id", loja.id).eq("status", "a_confirmar");
    if (error) return json({ erro: "Não foi possível registrar a decisão." }, 500);
    await sb.from("auditoria").insert({ loja_id: loja.id, user_id: u.user.id, acao: `enriquecimento.${decisao}`, tabela: "produto_enriquecimento", antes: { status: "a_confirmar", campo: item.campo }, depois: { status: decisao } });
    return json({ ok: true, status: decisao });
  }

  const texto = typeof c?.texto === "string" ? c.texto.slice(0, 300) : "";
  const q = (t: string, f?: (b: any) => any) => { const b = usuario.from(t).select("id", { count: "exact", head: true }).eq("loja_id", loja.id); return f ? f(b) : b; };
  switch (intencaoLojista(texto)) {
    case "resumo": {
      const [p, pend, pub] = await Promise.all([q("produtos"), q("produto_enriquecimento", (b) => b.eq("status", "a_confirmar")), q("produtos", (b) => b.eq("publicado", true))]);
      return json({ resposta: `${loja.nome}: ${p.count ?? 0} produtos espelhados, ${pub.count ?? 0} publicados, ${pend.count ?? 0} itens aguardando sua aprovação.` });
    }
    case "pendentes": {
      const { count } = await q("produto_enriquecimento", (b) => b.eq("status", "a_confirmar"));
      return json({ resposta: count ? `Há ${count} itens aguardando aprovação. Abra "Fila de aprovação" para aprovar ou rejeitar um a um.` : "Nada pendente de aprovação." });
    }
    case "incompletos": {
      const { data } = await usuario.from("produtos").select("nome, sku, preco").eq("loja_id", loja.id).eq("publicado", false).limit(10);
      const sem = (data ?? []).filter((p: any) => !p.sku || !p.preco).length;
      return json({ resposta: `${(data ?? []).length} produtos ainda não publicados (mostrando até 10); ${sem} deles sem SKU ou preço. Produto incompleto não é publicado.` });
    }
    case "taxonomia": {
      const { count } = await usuario.from("taxonomia_nos").select("id", { count: "exact", head: true });
      return json({ resposta: `A taxonomia de autopeças tem ${count ?? 0} nós. Veja a árvore em "Taxonomia". Nós novos só entram como propostos, até você aprovar.` });
    }
    case "bling": {
      const { data } = await usuario.from("bling_conexoes").select("status, ultimo_erro").eq("loja_id", loja.id).maybeSingle();
      return json({ resposta: `Conexão com o Bling: ${data?.status ?? "pendente"}.${data?.ultimo_erro ? ` Último erro: ${data.ultimo_erro}` : ""}` });
    }
    default: return json({ resposta: AJUDA_LOJISTA });
  }
});
