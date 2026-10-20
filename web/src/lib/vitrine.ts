import "server-only";
import { supabaseServico } from "@/lib/supabase/servico";
import type { Imagem, Produto } from "@/lib/tipos";

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

export async function produtoPublico(lojaId: string, id: string) {
  const { data } = await supabaseServico()
    .from("produtos").select(COLUNAS).eq("loja_id", lojaId).eq("publicado", true).eq("id", id).maybeSingle();
  if (!data) return null;
  const imgs = await imagensPublicas(lojaId, [id]);
  return { produto: data as Produto, imagens: imgs.get(id) ?? [] };
}

/** Link de WhatsApp com nome, referência (SKU), código interno e URL, sem simular checkout. */
export function linkWhatsapp(loja: LojaPublica, p: Produto, url: string) {
  if (!loja.whatsapp) return null;
  const texto = `Olá! Tenho interesse em: ${p.nome ?? ""}\nReferência: ${p.sku ?? "—"}\nCódigo: ${p.bling_id}\n${url}`;
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
