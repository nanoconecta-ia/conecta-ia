// Vitrine pública da loja (verify_jwt = false). POST { slug } ou { host } (domínio do cliente) e opcionais { q, pagina }.
// A loja é resolvida NO SERVIDOR: por domínio verificado (DNS e SSL) ou pelo slug. Loja desconhecida/inativa => 404 genérico.
// Só devolve produtos PUBLICADOS e campos públicos (sem custo, fornecedor ou id do ERP).
import { createClient } from "npm:@supabase/supabase-js@2";
import { FONTES, PERFIS, variaveisCss, type Fonte } from "../_shared/loja/tema.ts";
import { montarVitrine, normalizarHost, opcoesVeiculo, produtosDoVeiculo, SLUG_RE, type Aplicacao } from "../_shared/loja/publica.ts";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type, apikey, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const POR_PAGINA = 24;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ erro: "Método não permitido." }, 405);
  const c = await req.json().catch(() => ({}));
  const host = normalizarHost(c?.host);
  const slug = typeof c?.slug === "string" && SLUG_RE.test(c.slug) ? c.slug : null;
  if (!host && !slug) return json({ erro: "Loja não encontrada." }, 404);

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  let lojaId: string | null = null;
  if (host) {
    const { data: d } = await sb.from("dominios_ativos").select("loja_id").eq("dominio", host).maybeSingle();
    lojaId = d?.loja_id ?? null;
  }
  const q = sb.from("lojas").select("id, nome, slug, modo_venda, whatsapp, ativa");
  const { data: loja } = await (lojaId ? q.eq("id", lojaId) : host ? q.eq("id", "00000000-0000-0000-0000-000000000000") : q.eq("slug", slug!)).maybeSingle();
  if (!loja || loja.ativa === false) return json({ erro: "Loja não encontrada." }, 404);

  const pagina = Math.max(1, Math.min(Number.isInteger(c?.pagina) ? c.pagina : 1, 1000));
  const limpar = (v: unknown, n = 60) => (typeof v === "string" ? v.replace(/[%,()*\\]/g, " ").trim().slice(0, n) : "");
  const busca = limpar(c?.q);
  const modelo = limpar(c?.modelo), motor = limpar(c?.motor), categoria = typeof c?.categoria === "string" && SLUG_RE.test(c.categoria) ? c.categoria : "";
  const ano = Number.isInteger(c?.ano) && c.ano >= 1950 && c.ano <= 2100 ? (c.ano as number) : undefined;

  // Publicados (id + categoria) e as aplicações APROVADAS deles: alimentam as opções de busca e os filtros.
  const { data: pub } = await sb.from("produtos").select("id, taxonomia_no_id").eq("loja_id", loja.id).eq("publicado", true).limit(5000);
  const idsPublicados = (pub ?? []).map((p: { id: string }) => p.id);
  let apls: Aplicacao[] = [];
  if (idsPublicados.length) {
    const { data } = await sb.from("produto_aplicacoes").select("produto_id, modelo, motorizacao, ano_inicial, ano_final").eq("loja_id", loja.id).eq("status", "aprovado").limit(5000);
    const publicados = new Set(idsPublicados); // filtra em memória: lista grande de ids estoura o tamanho da URL
    apls = ((data ?? []) as Aplicacao[]).filter((a) => publicados.has(a.produto_id));
  }
  const nosIds = [...new Set((pub ?? []).map((p: { taxonomia_no_id: string | null }) => p.taxonomia_no_id).filter(Boolean))] as string[];
  const { data: nos } = nosIds.length ? await sb.from("taxonomia_nos").select("id, nome, slug").in("id", nosIds) : { data: [] as { id: string; nome: string; slug: string }[] };
  const categorias = (nos ?? []).map((n: { id: string; nome: string; slug: string }) => ({ nome: n.nome, slug: n.slug, total: (pub ?? []).filter((p: { taxonomia_no_id: string | null }) => p.taxonomia_no_id === n.id).length }));

  let consulta = sb.from("produtos").select("nome, sku, preco, estoque, marca, descricao_curta, sincronizado_em", { count: "exact" })
    .eq("loja_id", loja.id).eq("publicado", true).order("nome").range((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA - 1);
  if (busca) consulta = consulta.or(`nome.ilike.%${busca}%,sku.ilike.%${busca}%`);
  if (modelo || motor || ano !== undefined) {
    const ids = [...produtosDoVeiculo(apls, { modelo, motor, ano })];
    consulta = consulta.in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  }
  if (categoria) {
    const no = (nos ?? []).find((n: { slug: string }) => n.slug === categoria);
    consulta = consulta.eq("taxonomia_no_id", no?.id ?? "00000000-0000-0000-0000-000000000000");
  }
  const { data: linhas, count } = await consulta;

  // imagem principal aprovada de cada produto da página
  const skus = (linhas ?? []).map((l: { sku: string | null }) => l.sku).filter(Boolean) as string[];
  const imagens = new Map<string, string>();
  if (skus.length) {
    const { data: ids } = await sb.from("produtos").select("id, sku").eq("loja_id", loja.id).in("sku", skus);
    const porId = new Map((ids ?? []).map((p: { id: string; sku: string }) => [p.id, p.sku]));
    // view da migração 20261019000005: só imagem aprovada, sem retirada e com direitos de uso confirmados (nunca url_original)
    const { data: imgs } = await sb.from("imagens_publicaveis").select("produto_id, url, principal, ordem").eq("loja_id", loja.id).in("produto_id", [...porId.keys()]).order("principal", { ascending: false }).order("ordem");
    for (const i of imgs ?? []) { const s = porId.get(i.produto_id); if (s && !imagens.has(s)) imagens.set(s, i.url); }
  }
  const produtos = montarVitrine((linhas ?? []).map((l: Record<string, unknown>) => ({ ...(l as object), imagem: imagens.get(String(l.sku)) ?? null }) as never), loja.whatsapp);
  // tema da loja (cores/fonte/logo/ícone); sem tema salvo => perfil padrão. As variáveis CSS são calculadas aqui, de valores já validados.
  const { data: tm } = await sb.from("loja_tema").select("cor_primaria, cor_destaque, cor_bloco, fonte, logo_url, icone_url").eq("loja_id", loja.id).maybeSingle();
  const fonteTema = (FONTES as readonly string[]).includes(tm?.fonte) ? (tm!.fonte as Fonte) : "inter";
  const cores = tm ? { primaria: tm.cor_primaria, destaque: tm.cor_destaque, bloco: tm.cor_bloco } : PERFIS.azul_conecta;
  const tema = { variaveis: variaveisCss(cores, fonteTema), logo_url: tm?.logo_url ?? null, icone_url: tm?.icone_url ?? null };
  return json({ loja: { nome: loja.nome, slug: loja.slug, modo_venda: loja.modo_venda }, tema, produtos, total: count ?? produtos.length, pagina, por_pagina: POR_PAGINA, veiculos: opcoesVeiculo(apls), categorias });
});
