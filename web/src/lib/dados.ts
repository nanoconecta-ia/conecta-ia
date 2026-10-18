import type { SupabaseClient } from "@supabase/supabase-js";
import type { Imagem, Produto } from "@/lib/tipos";

const COLUNAS =
  "id, loja_id, bling_id, sku, nome, preco, estoque, situacao, categoria, marca, gtin, descricao, publicado, sincronizado_em";

export type ProdutoComImagens = Produto & { imagens: Imagem[] };

/** Produtos de uma loja com as imagens. Sempre filtra por loja_id (a RLS reforça no banco). */
export async function produtosComImagens(
  supabase: SupabaseClient,
  lojaId: string,
  opcoes: { publicado?: boolean; limite?: number } = {},
): Promise<ProdutoComImagens[]> {
  let q = supabase.from("produtos").select(COLUNAS).eq("loja_id", lojaId).order("nome").limit(opcoes.limite ?? 100);
  if (opcoes.publicado !== undefined) q = q.eq("publicado", opcoes.publicado);
  const { data: produtos } = await q;
  const lista = (produtos ?? []) as Produto[];
  if (lista.length === 0) return [];

  const { data: imgs } = await supabase
    .from("produto_imagens")
    .select("id, produto_id, url, ordem, tipo, principal, aprovada")
    .eq("loja_id", lojaId)
    .in("produto_id", lista.map((p) => p.id))
    .order("ordem");
  const porProduto = new Map<string, Imagem[]>();
  for (const i of (imgs ?? []) as (Imagem & { produto_id: string })[]) {
    porProduto.set(i.produto_id, [...(porProduto.get(i.produto_id) ?? []), i]);
  }
  return lista.map((p) => ({ ...p, imagens: porProduto.get(p.id) ?? [] }));
}

export async function contar(supabase: SupabaseClient, lojaId: string, publicado?: boolean) {
  let q = supabase.from("produtos").select("id", { count: "exact", head: true }).eq("loja_id", lojaId);
  if (publicado !== undefined) q = q.eq("publicado", publicado);
  const { count } = await q;
  return count ?? 0;
}
