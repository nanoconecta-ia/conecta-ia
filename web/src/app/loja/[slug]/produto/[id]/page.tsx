import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { brl } from "@/lib/publicacao";
import { linkWhatsapp, lojaPorSlug, produtoPublico } from "@/lib/vitrine";

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
  return d ? { title: d.produto.nome ?? "Produto", description: d.produto.descricao?.slice(0, 155) } : {};
}

export default async function PaginaProduto({ params }: Props) {
  const p = await params;
  const d = await carregar(p);
  if (!d) notFound();
  const { loja, produto, imagens } = d;
  const principal = imagens.find((i) => i.principal) ?? imagens[0];
  const base = process.env.APP_URL ?? "http://localhost:3000";
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
    offers: produto.preco
      ? { "@type": "Offer", price: produto.preco, priceCurrency: "BRL", url,
          availability: (produto.estoque ?? 0) > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock" }
      : undefined,
  };
  return (
    <article className="mx-auto grid max-w-5xl gap-6 p-4 sm:p-6 md:grid-cols-2">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <div className="aspect-square overflow-hidden rounded-xl bg-borda/50">
        {principal ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={principal.url} alt={produto.nome ?? ""} className="size-full object-cover" />
        ) : (
          <div className="grid size-full place-items-center text-sm text-suave">Sem imagem</div>
        )}
      </div>
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold">{produto.nome}</h1>
        <p className="font-mono text-sm text-suave">Ref. {produto.sku ?? "—"}</p>
        <p className="text-3xl font-semibold tabular-nums">{brl(produto.preco)}</p>
        {produto.descricao && <p className="whitespace-pre-line text-sm text-suave">{produto.descricao}</p>}
        {wa && (
          <a href={wa} rel="noopener" className="inline-block rounded-lg bg-ok px-5 py-3 font-medium text-white">
            Pedir pelo WhatsApp
          </a>
        )}
      </div>
    </article>
  );
}
