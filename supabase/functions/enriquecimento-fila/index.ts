// POST { loja_id, acao: "relatorio" | "enfileirar", confirmar?: boolean, limite?: number } com o JWT do usuário logado.
// - relatorio (padrão): SÓ LÊ. Mostra o que entraria na fila, o que está sem receita, sem tipo e o diagnóstico do cadastro.
// - enfileirar: só grava com confirmar === true. Cria tarefas em enriquecimento_tarefas (status na_fila). NÃO executa
//   passos de IA, NÃO escreve no Bling. A execução continua pela função `agente`, sob demanda.
import { createClient } from "npm:@supabase/supabase-js@2";
import { diagnosticoCadastro, planejarFila, type ReceitaMin } from "../_shared/agente/fila.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ erro: "Método não permitido." }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const usuario = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    auth: { persistSession: false },
  });
  const { data: u } = await usuario.auth.getUser();
  if (!u.user) return json({ erro: "Não autenticado." }, 401);

  const corpo = await req.json().catch(() => ({}));
  const lojaId = typeof corpo?.loja_id === "string" ? corpo.loja_id : "";
  const acao = corpo?.acao === "enfileirar" ? "enfileirar" : "relatorio";
  const limite = Math.min(Math.max(Number(corpo?.limite) || 25, 1), 100);
  if (!lojaId) return json({ erro: "Informe loja_id." }, 400);

  // A RLS decide: só enxerga produtos quem tem acesso à loja.
  const { data: produtos, error: ep } = await usuario.from("produtos")
    .select("id, nome, sku, preco, categoria, marca, gtin, descricao").eq("loja_id", lojaId).limit(5000);
  if (ep) return json({ erro: "Não foi possível ler os produtos." }, 500);
  if (!produtos?.length) return json({ erro: "Loja sem produtos ou sem acesso." }, 404);

  const sb = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data: receitas } = await sb.from("receitas").select("codigo, campos_exigidos, gatilho")
    .eq("status", "ativa").eq("perfil_ramo", "autopecas");
  const porSlug = new Map<string, ReceitaMin>();
  for (const r of receitas ?? []) {
    const slug = (r.gatilho as { taxonomia_slug?: string } | null)?.taxonomia_slug;
    if (slug) porSlug.set(slug, { codigo: r.codigo as string, campos_exigidos: r.campos_exigidos as string[] });
  }
  const { data: abertas } = await sb.from("enriquecimento_tarefas").select("produto_id, tipo")
    .eq("loja_id", lojaId).in("status", ["na_fila", "reivindicada"]);
  const setAbertas = new Set((abertas ?? []).map((t: { produto_id: string; tipo: string }) => `${t.produto_id}|${t.tipo}`));

  const plano = planejarFila(produtos, porSlug, setAbertas);
  const cadastro: Record<string, number> = {};
  for (const p of produtos) for (const f of diagnosticoCadastro({ ...p, preco: p.preco == null ? null : Number(p.preco) })) cadastro[f] = (cadastro[f] ?? 0) + 1;
  const resumo = {
    produtos: produtos.length, entrariam_na_fila: plano.enfileirar.length, ja_na_fila: plano.jaNaFila,
    sem_receita: plano.semReceita.length, sem_tipo: plano.semTipo.length, cadastro_incompleto: cadastro,
  };

  if (acao === "relatorio") {
    const porTipoSemReceita: Record<string, number> = {};
    for (const s of plano.semReceita) porTipoSemReceita[s.tipo] = (porTipoSemReceita[s.tipo] ?? 0) + 1;
    return json({ modo: "relatorio", gravou: false, resumo, sem_receita_por_tipo: porTipoSemReceita,
      amostra_fila: plano.enfileirar.slice(0, 10), amostra_sem_tipo: plano.semTipo.slice(0, 20) });
  }

  if (corpo?.confirmar !== true) {
    return json({ modo: "enfileirar", gravou: false, aviso: "Nada foi gravado. Envie confirmar: true para criar as tarefas.", resumo });
  }
  const lote = plano.enfileirar.slice(0, limite);
  if (!lote.length) return json({ modo: "enfileirar", gravou: false, criadas: 0, resumo });
  const ins = await sb.from("enriquecimento_tarefas").insert(
    lote.map((t) => ({ loja_id: lojaId, produto_id: t.produto_id, tipo: t.tipo, provedor_preferido: "integrado" })),
  ).select("id");
  if (ins.error) return json({ erro: "Não foi possível criar as tarefas." }, 500);
  return json({ modo: "enfileirar", gravou: true, criadas: ins.data?.length ?? 0, restantes: plano.enfileirar.length - lote.length, resumo });
});
