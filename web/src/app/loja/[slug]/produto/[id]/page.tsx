import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { brl } from "@/lib/publicacao";
import { linkWhatsapp, lojaPorSlug, produtoPublico, politicasAprovadasDaLoja, aplicacoesPublicasProduto } from "@/lib/vitrine";
import { ChatLojaWeb } from "@/components/ChatLojaWeb";
import { RodapeComercialWeb } from "@/components/RodapeComercialWeb";

type Props = { params: Promise<{ slug: string; id: string }> };

const UUID = /^[0-9a-f-]{36}$/i;

async function carregar({ slug, id }: { slug: string; id: string }) {
  if (!UUID.test(id)) return null;
  const loja = await lojaPorSlug(slug);
  if (!loja) return null;
  const item = await produtoPublico(loja.id, id);
  return item ? { loja, ...item } : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const d = await carregar(await params);
  return d ? { title: d.produto.nome ?? "Produto", description: d.produto.descricao?.slice(0, 155), robots: d.loja.ambiente === "teste" ? { index:false,follow:false } : undefined } : {};
}

export default async function PaginaProduto({ params }: Props) {
  const p = await params;
  const d = await carregar(p);
  if (!d) notFound();
  const { loja, produto, imagens } = d;
  const [politicas, aplicacoes] = await Promise.all([politicasAprovadasDaLoja(loja.id), aplicacoesPublicasProduto(loja.id, produto.id)]);
  const principal = imagens.find((i) => i.principal) ?? imagens[0];
  const base = loja.slug === "mobis" ? "https://mobisautopecas.com.br" : process.env.APP_URL ?? "http://localhost:3000";
  const url = `${base}/loja/${loja.slug}/produto/${produto.id}`;
  const wa = linkWhatsapp(loja, produto, url);
  // Dados estruturados com os mesmos valores exibidos na página (sem inventar campos ausentes).
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: produto.nome,
    sku: produto.sku ?? undefined,
    gtin: produto.gtin ?? undefined,
    brand: produto.marca ? { "@type": "Brand", name: produto.marca } : undefined,
    image: principal?.url,
    description: produto.descricao ?? undefined,
    offers: loja.ambiente === "producao" && produto.preco
      ? { "@type": "Offer", price: produto.preco, priceCurrency: "BRL", url,
          availability: (produto.estoque ?? 0) > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock" }
      : undefined,
  };
  return (
    <article className="mx-auto grid max-w-5xl gap-6 p-4 sm:p-6 md:grid-cols-2">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <div className="aspect-square overflow-hidden rounded-xl bg-white p-4 ring-1 ring-slate-200">
        {principal ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={principal.url} alt={produto.nome ?? ""} className="size-full object-contain" />
        ) : (
          <div className="grid size-full place-items-center text-sm text-suave">Sem imagem</div>
        )}
      </div>
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold">{produto.nome}</h1>
        <p className="font-mono text-sm text-suave">Ref. {produto.sku ?? "—"}</p>
        <p className="text-3xl font-semibold tabular-nums">{brl(produto.preco)}</p>
        {produto.descricao && <p className="whitespace-pre-line text-sm text-suave">{produto.descricao}</p>}
        <section className="aplicacoes-cliente" aria-label="Aplicações técnicas homologadas">
          <h2>Aplicações aprovadas por veículo</h2>
          {aplicacoes.length > 0 ? <ul>{aplicacoes.map((a,i) => <li key={i}>
            <strong>{a.modelo}</strong> {a.motorizacao ?? "Motor a confirmar"} ·
            {a.ano_inicial ?? "Ano inicial não informado"}–{a.ano_final ?? "Ano final não informado"}
            {a.restricao && <p>Restrição: {a.restricao}</p>}
            {a.contraindicacao && <p>Não aplicar quando: {a.contraindicacao}</p>}
          </li>)}</ul> : <p>Nenhuma aplicação liberada para exibição. Confirme a compatibilidade com o vendedor antes de comprar.</p>}
        </section>
        {wa && (
          <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-block rounded-lg bg-ok px-5 py-3 font-medium text-white">
            Conversar com vendedor no WhatsApp
          </a>
        )}
      </div>
      <div className="md:col-span-2">
        <p className="text-sm text-suave">Aplicações por veículo só são informadas após validação técnica individual. O SKU representa o cadastro físico, não cria um estoque adicional.</p>
        {loja.ambiente === "teste" && <p className="mobis-web-teste" role="status">LOJA TESTE — consulte sem concluir pedidos.</p>}
        <RodapeComercialWeb loja={loja} politicas={politicas} />
      </div>
      <ChatLojaWeb nome={loja.nome} whatsapp={loja.whatsapp} produto={{ nome: produto.nome ?? "Peça automotiva", sku: produto.sku ?? "" }} />
    </article>
  );
}
