import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { linkWhatsapp, lojaPorSlug, produtoPublico } from "@/lib/vitrine";
import { deveIndexar, faixaAnos, montarJsonLdProduto, precoPublicoAutorizado } from "@/lib/ficha";
import { ChatLojaWeb } from "@/components/ChatLojaWeb";

type Props = { params: Promise<{ slug: string; id: string }> };

const UUID = /^[0-9a-f-]{36}$/i;
const DATA = (s: string | null) => (s ? new Date(s).toLocaleDateString("pt-BR") : null);

async function carregar({ slug, id }: { slug: string; id: string }) {
  if (!UUID.test(id)) return null;
  const loja = await lojaPorSlug(slug);
  if (!loja) return null;
  const item = await produtoPublico(loja.id, id);
  return item ? { loja, ...item } : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const d = await carregar(await params);
  if (!d) return {};
  // Catálogo informativo sem aplicação confirmada é incerto → noindex (regra mestra).
  const indexar = deveIndexar({
    precoAutorizado: precoPublicoAutorizado(d.loja),
    aplicacoesAprovadas: d.aplicacoes.length,
  });
  return {
    title: d.produto.nome ?? "Produto",
    description: d.produto.descricao?.slice(0, 155) ?? undefined,
    robots: indexar ? undefined : { index: false, follow: true },
  };
}

