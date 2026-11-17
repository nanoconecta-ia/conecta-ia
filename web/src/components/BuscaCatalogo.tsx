"use client";

import { useMemo, useState } from "react";
import { CartaoProduto } from "@/components/CartaoProduto";
import type { Imagem, Produto } from "@/lib/tipos";

type Item = { produto: Produto; imagens: Imagem[] };

function normalizar(valor: string) {
  return valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim();
}

/** Busca local somente entre itens já autorizados pelo catálogo público do servidor. */
export function BuscaCatalogo({ itens, slug }: { itens: Item[]; slug: string }) {
  const [termo, setTermo] = useState("");
  const [categoria, setCategoria] = useState("");
  const categorias = useMemo(() => Array.from(new Set(itens.map(({ produto }) => produto.categoria?.trim()).filter((x): x is string => Boolean(x)))).sort((a, b) => a.localeCompare(b, "pt-BR")), [itens]);
  const resultados = useMemo(() => itens.filter(({ produto }) => {
    if (categoria && produto.categoria !== categoria) return false;
    const alvo = normalizar([produto.nome, produto.sku, produto.marca, produto.categoria, produto.gtin].filter(Boolean).join(" "));
    return !normalizar(termo) || alvo.includes(normalizar(termo));
  }), [itens, termo, categoria]);

  return (
    <section aria-label="Catálogo de produtos publicados" className="space-y-5">
      <div className="rounded-2xl border border-borda bg-card p-4 shadow-sm sm:p-5">
        <h2 className="mb-3 text-lg font-semibold">Encontre a peça certa</h2>
        <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto]">
          <label className="block text-sm font-medium">
            Peça, SKU, marca ou GTIN
            <input type="search" value={termo} onChange={(e) => setTermo(e.target.value)}
              placeholder="Digite o nome ou código da peça" autoComplete="off"
              className="mt-1 w-full rounded-lg border border-borda bg-white p-3 text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-700" />
          </label>
          <label className="block text-sm font-medium">
            Categoria
            <select value={categoria} onChange={(e) => setCategoria(e.target.value)}
              className="mt-1 w-full rounded-lg border border-borda bg-white p-3 text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-700">
              <option value="">Todas as categorias</option>
              {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <button type="button" onClick={() => { setTermo(""); setCategoria(""); }}
            className="self-end rounded-lg border border-borda px-4 py-3 text-sm font-medium hover:bg-slate-100">
            Limpar filtros
          </button>
        </div>
        <p role="status" aria-live="polite" className="mt-3 text-sm text-suave">
          {resultados.length} {resultados.length === 1 ? "produto publicado encontrado" : "produtos publicados encontrados"}
        </p>
        <p className="mt-1 text-xs text-suave">A busca considera apenas os produtos publicados carregados nesta página. Compatibilidade por veículo e OEM dependem de validação técnica e não são inferidas aqui.</p>
      </div>
      {resultados.length ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
          {resultados.map(({ produto, imagens }) => (
            <li key={produto.id}>
              <CartaoProduto produto={produto} imagens={imagens} href={`/loja/${slug}/produto/${produto.id}`} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-xl border border-borda p-6 text-center text-sm text-suave">
          Nenhum anúncio publicado corresponde aos filtros. Isso não significa falta de estoque na loja física.
        </div>
      )}
    </section>
  );
}
