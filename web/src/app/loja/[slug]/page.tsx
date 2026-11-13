import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CartaoProduto } from "@/components/CartaoProduto";
import { Vazio } from "@/components/ui";
import { BannerOferta } from "@/components/BannerOferta";
import { ChatLojaWeb } from "@/components/ChatLojaWeb";
import { bannersDaLoja, catalogoPublico, lojaPorSlug } from "@/lib/vitrine";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const loja = await lojaPorSlug((await params).slug);
  return loja ? { title: loja.nome, description: `Catálogo de ${loja.nome}` } : {};
}

export default async function Vitrine({ params }: Props) {
  const { slug } = await params;
  const loja = await lojaPorSlug(slug);
  if (!loja) notFound();
  const [itens, banners] = await Promise.all([catalogoPublico(loja.id), bannersDaLoja(loja.id)]);
  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6">
      <header className="mb-5 flex items-center justify-between border-b border-borda pb-3">
        <h1 className="text-xl font-semibold sm:text-2xl">{loja.nome}</h1>
      </header>
      {banners.map((b) => <BannerOferta key={b.id} loja={loja} banner={b} />)}
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
      {loja.slug === "mobis" && <footer className="mobis-web-rodape" aria-label="Contato da loja">
        <div><strong>Mobis Autopeças</strong><p>Mobis Distribuidora de Peças e Acessórios Ltda. · CNPJ 19.903.967/0001-01</p><p>Av. T-9, 3492 — Jardim América, Goiânia/GO · Endereço cadastral</p></div>
        <nav aria-label="Canais oficiais"><a href="https://mobisautopecas.com.br">Site oficial</a><a href="https://www.google.com/maps/search/?api=1&query=Av.%20T-9%2C%203492%2C%20Jardim%20Am%C3%A9rica%2C%20Goi%C3%A2nia%20GO" target="_blank" rel="noopener noreferrer">Google Maps</a><a href="https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fmobisautopecas.com.br" target="_blank" rel="noopener noreferrer">Compartilhar no Facebook</a></nav>
        <small>Condições de venda, entrega, garantia e privacidade: publicar somente os textos aprovados pela empresa.</small>
      </footer>}
      <ChatLojaWeb nome={loja.nome} whatsapp={loja.whatsapp} />
    </div>
  );
}
