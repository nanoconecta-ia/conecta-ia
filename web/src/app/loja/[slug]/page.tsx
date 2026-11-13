import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CartaoProduto } from "@/components/CartaoProduto";
import { Vazio } from "@/components/ui";
import { BannerOferta } from "@/components/BannerOferta";
import { ChatLojaWeb } from "@/components/ChatLojaWeb";
import { RodapeComercialWeb } from "@/components/RodapeComercialWeb";
import { bannersDaLoja, catalogoPublico, lojaPorSlug, politicasAprovadasDaLoja } from "@/lib/vitrine";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const loja = await lojaPorSlug((await params).slug);
  return loja ? { title: loja.nome, description: `Catálogo de ${loja.nome}`, robots: loja.ambiente === "teste" ? { index:false,follow:false } : undefined } : {};
}

export default async function Vitrine({ params }: Props) {
  const { slug } = await params;
  const loja = await lojaPorSlug(slug);
  if (!loja) notFound();
  const [itens, banners, politicas] = await Promise.all([catalogoPublico(loja.id), bannersDaLoja(loja.id), politicasAprovadasDaLoja(loja.id)]);
  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6">
      <header className="mb-5 flex items-center justify-between border-b border-borda pb-3">
        <h1 className="text-xl font-semibold sm:text-2xl">{loja.nome}</h1>
      </header>
      <nav className="mobis-web-modulos" aria-label="Navegação da loja">
        <a href="#ofertas">Ofertas</a><a href="#catalogo-web">Produtos</a><a href="#rodape-web">Privacidade e contato</a>
      </nav>
      {loja.ambiente === "teste" && <p className="mobis-web-teste" role="status">LOJA TESTE — catálogo demonstrativo, sem concluir pedidos ou receber pagamentos neste site.</p>}
      <section id="ofertas" aria-label="Banners de produtos publicados">
        {banners.map((b) => <BannerOferta key={b.id} loja={loja} banner={b} />)}
      </section>
      <section id="catalogo-web" aria-label="Catálogo de peças publicadas">
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
      </section>
      <div id="rodape-web"><RodapeComercialWeb loja={loja} politicas={politicas} /></div>
      <ChatLojaWeb nome={loja.nome} whatsapp={loja.whatsapp} />
    </div>
  );
}
