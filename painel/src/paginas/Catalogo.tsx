import { useEffect, useState } from "react";
import { supabase } from "../supabase.ts";
import type { Loja } from "../lib/dados.ts";

type Produto = { id: string; sku: string | null; nome: string | null; preco: number | null; estoque: number | null; publicado: boolean };
const brl = (v: number | null) => (v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));

export function Catalogo({ loja }: { loja: Loja }) {
  const [itens, setItens] = useState<Produto[] | null>(null);
  useEffect(() => {
    supabase.from("produtos").select("id, sku, nome, preco, estoque, publicado").eq("loja_id", loja.id).order("nome").limit(100)
      .then(({ data }) => setItens((data ?? []) as Produto[]));
  }, [loja.id]);
  return (
    <div className="cartao">
      <h1>Catálogo</h1>
      <p className="suave">Espelho somente leitura do Bling. Nada aqui é editado: o cadastro vem do ERP.</p>
      {itens === null ? <p className="suave">Carregando…</p> : itens.length === 0 ? <p className="suave">Nenhum produto sincronizado ainda. Conecte o Bling.</p> : (
        <div className="rolagem">
          <table>
            <thead><tr><th>SKU</th><th>Nome</th><th>Preço</th><th>Estoque</th><th>Site</th></tr></thead>
            <tbody>{itens.map((p) => (
              <tr key={p.id}><td>{p.sku ?? "—"}</td><td>{p.nome ?? "—"}</td><td>{brl(p.preco)}</td><td>{p.estoque ?? "—"}</td>
                <td><span className={`selo ${p.publicado ? "ok" : "atencao"}`}>{p.publicado ? "publicado" : "não publicado"}</span></td></tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
