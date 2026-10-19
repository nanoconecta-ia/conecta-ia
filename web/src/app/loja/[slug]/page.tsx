import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CartaoProduto } from "@/components/CartaoProduto";
import { Vazio } from "@/components/ui";
import { catalogoPublico, lojaPorSlug } from "@/lib/vitrine";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const loja = await lojaPorSlug((await params).slug);
  return loja ? { title: loja.nome, description: `Catálogo de ${loja.nome}` } : {};
}

export default async function Vitrine({ params }: Props) {
  const { slug } = await params;
  const loja = await lojaPorSlug(slug);
  if (!loja) notFound();
  const itens = await catalogoPublico(loja.id);
  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6">
      <header className="mb-5 flex items-center justify-between border-b border-borda pb-3">
        <h1 className="text-xl font-semibold sm:text-2xl">{loja.nome}</h1>
      </header>
      {itens.length === 0 ? (
        <Vazio titulo="Catálogo em preparação" />
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
          {itens.map(({ produto, imagens }) => (
            <li key={produto.id}>
              <CartaoProduto produto={produto} imagens={imagens} href={`/loja/${loja.slug}/produto/${produto.id}`} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
