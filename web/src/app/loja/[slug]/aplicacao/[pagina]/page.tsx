import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { lojaPorSlug, paginaAplicacao } from "@/lib/vitrine";
import { deveIndexarAplicacao, descricaoAplicacao, montarJsonLdAplicacao, tituloAplicacao, veiculoRotulo } from "@/lib/ficha";
import { ChatLojaWeb } from "@/components/ChatLojaWeb";

type Props = { params: Promise<{ slug: string; pagina: string }> };

const SLUG = /^[a-z0-9-]{2,120}$/;
const DATA = (s: string | null) => (s ? new Date(s).toLocaleDateString("pt-BR") : null);

async function carregar({ slug, pagina }: { slug: string; pagina: string }) {
  if (!SLUG.test(pagina)) return null;
  const loja = await lojaPorSlug(slug);
  if (!loja) return null;
  const pa = await paginaAplicacao(loja.id, pagina);
  return pa ? { loja, pa } : null;
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
  const { loja, pa } = d;
  const { aplicacao: a, produto, codigos } = pa;
  const oem = codigos.filter((c) => c.tipo === "oem" || c.tipo === "fabricante");

  const base = loja.slug === "mobis" ? "https://mobisautopecas.com.br" : process.env.APP_URL ?? "http://localhost:3000";
  const url = `${base}/loja/${loja.slug}/aplicacao/${a.pagina_slug}`;
  const veiculo = veiculoRotulo(a);
  const wa = loja.whatsapp
    ? `https://wa.me/${loja.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(
        `Olá! Tenho interesse na peça para ${veiculo}.\nReferência: ${produto.sku ?? "—"}\n${url}`,
      )}`
    : null;
  const jsonLd = montarJsonLdAplicacao({ pa, url });

  return (
    <article className="mx-auto max-w-4xl space-y-4 p-4 sm:p-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />

      <nav className="text-xs text-suave">
        <a href={`/loja/${loja.slug}`} className="hover:underline">{loja.nome}</a>
        {" › "}<a href={`/loja/${loja.slug}/produto/${produto.id}`} className="hover:underline">{produto.sku}</a>
        {" › "}<span>{veiculo}</span>
      </nav>

      <header className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-wide text-suave">{deveIndexarAplicacao(pa) ? "Aplicação homologada" : "Aplicação de referência (a homologar)"}</p>
        <h1 className="text-2xl font-semibold text-balance">{tituloAplicacao(pa)}</h1>
        {a.pagina_descricao && <p className="text-suave">{a.pagina_descricao}</p>}
      </header>

      {pa.imagem && (
        <div className="overflow-hidden rounded-xl border border-borda bg-white p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={pa.imagem.url} alt={tituloAplicacao(pa)} className="mx-auto max-h-80 w-full object-contain" />
          {pa.imagem.tipo !== "real" && <p className="mt-2 text-center text-xs text-suave">Imagem ilustrativa</p>}
        </div>
      )}

      {/* Veículo desta página */}
      <section className="overflow-hidden rounded-xl border border-borda bg-card">
        <header className="border-b border-borda px-4 py-3"><h2 className="text-base font-semibold">Veículo</h2></header>
        <div className="grid gap-x-6 gap-y-2.5 p-4 sm:grid-cols-2">
          <div className="flex justify-between gap-3 border-b border-dotted border-borda pb-1.5"><span className="text-sm text-suave">Modelo</span><span className="font-medium">{a.modelo}</span></div>
          {a.motorizacao && <div className="flex justify-between gap-3 border-b border-dotted border-borda pb-1.5"><span className="text-sm text-suave">Motorização</span><span className="font-medium">{a.motorizacao}</span></div>}
          <div className="flex justify-between gap-3 border-b border-dotted border-borda pb-1.5"><span className="text-sm text-suave">Anos</span><span className="font-medium">{[a.ano_inicial, a.ano_final].filter(Boolean).join("–") || "conforme homologação"}</span></div>
          {a.fonte && <div className="flex justify-between gap-3 border-b border-dotted border-borda pb-1.5"><span className="text-sm text-suave">Fonte</span><span className="text-sm text-suave">{a.fonte}{DATA(a.coletado_em) ? ` · ${DATA(a.coletado_em)}` : ""}</span></div>}
        </div>
      </section>

      {/* Peça física (mesmo SKU, mesmo estoque no Bling) */}
      <section className="overflow-hidden rounded-xl border border-borda bg-card">
        <header className="border-b border-borda px-4 py-3"><h2 className="text-base font-semibold">Peça</h2></header>
        <div className="grid gap-x-6 gap-y-2.5 p-4 sm:grid-cols-2">
          <div className="flex justify-between gap-3 border-b border-dotted border-borda pb-1.5"><span className="text-sm text-suave">Produto</span><span className="font-medium">{produto.nome}</span></div>
          <div className="flex justify-between gap-3 border-b border-dotted border-borda pb-1.5"><span className="text-sm text-suave">SKU</span><span className="font-mono text-sm">{produto.sku ?? "—"}</span></div>
          {produto.marca && <div className="flex justify-between gap-3 border-b border-dotted border-borda pb-1.5"><span className="text-sm text-suave">Marca</span><span className="font-medium">{produto.marca}</span></div>}
          <div className="flex justify-between gap-3 border-b border-dotted border-borda pb-1.5"><span className="text-sm text-suave">Preço</span><span className="text-suave">sob consulta</span></div>
        </div>
      </section>

      {/* OEM aprovados */}
      {oem.length > 0 && (
        <section className="overflow-hidden rounded-xl border border-borda bg-card">
          <header className="border-b border-borda px-4 py-3"><h2 className="text-base font-semibold">Códigos OEM de referência</h2></header>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[360px] text-sm">
              <thead><tr className="text-left text-xs uppercase tracking-wide text-suave"><th className="px-4 py-2">Tipo</th><th className="px-4 py-2">Código</th><th className="px-4 py-2">Fonte</th></tr></thead>
              <tbody>
                {oem.map((c, i) => (
                  <tr key={i} className="border-t border-borda">
                    <td className="px-4 py-2 uppercase">{c.tipo}</td>
                    <td className="px-4 py-2 font-mono">{c.valor}</td>
                    <td className="px-4 py-2 text-suave">{c.fonte ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {wa && (
        <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-block rounded-lg bg-ok px-5 py-3 font-medium text-white">
          Consultar esta peça no WhatsApp
        </a>
      )}

      <p className="text-center text-xs text-suave">
        Página por aplicação · mesmo SKU e estoque único no Bling · catálogo informativo sem preço.
      </p>

      <ChatLojaWeb nome={loja.nome} whatsapp={loja.whatsapp} produto={{ nome: tituloAplicacao(pa), sku: produto.sku ?? "" }} />
    </article>
  );
}
