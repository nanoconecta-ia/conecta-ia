import { useEffect, useState } from "react";
import { supabase } from "../supabase.ts";
import type { Loja } from "../lib/dados.ts";

type Item = { id: string; campo: string; valor: unknown; fonte: string | null; confianca: number | null; produtos: { sku: string | null; nome: string | null } | null };

const texto = (v: unknown) => (typeof v === "string" ? v : JSON.stringify(v));

/** Fila de aprovação: tudo que o agente propôs fica "a confirmar" até você decidir. */
export function Fila({ loja }: { loja: Loja }) {
  const [itens, setItens] = useState<Item[] | null>(null);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState("");
  const carregar = () =>
    supabase.from("produto_enriquecimento").select("id, campo, valor, fonte, confianca, produtos(sku, nome)")
      .eq("loja_id", loja.id).eq("status", "a_confirmar").order("criado_em", { ascending: false }).limit(200)
      .then(({ data }) => setItens((data ?? []) as unknown as Item[]));
  useEffect(() => { void carregar(); }, [loja.id]);

  async function decidir(id: string, decisao: "aprovar" | "rejeitar") {
    setOcupado(id); setErro("");
    const { error } = await supabase.functions.invoke("assistente", { body: { loja_id: loja.id, acao: "decidir", id, decisao } });
    setOcupado("");
    if (error) setErro("Não foi possível registrar a decisão."); else void carregar();
  }
  return (
    <div className="cartao">
      <h1>Fila de aprovação</h1>
      <p className="suave">Cada dado mostra de onde veio e com que confiança. Nada vai para o site nem para o Bling sem a sua decisão.</p>
      {erro && <p className="msg-erro">{erro}</p>}
      {itens === null ? <p className="suave">Carregando…</p> : itens.length === 0 ? <p className="suave">Nada aguardando aprovação.</p> : (
        <div className="rolagem"><table>
          <thead><tr><th>Produto</th><th>Campo</th><th>Valor proposto</th><th>Fonte</th><th>Conf.</th><th /></tr></thead>
          <tbody>{itens.map((i) => (
            <tr key={i.id}>
              <td><span className="mono">{i.produtos?.sku ?? "sem SKU"}</span><br /><span className="suave">{i.produtos?.nome}</span></td>
              <td>{i.campo}</td><td>{texto(i.valor)}</td>
              <td className="suave mono">{i.fonte ?? "—"}</td><td>{i.confianca != null ? `${Math.round(i.confianca * 100)}%` : "—"}</td>
              <td className="linha">
                <button disabled={ocupado === i.id || !i.fonte} onClick={() => void decidir(i.id, "aprovar")}>Aprovar</button>
                <button className="perigo" disabled={ocupado === i.id} onClick={() => void decidir(i.id, "rejeitar")}>Rejeitar</button>
              </td>
            </tr>))}</tbody>
        </table></div>
      )}
    </div>
  );
}
