import "server-only";
import { supabaseServico } from "@/lib/supabase/servico";
import type { Imagem, PaginaAplicacao, Produto, ProdutoAplicacao, ProdutoCodigo } from "@/lib/tipos";

const COD_COLS = "tipo, valor, fonte, coletado_em, confianca";

const COLUNAS =
  "id, loja_id, bling_id, sku, nome, preco, estoque, situacao, categoria, marca, gtin, descricao, publicado, sincronizado_em";

export type LojaPublica = { id: string; nome: string; slug: string; whatsapp: string | null; modo_venda: string };

export async function lojaPorSlug(slug: string): Promise<LojaPublica | null> {
  const { data } = await supabaseServico()
    .from("lojas").select("id, nome, slug, whatsapp, modo_venda").eq("slug", slug).eq("ativa", true).maybeSingle();
  return (data as LojaPublica | null) ?? null;
}

async function imagensPublicas(lojaId: string, ids: string[]) {
  if (ids.length === 0) return new Map<string, Imagem[]>();
  const { data } = await supabaseServico()
    .from("produto_imagens").select("id, produto_id, url, ordem, tipo, principal, aprovada")
    .eq("loja_id", lojaId).eq("aprovada", true).in("produto_id", ids).order("ordem");
  const mapa = new Map<string, Imagem[]>();
  for (const i of (data ?? []) as (Imagem & { produto_id: string })[]) {
    mapa.set(i.produto_id, [...(mapa.get(i.produto_id) ?? []), i]);
  }
  return mapa;
}

/** Somente produtos publicados da loja. */
export async function catalogoPublico(lojaId: string, limite = 60) {
  const { data } = await supabaseServico()
    .from("produtos").select(COLUNAS).eq("loja_id", lojaId).eq("publicado", true).order("nome").limit(limite);
  const produtos = (data ?? []) as Produto[];
  const imgs = await imagensPublicas(lojaId, produtos.map((p) => p.id));
  return produtos.map((p) => ({ produto: p, imagens: imgs.get(p.id) ?? [] }));
}

/**
 * Enriquecimento APROVADO de um produto (mesma trava do RLS público, aplicada em código
 * porque o service role ignora RLS): compatibilidade incerta nunca é anunciada na vitrine.
 */
async function enriquecimentoAprovado(lojaId: string, produtoId: string) {
  const cli = supabaseServico();
  const [cod, aplic] = await Promise.all([
    cli.from("produto_codigos")
      .select(COD_COLS)
      .eq("loja_id", lojaId).eq("produto_id", produtoId).eq("status", "aprovado")
      .order("tipo"),
    cli.from("produto_aplicacoes")
      .select("modelo, motorizacao, ano_inicial, ano_final, fonte, coletado_em, confianca, pagina_slug, pagina_titulo, pagina_indexavel")
      .eq("loja_id", lojaId).eq("produto_id", produtoId).eq("status", "aprovado")
      .order("modelo"),
  ]);
  return {
    codigos: ((cod.data ?? []) as ProdutoCodigo[]),
    aplicacoes: ((aplic.data ?? []) as ProdutoAplicacao[]),
  };
}

/**
 * Uma página de aplicação pública (1 SKU → N páginas por veículo).
 * Só serve aplicação `aprovada` com `pagina_slug`; o produto físico precisa estar publicado.
 */
export async function paginaAplicacao(lojaId: string, slug: string): Promise<PaginaAplicacao | null> {
  const cli = supabaseServico();
  const { data: ap } = await cli.from("produto_aplicacoes")
    .select("produto_id, modelo, motorizacao, ano_inicial, ano_final, fonte, coletado_em, confianca, pagina_slug, pagina_titulo, pagina_descricao, pagina_indexavel")
    .eq("loja_id", lojaId).eq("pagina_slug", slug).eq("status", "aprovado").maybeSingle();
  if (!ap) return null;
  const produtoId = (ap as { produto_id: string }).produto_id;
  const { data: prod } = await cli.from("produtos").select(COLUNAS)
    .eq("loja_id", lojaId).eq("id", produtoId).eq("publicado", true).maybeSingle();
  if (!prod) return null;
  const { data: cod } = await cli.from("produto_codigos").select(COD_COLS)
    .eq("loja_id", lojaId).eq("produto_id", produtoId).eq("status", "aprovado").order("tipo");
  return {
    aplicacao: ap as PaginaAplicacao["aplicacao"],
    produto: prod as Produto,
    codigos: (cod ?? []) as ProdutoCodigo[],
  };
}

export async function produtoPublico(lojaId: string, id: string) {
  const { data } = await supabaseServico()
    .from("produtos").select(COLUNAS).eq("loja_id", lojaId).eq("publicado", true).eq("id", id).maybeSingle();
  if (!data) return null;
  const [imgs, enriq] = await Promise.all([imagensPublicas(lojaId, [id]), enriquecimentoAprovado(lojaId, id)]);
  return { produto: data as Produto, imagens: imgs.get(id) ?? [], ...enriq };
}

/** Link de WhatsApp com nome, referência (SKU), código interno e URL, sem simular checkout. */
export function linkWhatsapp(loja: LojaPublica, p: Produto, url: string) {
  if (!loja.whatsapp) return null;
  const texto = `Olá! Tenho interesse em: ${p.nome ?? ""}\nReferência: ${p.sku ?? "—"}\n${url}`;
  return `https://wa.me/${loja.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(texto)}`;
}

export type BannerOferta = { id: string; produto_id: string; sku: string; nome: string; preco: number | null; chamada: string | null; fim: string | null; flash: boolean };

/** Banners de oferta no ar (loja_banners): só produto publicado e dentro do período. Falha na leitura não derruba a vitrine. */
export async function bannersDaLoja(lojaId: string): Promise<BannerOferta[]> {
  const { data, error } = await supabaseServico().rpc("banners_da_vitrine", { p_loja: lojaId });
  return error || !Array.isArray(data) ? [] : (data as BannerOferta[]);
}

/** WhatsApp do banner: mesma mensagem do produto, mais a origem do clique (ref) para a loja saber que veio da oferta. */
export function linkWhatsappBanner(loja: LojaPublica, b: BannerOferta, url: string) {
  if (!loja.whatsapp) return null;
  const texto = `Olá! Tenho interesse em: ${b.nome}\nReferência: ${b.sku}\n${url}\nref: ${b.flash ? "banner-flash" : "banner"}`;
  return `https://wa.me/${loja.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(texto)}`;
}
