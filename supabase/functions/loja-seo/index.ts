// SEO da loja (verify_jwt = false; NÃO implantada nesta fase). GET /sitemap.xml, /sitemap-N.xml, /robots.txt, /feed/merchant.xml,
// /produto/<sku> (HTML renderizado no servidor) e /politicas/<slug>. A loja é resolvida NO SERVIDOR: por domínio verificado
// (DNS e SSL, via ?host= ou x-forwarded-host do proxy) ou por ?loja=<slug> (prévia: noindex, sem canonical, sem sitemap/feed).
// O domínio usado nas URLs absolutas é sempre o principal ativo gravado no banco, nunca o que o cliente enviou.
// Só lê produto PUBLICADO de loja ATIVA, imagem publicável (aprovada + direitos) e política APROVADA. Sem custo/fornecedor/bling_id.
import { createClient } from "npm:@supabase/supabase-js@2";
import { normalizarHost, SLUG_RE } from "../_shared/loja/publica.ts";
import { responderSeo } from "../_shared/seo/rotas.ts";
import { skuDoCaminho } from "../_shared/seo/url.ts";
import type { ImagemPublica, LojaSeo, PoliticasPublicas, ProdutoSeo } from "../_shared/seo/dados.ts";

const PAGINA = 1000, MAX_PRODUTOS = 50_000;
const resposta = (r: { status: number; cabecalhos: Record<string, string>; corpo: string }) => new Response(r.corpo, { status: r.status, headers: r.cabecalhos });

// deno-lint-ignore no-explicit-any
async function todas(consulta: (de: number, ate: number) => PromiseLike<{ data: any[] | null; error: unknown }>, max = MAX_PRODUTOS): Promise<any[]> {
  const out: any[] = [];
  for (let de = 0; de < max; de += PAGINA) {
    const { data, error } = await consulta(de, de + PAGINA - 1);
    if (error) throw new Error("falha ao ler os dados");
    out.push(...(data ?? []));
    if ((data ?? []).length < PAGINA) break;
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method !== "GET" && req.method !== "HEAD") return new Response("Método não permitido.", { status: 405, headers: { allow: "GET, HEAD" } });
  const url = new URL(req.url);
  const caminho = "/" + url.pathname.split("/").slice(url.pathname.split("/").indexOf("loja-seo") + 1).filter(Boolean).join("/");
  const host = normalizarHost(url.searchParams.get("host") ?? req.headers.get("x-forwarded-host") ?? "");
  const slug = url.searchParams.get("loja") ?? "";
  const generico = () => resposta(responderSeo(caminho, null, []));
  if (!host && !SLUG_RE.test(slug)) return generico();

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  try {
    let lojaId: string | null = null;
    if (host) { // host informado e não verificado => nada de cair para o slug
      const { data } = await sb.from("dominios_ativos").select("loja_id").eq("dominio", host).maybeSingle();
      lojaId = data?.loja_id ?? null;
      if (!lojaId) return generico();
    }
    const q = sb.from("lojas").select("id, nome, slug, whatsapp, ativa");
    const { data: l } = await (lojaId ? q.eq("id", lojaId) : q.eq("slug", slug)).maybeSingle();
    if (!l || l.ativa === false) return generico();

    const { data: doms } = await sb.from("dominios_ativos").select("dominio, principal").eq("loja_id", l.id).order("principal", { ascending: false }).limit(1);
    const { data: pol } = await sb.from("loja_politicas").select("razao_social, cnpj, endereco, telefone, email_contato, garantia_legal_dias, arrependimento_dias, garantia_texto, troca_devolucao_texto, entrega_texto, privacidade_texto, termos_texto").eq("loja_id", l.id).eq("status", "aprovada").maybeSingle();
    const loja: LojaSeo = { nome: l.nome, slug: l.slug, ativa: true, dominio: doms?.[0]?.dominio ?? null, whatsapp: l.whatsapp ?? null, politicas: (pol as PoliticasPublicas | null) ?? null };

    // Só o necessário: página de produto lê um SKU; sitemap/feed leem todos os publicados.
    const sku = (caminho.match(/^\/produto\/([^/]+)$/) ?? [])[1];
    const skuAlvo = sku ? skuDoCaminho(sku) : null;
    if (sku && !skuAlvo) return resposta(responderSeo(caminho, loja, []));
    const precisaProdutos = caminho === "/sitemap.xml" || /^\/sitemap-\d+\.xml$/.test(caminho) || caminho === "/feed/merchant.xml" || !!skuAlvo;
    let produtos: ProdutoSeo[] = [];
    if ((precisaProdutos && loja.dominio !== null) || skuAlvo) {
      const linhas = await todas((de, ate) => {
        let c = sb.from("produtos").select("id, sku, nome, descricao_curta, marca, gtin, preco, estoque, publicado, situacao, sincronizado_em, taxonomia_no_id").eq("loja_id", l.id).eq("publicado", true).order("sku").range(de, ate);
        if (skuAlvo) c = c.eq("sku", skuAlvo);
        return c;
      });
      const ids = new Set<string>(linhas.map((p) => p.id));
      const imagens = new Map<string, ImagemPublica[]>();
      for (const i of await todas((de, ate) => sb.from("imagens_publicaveis").select("produto_id, url, principal, ordem, tipo, alt_texto, largura_px, altura_px, fundo_branco").eq("loja_id", l.id).order("ordem").range(de, ate))) {
        if (!ids.has(i.produto_id)) continue;
        (imagens.get(i.produto_id) ?? imagens.set(i.produto_id, []).get(i.produto_id)!).push(i as ImagemPublica);
      }
      const longas = new Map<string, string>(), mpns = new Map<string, string>();
      for (const e of await todas((de, ate) => sb.from("produto_enriquecimento").select("produto_id, valor").eq("loja_id", l.id).eq("campo", "descricao_longa").eq("status", "aprovado").range(de, ate)))
        if (ids.has(e.produto_id) && typeof e.valor === "string") longas.set(e.produto_id, e.valor);
      for (const c of await todas((de, ate) => sb.from("produto_codigos").select("produto_id, valor").eq("loja_id", l.id).eq("tipo", "fabricante").eq("status", "aprovado").order("valor").range(de, ate)))
        if (ids.has(c.produto_id) && !mpns.has(c.produto_id)) mpns.set(c.produto_id, c.valor);
      const nosIds = [...new Set(linhas.map((p) => p.taxonomia_no_id).filter(Boolean))] as string[];
      const { data: nos } = nosIds.length ? await sb.from("taxonomia_nos").select("id, nome").eq("status", "aprovado").in("id", nosIds) : { data: [] as { id: string; nome: string }[] };
      const nomeNo = new Map((nos ?? []).map((n: { id: string; nome: string }) => [n.id, n.nome]));
      produtos = linhas.map((p) => ({
        sku: p.sku, nome: p.nome, descricao: p.descricao_curta, descricao_longa: longas.get(p.id) ?? null, marca: p.marca, gtin: p.gtin, mpn: mpns.get(p.id) ?? null,
        preco: p.preco == null ? null : Number(p.preco), estoque: p.estoque == null ? null : Number(p.estoque), publicado: p.publicado === true, situacao: p.situacao,
        atualizado_em: p.sincronizado_em, categoria: nomeNo.get(p.taxonomia_no_id) ?? null, imagens: imagens.get(p.id) ?? [],
      }));
    }
    const r = responderSeo(caminho, loja, produtos);
    return req.method === "HEAD" ? new Response(null, { status: r.status, headers: r.cabecalhos }) : resposta(r);
  } catch {
    return new Response("Serviço indisponível.", { status: 503, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
  }
});
