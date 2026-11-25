import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { aplicacoesIrmas, lojaPorSlug, paginaAplicacao } from "@/lib/vitrine";
import { deveIndexarAplicacao, descricaoAplicacao, faixaAnos, montarJsonLdAplicacao, tituloAplicacao, veiculoRotulo } from "@/lib/ficha";
import type { ProdutoCodigo } from "@/lib/tipos";
import { ChatLojaWeb } from "@/components/ChatLojaWeb";

type Props = { params: Promise<{ slug: string; pagina: string }> };

const SLUG = /^[a-z0-9-]{2,120}$/;
const DATA = (s: string | null) => (s ? new Date(s).toLocaleDateString("pt-BR") : null);

/** Cor de referência por montadora (padrão): Hyundai=azul, Kia=vermelho. Sem dedução de compatibilidade — só rótulo visual. */
function montadora(texto: string): { nome: string; classe: string; cor: string } {
  const t = ` ${texto.toLowerCase()} `;
  if (/\b(kia|bongo|k2500|k2700|sportage|sorento|cerato|carnival)\b/.test(t)) return { nome: "Kia", classe: "kia", cor: "#e2181a" };
  if (/\b(mitsubishi|l200|pajero|triton)\b/.test(t)) return { nome: "Mitsubishi", classe: "", cor: "#e2181a" };
  if (/\b(hyundai|hr|galloper|h1|starex|h100|porter|terracan|tucson|santa|creta|ix35)\b/.test(t)) return { nome: "Hyundai", classe: "hyundai", cor: "#1877f2" };
  return { nome: "", classe: "", cor: "#e2181a" };
}

/** Componente da peça pelo que a FONTE do código afirma (sem inventar: só rotula o que está comprovado). */
function componente(c: ProdutoCodigo): { label: string; icon: "cabecote" | "bloco" } | null {
  const f = (c.fonte ?? "").toLowerCase();
  if (/cabe[cç]ote/.test(f)) return { label: "Cabeçote", icon: "cabecote" };
  if (/\bbloco\b/.test(f)) return { label: "Bloco", icon: "bloco" };
  return null;
}

async function carregar({ slug, pagina }: { slug: string; pagina: string }) {
  if (!SLUG.test(pagina)) return null;
  const loja = await lojaPorSlug(slug);
  if (!loja) return null;
  const pa = await paginaAplicacao(loja.id, pagina);
  if (!pa) return null;
  const irmas = await aplicacoesIrmas(loja.id, pa.produto.id);
  return { loja, pa, irmas };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const d = await carregar(await params);
  if (!d) return {};
  const base = d.loja.slug === "mobis" ? "https://mobisautopecas.com.br" : process.env.APP_URL ?? "http://localhost:3000";
  const url = `${base}/loja/${d.loja.slug}/aplicacao/${d.pa.aplicacao.pagina_slug}`;
  return {
    title: tituloAplicacao(d.pa),
    description: descricaoAplicacao(d.pa),
    alternates: { canonical: url },
    robots: deveIndexarAplicacao(d.pa) ? undefined : { index: false, follow: true },
  };
}

