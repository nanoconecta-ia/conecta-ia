import { useEffect, useState } from "react";

/** Somente ofertas devolvidas pela API pública (produtos publicados + período válido).
 * Flash = destaque visual discreto; não usa Flash Player e respeita redução de movimento.
 */
export type OfertaPublica = {
  sku: string; nome: string; preco: number | null; chamada: string | null;
  flash: boolean; whatsapp: string | null; url: string | null;
};
const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function BannersFlashLoja({ ofertas, slug, teste }: { ofertas: OfertaPublica[]; slug: string; teste: boolean }) {
  const [atual, setAtual] = useState(0);
  const [pausado, setPausado] = useState(false);
  useEffect(() => { setAtual(0); }, [slug, ofertas[0]?.sku]);
  useEffect(() => {
    if (ofertas.length < 2 || pausado || typeof window === "undefined" ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = window.setInterval(() => {
      if (!document.hidden) setAtual((n) => (n + 1) % ofertas.length);
    }, 6500);
    return () => window.clearInterval(t);
  }, [ofertas.length, pausado]);
  if (!ofertas.length) return null;
  const idx = Math.min(atual, ofertas.length - 1);
  const b = ofertas[idx];
  const proximo = (delta: number) => setAtual((idx + delta + ofertas.length) % ofertas.length);
  return (
    <section id="ofertas" className="v-ofertas-flash" aria-label="Banners de produtos publicados">
      <div className={"v-loja-oferta" + (b.flash ? " flash" : "")} data-tom={idx % 3} onMouseEnter={() => setPausado(true)}
        onMouseLeave={() => setPausado(false)} onFocusCapture={() => setPausado(true)} onBlurCapture={() => setPausado(false)}>
        <div className="v-oferta-conteudo">
          <span className="v-loja-selo">{teste ? "Demonstração do banner · Loja teste" : b.flash ? "Oferta em destaque" : "Seleção de peças"}</span>
          <h2>{b.nome}</h2>
          {b.chamada && <p>{b.chamada}</p>}
          {b.preco != null && <p className="v-loja-preco">{brl(b.preco)}</p>}
          <p className="v-oferta-nota">Confirme aplicação, disponibilidade, preço final e condições com a loja.</p>
        </div>
        <div className="v-loja-acoes">
          <a href={"#/p/" + encodeURIComponent(slug) + "/" + encodeURIComponent(b.sku)}>Detalhes da peça</a>
          {b.whatsapp && <a href={b.whatsapp} target="_blank" rel="noopener noreferrer">WhatsApp</a>}
        </div>
      </div>
      {ofertas.length > 1 && <div className="v-oferta-controles" role="group" aria-label="Navegar entre banners">
        <button type="button" onClick={() => proximo(-1)} aria-label="Banner anterior">‹</button>
        <span aria-live="off">{idx + 1} de {ofertas.length}</span>
        <button type="button" onClick={() => proximo(1)} aria-label="Próximo banner">›</button>
        <button type="button" onClick={() => setPausado((v) => !v)} aria-pressed={pausado}>{pausado ? "Reativar rotação" : "Pausar rotação"}</button>
      </div>}
    </section>
  );
}
