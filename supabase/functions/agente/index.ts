// POST { produto_id, idempotency_key } com o JWT do usuário logado.
// Executa a receita ativa do tipo do produto: lê o espelho, extrai do nome (literal), classifica,
// grava na camada de enriquecimento como a_confirmar e registra a execução. NÃO escreve no Bling.
// Passos 4–8 (pesquisa de códigos, especificações, NCM/CEST, imagem, descrição) dependem de fontes e
// provedor de IA ainda não ligados: voltam em `passos_pendentes`, nunca preenchidos por palpite.
import { createClient } from "npm:@supabase/supabase-js@2";
import { classificarSlug, extrairDoNome } from "../_shared/agente/extrair.ts";
import { checarCamposExigidos, montarLinhas, resultadoDe } from "../_shared/agente/plano.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const PASSOS_EXECUTADOS = [1, 2, 3, 9, 10];
const PASSOS_PENDENTES = [4, 5, 6, 7, 8];

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
  const produtoId = typeof corpo?.produto_id === "string" ? corpo.produto_id : "";
  const chave = typeof corpo?.idempotency_key === "string" ? corpo.idempotency_key.trim() : "";
  if (!produtoId || chave.length < 8 || chave.length > 100) {
    return json({ erro: "Informe produto_id e idempotency_key (8 a 100 caracteres)." }, 400);
  }

  // A RLS decide: só enxerga o produto quem tem acesso à loja dele.
  const { data: produto } = await usuario.from("produtos")
    .select("id, loja_id, bling_id, sku, nome, preco, categoria").eq("id", produtoId).maybeSingle();
  if (!produto) return json({ erro: "Produto não encontrado." }, 404);

  // Escrita só pelo servidor, sempre com loja_id vindo do produto (nunca do corpo da requisição).
  const sb = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

  const repetida = await sb.from("receita_execucoes").select("*")
    .eq("loja_id", produto.loja_id).eq("idempotency_key", chave).maybeSingle();
  if (repetida.data) return json({ repetida: true, execucao: repetida.data });

  const slug = classificarSlug(produto.nome ?? "");
  if (!slug) return json({ erro: "Sem receita para este tipo de produto.", receita_faltando: true, motivo: "tipo não reconhecido pelo nome" }, 422);
  const { data: receitas } = await sb.from("receitas").select("id, codigo, versao, campos_exigidos, gatilho")
    .eq("status", "ativa").eq("perfil_ramo", "autopecas").filter("gatilho->>taxonomia_slug", "eq", slug);
  const receita = receitas?.[0];
  if (!receita) return json({ erro: "Sem receita ativa para este tipo de produto.", receita_faltando: true, taxonomia: slug }, 422);

  const ins = await sb.from("receita_execucoes").insert({
    loja_id: produto.loja_id, produto_id: produto.id, receita_id: receita.id, idempotency_key: chave,
  }).select("id").single();
  if (ins.error) {
    // corrida: outra chamada com a mesma chave acabou de criar a execução
    const outra = await sb.from("receita_execucoes").select("*")
      .eq("loja_id", produto.loja_id).eq("idempotency_key", chave).maybeSingle();
    if (outra.data) return json({ repetida: true, execucao: outra.data });
    return json({ erro: "Não foi possível registrar a execução." }, 500);
  }
  const execId = ins.data.id as string;

  try {
    const agora = new Date().toISOString();
    const linhas = montarLinhas(produto.bling_id, extrairDoNome(produto.nome ?? ""), slug, agora)
      .map((l) => ({ ...l, loja_id: produto.loja_id, produto_id: produto.id }));

    // Nunca sobrescreve: campo já existente (inclusive aprovado ou rejeitado pelo lojista) é preservado.
    const existentes = await sb.from("produto_enriquecimento").select("campo").eq("produto_id", produto.id);
    const jaTem = new Set((existentes.data ?? []).map((r: { campo: string }) => r.campo));
    const novas = linhas.filter((l) => !jaTem.has(l.campo));
    if (novas.length) {
      const g = await sb.from("produto_enriquecimento").insert(novas);
      if (g.error) throw new Error("falha ao gravar o enriquecimento");
    }

    const [campos, imgs, cods, apls] = await Promise.all([
      sb.from("produto_enriquecimento").select("campo").eq("produto_id", produto.id),
      sb.from("produto_imagens").select("id", { count: "exact", head: true }).eq("produto_id", produto.id).eq("principal", true).is("removida_em", null),
      sb.from("produto_codigos").select("id", { count: "exact", head: true }).eq("produto_id", produto.id).eq("tipo", "fabricante"),
      sb.from("produto_aplicacoes").select("id", { count: "exact", head: true }).eq("produto_id", produto.id),
    ]);
    const { preenchidos, vazios } = checarCamposExigidos(receita.campos_exigidos as string[], {
      nome: produto.nome, sku: produto.sku, preco: produto.preco == null ? null : Number(produto.preco),
      categoria: produto.categoria,
      temImagemPrincipal: (imgs.count ?? 0) > 0, temCodigoFabricante: (cods.count ?? 0) > 0, temAplicacao: (apls.count ?? 0) > 0,
      camposEnriquecidos: new Set((campos.data ?? []).map((r: { campo: string }) => r.campo)),
    });

    const fim = await sb.from("receita_execucoes").update({
      resultado: resultadoDe(vazios), campos_preenchidos: preenchidos, campos_vazios: vazios, concluida_em: new Date().toISOString(),
    }).eq("id", execId).select("*").single();
    return json({
      execucao: fim.data,
      receita: { codigo: receita.codigo, versao: receita.versao },
      gravados: novas.map((l) => l.campo),
      preservados: linhas.filter((l) => jaTem.has(l.campo)).map((l) => l.campo),
      passos_executados: PASSOS_EXECUTADOS,
      passos_pendentes: PASSOS_PENDENTES,
    });
  } catch (e) {
    await sb.from("receita_execucoes").update({
      resultado: "falhou", erro: e instanceof Error ? e.message : "erro desconhecido", concluida_em: new Date().toISOString(),
    }).eq("id", execId);
    return json({ erro: "A execução falhou e foi registrada.", execucao_id: execId }, 500);
  }
});