export default async function PaginaDeAplicacao({ params }: Props) {
  const d = await carregar(await params);
  if (!d) notFound();
  const { loja, pa, irmas } = d;
  const { aplicacao: a, produto, codigos } = pa;
  const oem = codigos.filter((c) => c.tipo === "oem" || c.tipo === "fabricante");
  const comComponente = oem.filter((c) => componente(c) !== null);
  const semComponente = oem.filter((c) => componente(c) === null);

  const base = loja.slug === "mobis" ? "https://mobisautopecas.com.br" : process.env.APP_URL ?? "http://localhost:3000";
  const url = `${base}/loja/${loja.slug}/aplicacao/${a.pagina_slug}`;
  const veiculo = veiculoRotulo(a);
  const mk = montadora(`${a.modelo} ${produto.nome ?? ""}`);
  const anos = faixaAnos(a) ?? "conforme homologação";
  const wa = loja.whatsapp
    ? `https://wa.me/${loja.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(
        `Olá! Tenho interesse na peça para ${veiculo}.\nReferência: ${produto.sku ?? "—"}\n${url}`,
      )}`
    : null;
  const jsonLd = montarJsonLdAplicacao({ pa, url });
  const indexavel = deveIndexarAplicacao(pa);

  return (
    <div className="mf">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />

      <header className="mf-head">
        <div className="mf-bar">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="mf-logo" src="/img/mobis/logo-mobis.png" alt="MOBIS Autopeças" height={44} />
          <span className="mf-haz-s mf-haz mf-cut" />
          <span className="mf-tag">Catálogo Conecta.IA</span>
        </div>
      </header>

      <div className="mf-wrap">
        <nav className="mf-nav">
          <a href={`/loja/${loja.slug}`}>{loja.nome}</a>
          {" › "}<a href={`/loja/${loja.slug}/produto/${produto.id}`}>{produto.sku}</a>
          {" › "}<span>{veiculo}</span>
        </nav>

        <section className="mf-hero">
          <div className="mf-chips">
            <span className="mf-chip sku"># {produto.sku ?? "—"}</span>
            {produto.marca && <span className="mf-chip">{produto.marca}</span>}
            {mk.nome && <span className="mf-chip" style={{ borderColor: mk.cor, color: mk.cor }}>{mk.nome}</span>}
          </div>
          {produto.categoria && <p className="mf-eyebrow">{produto.categoria}</p>}
          <h1 className="mf-title" style={{ fontFamily: "var(--mf-d)", fontWeight: 800, textTransform: "uppercase", letterSpacing: ".02em" }}>{tituloAplicacao(pa)}</h1>
          <p className="mf-sub">{veiculo}</p>
          <span className={`mf-status${indexavel ? " ok" : ""}`}>
            <span className="dot" />{indexavel ? "Aplicação homologada" : "Aplicação de referência — a homologar"}
          </span>
          {(a.pagina_descricao || descricaoAplicacao(pa)) && (
            <p className="mf-lead">{a.pagina_descricao || descricaoAplicacao(pa)}</p>
          )}
        </section>

        {pa.imagem && (
          <div className="mf-img">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={pa.imagem.url} alt={tituloAplicacao(pa)} />
            {pa.imagem.tipo !== "real" && <p className="cap">Imagem ilustrativa</p>}
          </div>
        )}

        {irmas.length > 0 && (
          <section className="mf-sec">
            <div className="mf-sech">
              <svg className="mf-ico" viewBox="0 0 24 24"><path d="M3 13h2l2-3h5l3 3h4v4h-2a2 2 0 0 1-4 0H9a2 2 0 0 1-4 0H3z" /><circle cx="7" cy="17" r="1.3" /><circle cx="17" cy="17" r="1.3" /></svg>
              <h2>Modelos que usam</h2><span className="rule" />
            </div>
            <div className="mf-models">
              {irmas.map((ir) => {
                const m = montadora(`${ir.modelo} ${ir.motorizacao ?? ""}`);
                const fa = [ir.ano_inicial, ir.ano_final].filter(Boolean).join("–");
                return (
                  <a key={ir.pagina_slug} className={`mf-model mf-cut ${m.classe}`} href={`/loja/${loja.slug}/aplicacao/${ir.pagina_slug}`}>
                    <span className="mf-brand">
                      <svg viewBox="0 0 24 24"><path d="M3 15V9l3-4h8l4 4h2a1 1 0 0 1 1 1v5" /><path d="M3 15h18" /><circle cx="7.5" cy="16.5" r="1.6" /><circle cx="16.5" cy="16.5" r="1.6" /></svg>
                    </span>
                    <span className="mt"><b>{m.nome ? `${m.nome} ${ir.modelo}` : ir.modelo}</b><span>{[ir.motorizacao, fa && `${fa}${ir.ano_final ? "" : "+"}`].filter(Boolean).join(" · ")}</span></span>
                    <span className="go">›</span>
                  </a>
                );
              })}
            </div>
          </section>
        )}

        <section className="mf-sec">
          <div className="mf-warn">
            <svg viewBox="0 0 24 24"><path d="M12 3 2 20h20L12 3z" /><path d="M12 10v5" /><circle cx="12" cy="17.5" r=".6" fill="currentColor" stroke="none" /></svg>
            <div>
              <b>Antes de comprar / montar</b>
              <p>Confirme sempre pelo <b>código gravado na peça/bloco</b> e pelo <b>VIN/chassi</b> do veículo antes de comprar ou montar. Peça errada = retrabalho e devolução. Em caso de dúvida, fale no WhatsApp.</p>
            </div>
          </div>
        </section>

        <section className="mf-sec">
          <div className="mf-sech">
            <svg className="mf-ico" viewBox="0 0 24 24"><path d="M4 7h3V4h4v3h3l3 3v4h2v3h-3" /><path d="M4 7v10h3v-3h7v3" /></svg>
            <h2>Ficha técnica</h2><span className="rule" />
          </div>
          <div className="mf-spec">
            <div className="mf-cell"><span className="mf-med"><svg viewBox="0 0 24 24"><path d="M3 15V9l3-4h8l4 4h2a1 1 0 0 1 1 1v5" /><path d="M3 15h18" /><circle cx="7.5" cy="16.5" r="1.6" /><circle cx="16.5" cy="16.5" r="1.6" /></svg></span><div><div className="mf-k">Modelo</div><div className="mf-v">{a.modelo}</div></div></div>
            {a.motorizacao && <div className="mf-cell"><span className="mf-med"><svg viewBox="0 0 24 24"><path d="M4 8h3l2-2h4l2 2h3v6h-3l-2 2H9l-2-2H4z" /></svg></span><div><div className="mf-k">Motorização</div><div className="mf-v">{a.motorizacao}</div></div></div>}
            <div className="mf-cell"><span className="mf-med"><svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="16" rx="2" /><path d="M8 3v4M16 3v4M4 11h16" /></svg></span><div><div className="mf-k">Anos</div><div className="mf-v">{anos}</div></div></div>
            {produto.marca && <div className="mf-cell"><span className="mf-med"><svg viewBox="0 0 24 24"><path d="M3 9l9-5 9 5-9 5z" /><path d="M3 9v6l9 5 9-5V9" /></svg></span><div><div className="mf-k">Marca</div><div className="mf-v">{produto.marca}</div></div></div>}
            <div className="mf-cell"><span className="mf-med"><svg viewBox="0 0 24 24"><path d="M9 4 7 20M17 4l-2 16M4 9h16M3 15h16" /></svg></span><div><div className="mf-k">Referência</div><div className="mf-v" style={{ fontFamily: "var(--font-mono)" }}>{produto.sku ?? "—"}</div></div></div>
          </div>
          {a.fonte && <p className="mf-nav" style={{ marginTop: 8 }}>Fonte da aplicação: {a.fonte}{DATA(a.coletado_em) ? ` · ${DATA(a.coletado_em)}` : ""}</p>}
        </section>

        {oem.length > 0 && (
          <section className="mf-sec">
            <div className="mf-sech">
              <svg className="mf-ico" viewBox="0 0 24 24"><path d="M9 4 7 20M17 4l-2 16M4 9h16M3 15h16" /></svg>
              <h2>Códigos OEM de referência</h2><span className="rule" />
            </div>
            <div className="mf-oemnote">
              <span className="b">A confirmar por VIN</span>
              {oem.length} código{oem.length > 1 ? "s" : ""} de referência de fábrica — confirmação item a item em EPC/VIN pendente.
            </div>
            {comComponente.length > 0 && (
              <div className="mf-models" style={{ marginBottom: 12 }}>
                {comComponente.map((c, i) => {
                  const comp = componente(c)!;
                  return (
                    <div key={i} className="mf-model mf-cut" style={{ cursor: "default" }}>
                      <span className="mf-brand">
                        {comp.icon === "cabecote"
                          ? <svg viewBox="0 0 24 24"><rect x="3" y="8" width="18" height="8" rx="1" /><path d="M6 8V6M10 8V6M14 8V6M18 8V6M7 12h.01M11 12h.01M15 12h.01" /></svg>
                          : <svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="14" rx="1" /><path d="M8 5v14M12 5v14M16 5v14" /></svg>}
                      </span>
                      <span className="mt"><b>{comp.label}</b><span style={{ fontFamily: "var(--font-mono)" }}>{c.valor}</span></span>
                    </div>
                  );
                })}
              </div>
            )}
            {semComponente.length > 0 && (
              <div className="mf-oemgrid">
                {semComponente.map((c, i) => <span key={i} className="mf-oem">{c.valor}</span>)}
              </div>
            )}
          </section>
        )}

        {wa && (
          <div className="mf-cta">
            <a className="mf-wa mf-cut" href={wa} target="_blank" rel="noopener noreferrer">
              <svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 0 0-8.5 15.2L2 22l4.9-1.5A10 10 0 1 0 12 2zm0 2a8 8 0 0 1 0 16 8 8 0 0 1-4.1-1.1l-.3-.2-2.4.7.7-2.3-.2-.3A8 8 0 0 1 12 4zm4.3 10.1c-.2-.1-1.3-.7-1.5-.8s-.4-.1-.5.1-.6.8-.7.9-.3.2-.5.1a6.5 6.5 0 0 1-3.2-2.8c-.2-.4.2-.4.6-1.2a.5.5 0 0 0 0-.5c0-.1-.5-1.3-.7-1.8s-.4-.4-.5-.4h-.5a.9.9 0 0 0-.7.3 2.8 2.8 0 0 0-.9 2.1 4.9 4.9 0 0 0 1 2.6 11 11 0 0 0 4.3 3.8c1.6.6 1.9.5 2.3.5a2.4 2.4 0 0 0 1.6-1.1 2 2 0 0 0 .1-1.1c0-.1-.2-.2-.4-.3z" /></svg>
            Tirar dúvida no WhatsApp
            </a>
            <span className="mf-ctanote">Sem preço no catálogo — consulte disponibilidade e aplicação.</span>
          </div>
        )}

        <p className="mf-foot">Catálogo informativo · sem preço · informações com fonte e data.<br />Loja operada pelo <b style={{ color: "var(--mf-fg)" }}>Conecta.IA</b> — sistema operacional de catálogo.</p>
      </div>

      <ChatLojaWeb nome={loja.nome} whatsapp={loja.whatsapp} produto={{ nome: tituloAplicacao(pa), sku: produto.sku ?? "" }} />
    </div>
  );
}
