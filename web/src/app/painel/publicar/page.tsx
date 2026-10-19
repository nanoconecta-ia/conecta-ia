import { Cartao, Selo, Vazio } from "@/components/ui";
import { CartaoProduto } from "@/components/CartaoProduto";
import { produtosComImagens } from "@/lib/dados";
import { avaliarPublicacao, brl, prontoParaPublicar } from "@/lib/publicacao";
import { exigirLojista } from "@/lib/sessao";

export const metadata = { title: "Antes de publicar" };

/** Meio do caminho: à esquerda o que vem do Bling, à direita como o produto aparece no site. */
export default async function AntesDePublicar() {
  const { supabase, loja } = await exigirLojista();
  if (!loja) return null;
  const produtos = await produtosComImagens(supabase, loja.id, { publicado: false, limite: 30 });
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold sm:text-2xl">Antes de publicar</h1>
      <p className="text-sm text-suave">
        Veja o produto como vem do Bling e como ficará no site. O que falta aparece marcado; o Conecta.IA nunca preenche dado sem evidência.
      </p>
      {produtos.length === 0 ? (
        <Vazio titulo="Nada aguardando publicação" />
      ) : (
        <div className="space-y-5">
          {produtos.map((p) => {
            const ex = avaliarPublicacao(p, p.imagens);
            return (
              <article key={p.id} className="grid gap-3 lg:grid-cols-2">
                <Cartao titulo="No Bling (origem)">
                  <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                    {[
                      ["Nome", p.nome], ["SKU", p.sku], ["Preço", brl(p.preco)], ["Estoque", p.estoque],
                      ["Categoria", p.categoria], ["Marca", p.marca], ["GTIN", p.gtin],
                    ].map(([k, v]) => (
                      <div key={String(k)} className="contents">
                        <dt className="text-suave">{k}</dt>
                        <dd className="font-mono text-xs leading-6">{v === null || v === "" ? "—" : String(v)}</dd>
                      </div>
                    ))}
                  </dl>
                  <ul className="mt-4 space-y-1">
                    {ex.map((e) => (
                      <li key={e.chave}><Selo tom={e.ok ? "ok" : "erro"}>{e.rotulo}{e.ok ? "" : " — falta"}</Selo></li>
                    ))}
                  </ul>
                  <p className="mt-3 text-sm">{prontoParaPublicar(ex) ? "Pronto para publicar." : "Incompleto: não será publicado."}</p>
                </Cartao>
                <Cartao titulo="Como fica no site">
                  <div className="max-w-xs"><CartaoProduto produto={p} imagens={p.imagens} href={null} /></div>
                </Cartao>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