function Selo({ tom, children }: { tom: "ok" | "atencao" | "neutro"; children: React.ReactNode }) {
  const cor =
    tom === "ok" ? "text-ok border-ok/40 bg-ok/10"
    : tom === "atencao" ? "text-atencao border-atencao/40 bg-atencao/10"
    : "text-suave border-borda bg-card";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${cor}`}>
      <span className="size-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}

function Campo({ k, v, vazio = false }: { k: string; v: React.ReactNode; vazio?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-dotted border-borda pb-1.5">
      <span className="text-sm text-suave">{k}</span>
      <span className={`min-w-0 break-words text-right font-medium ${vazio ? "italic text-suave" : ""}`}>{v}</span>
    </div>
  );
}

export default async function PaginaProduto({ params }: Props) {
  const d = await carregar(await params);
  if (!d) notFound();
  const { loja, produto, imagens, codigos, aplicacoes } = d;

  const principal = imagens.find((i) => i.principal) ?? imagens[0];
  const precoAutorizado = precoPublicoAutorizado(loja);
  const oemCodigos = codigos.filter((c) => c.tipo === "oem" || c.tipo === "fabricante");

  const base = loja.slug === "mobis" ? "https://mobisautopecas.com.br" : process.env.APP_URL ?? "http://localhost:3000";
  const url = `${base}/loja/${loja.slug}/produto/${produto.id}`;
  const wa = linkWhatsapp(loja, produto, url);
  // Dados estruturados com os mesmos valores exibidos (sem preço no catálogo informativo).
  const jsonLd = montarJsonLdProduto({ produto, url, imagemUrl: principal?.url, precoAutorizado });

  return (
    <article className="mx-auto max-w-4xl space-y-4 p-4 sm:p-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />

      {/* Herói */}
      <div className="grid gap-5 md:grid-cols-[280px_1fr]">
        <div className="aspect-square overflow-hidden rounded-xl border border-borda bg-card p-4">
          {principal ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={principal.url} alt={produto.nome ?? ""} className="size-full object-contain" />
          ) : (
            <div className="grid size-full place-items-center rounded-lg border border-dashed border-borda text-center text-sm text-suave">
              <span><b className="block font-semibold text-texto">Foto pendente</b>sem imagem no Bling</span>
            </div>
          )}
        </div>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Selo tom="ok">Fonte: Bling</Selo>
            {produto.sku && <Selo tom="neutro">SKU {produto.sku}</Selo>}
            {produto.situacao === "A" && <Selo tom="neutro">Ativo</Selo>}
          </div>
          <h1 className="text-2xl font-semibold text-balance">{produto.nome}</h1>
          <div className="flex flex-wrap gap-2 pt-1">
            {produto.marca && <div className="rounded-lg border border-borda bg-card px-3 py-2"><div className="text-[0.65rem] uppercase tracking-wide text-suave">Marca</div><div className="font-semibold">{produto.marca}</div></div>}
            {produto.categoria && <div className="rounded-lg border border-borda bg-card px-3 py-2"><div className="text-[0.65rem] uppercase tracking-wide text-suave">Categoria</div><div className="font-semibold">{produto.categoria}</div></div>}
            <div className="rounded-lg border border-borda bg-card px-3 py-2"><div className="text-[0.65rem] uppercase tracking-wide text-suave">Preço público</div><div className="font-semibold text-suave">não exibido</div></div>
          </div>
          {wa && (
            <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-block rounded-lg bg-ok px-5 py-3 font-medium text-white">
              Consultar no WhatsApp
            </a>
          )}
        </div>
      </div>

      {/* Confirmado — Bling */}
      <section className="overflow-hidden rounded-xl border border-borda bg-card">
        <header className="flex items-center justify-between gap-2 border-b border-borda px-4 py-3">
          <h2 className="flex items-center gap-2 text-base font-semibold"><Selo tom="ok">Confirmado</Selo> Dados do Bling</h2>
        </header>
        <div className="grid gap-x-6 gap-y-2.5 p-4 sm:grid-cols-2">
          <Campo k="SKU / código" v={<span className="font-mono text-sm">{produto.sku ?? "—"}</span>} />
          <Campo k="Situação" v={produto.situacao === "A" ? "Ativo" : (produto.situacao ?? "—")} />
          <Campo k="Marca" v={produto.marca ?? "—"} />
          <Campo k="Categoria" v={produto.categoria ?? "—"} />
          <Campo k="Estoque" v={produto.estoque ?? "—"} />
          <Campo k="GTIN / EAN" v={produto.gtin || "vazio — não inventar"} vazio={!produto.gtin} />
        </div>
        {produto.descricao && <p className="whitespace-pre-line border-t border-borda px-4 py-3 text-sm text-suave">{produto.descricao}</p>}
      </section>

      {/* OEM aprovados */}
      <section className="overflow-hidden rounded-xl border border-borda bg-card">
        <header className="flex items-center justify-between gap-2 border-b border-borda px-4 py-3">
          <h2 className="text-base font-semibold">Índice OEM / rastreabilidade</h2>
          <Selo tom={oemCodigos.length ? "ok" : "atencao"}>{oemCodigos.length ? `${oemCodigos.length} aprovados` : "em validação"}</Selo>
        </header>
        {oemCodigos.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead><tr className="text-left text-xs uppercase tracking-wide text-suave">
                <th className="px-4 py-2">Tipo</th><th className="px-4 py-2">Código</th><th className="px-4 py-2">Fonte</th><th className="px-4 py-2">Confirmado em</th>
              </tr></thead>
              <tbody>
                {oemCodigos.map((c, i) => (
                  <tr key={i} className="border-t border-borda">
                    <td className="px-4 py-2 uppercase">{c.tipo}</td>
                    <td className="px-4 py-2 font-mono">{c.valor}</td>
                    <td className="px-4 py-2 text-suave">{c.fonte ?? "—"}</td>
                    <td className="px-4 py-2 text-suave">{DATA(c.coletado_em) ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-4 py-4 text-sm text-suave">
            Nenhum código OEM <b>aprovado</b> para este produto ainda. Compatibilidade incerta não é anunciada:
            os códigos só aparecem após validação com fonte e data (EPC/montadora).
          </p>
        )}
      </section>

      {/* Aplicações aprovadas */}
      <section className="overflow-hidden rounded-xl border border-borda bg-card">
        <header className="flex items-center justify-between gap-2 border-b border-borda px-4 py-3">
          <h2 className="text-base font-semibold">Aplicações veiculares</h2>
          <Selo tom={aplicacoes.length ? "ok" : "atencao"}>{aplicacoes.length ? `${aplicacoes.length} homologadas` : "em validação"}</Selo>
        </header>
        {aplicacoes.length ? (
          <ul className="divide-y divide-borda">
            {aplicacoes.map((a, i) => (
              <li key={i} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3">
                <span className="font-medium">{a.modelo}{a.motorizacao ? ` · ${a.motorizacao}` : ""}{faixaAnos(a) ? ` · ${faixaAnos(a)}` : ""}</span>
                <span className="text-xs text-suave">{a.fonte ?? "fonte registrada"}{DATA(a.coletado_em) ? ` · ${DATA(a.coletado_em)}` : ""}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-4 py-4 text-sm text-suave">
            Aplicações <b>em validação</b>. Compatibilidade nunca é deduzida pelo nome do produto;
            só entra aqui com relação técnica, fonte e data.
          </p>
        )}
      </section>

      <p className="text-center text-xs text-suave">
        Catálogo informativo · preço e disponibilidade sob consulta no WhatsApp · sem escrita no Bling.
      </p>

      <ChatLojaWeb nome={loja.nome} whatsapp={loja.whatsapp} produto={{ nome: produto.nome ?? "Peça automotiva", sku: produto.sku ?? "" }} />
    </article>
  );
}
