import type { BannerOferta as Banner, LojaPublica } from "@/lib/vitrine";
import { linkWhatsappBanner } from "@/lib/vitrine";

const brl = (v: number | null) => (v == null ? null : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));

/** Banner de oferta. `flash` (produto de Motor no modo automático, ou escolhido pelo lojista) liga o destaque animado; respeita movimento reduzido. */
export function BannerOferta({ loja, banner }: { loja: LojaPublica; banner: Banner }) {
  const href = `/loja/${loja.slug}/produto/${banner.produto_id}`;
  const wa = linkWhatsappBanner(loja, banner, href);
  const preco = brl(banner.preco);
  return (
    <article className={`banner-oferta ${banner.flash ? "banner-flash" : ""}`} aria-label={`Oferta: ${banner.nome}`}>
      {banner.flash && <span className="banner-etiqueta">Oferta relâmpago</span>}
      <div className="banner-texto">
        <h2>{banner.nome}</h2>
        {banner.chamada && <p>{banner.chamada}</p>}
        {preco && <p className="banner-preco">{preco}</p>}
      </div>
      <div className="banner-acoes">
        <a href={href} className="banner-ver">Ver produto</a>
        {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="banner-wa">Falar com o vendedor</a>}
      </div>
    </article>
  );
}
