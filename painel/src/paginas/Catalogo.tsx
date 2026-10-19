import { useCallback, useEffect, useState } from "react";
import { supabase } from "../supabase.ts";
import type { Loja } from "../lib/dados.ts";
import { mensagemVisibilidade, type RespostaVisibilidade } from "../lib/visibilidade.ts";

type Produto = { id: string; sku: string | null; nome: string | null; preco: number | null; estoque: number | null; publicado: boolean };
const brl = (v: number | null) => (v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));

export function Catalogo({ loja }: { loja: Loja }) {
  const [itens, setItens] = useState<Produto[] | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const carregar = useCallback(() => supabase.from("produtos").select("id, sku, nome, preco, estoque, publicado").eq("loja_id", loja.id).order("nome").limit(100)
    .then(({ data }) => setItens((data ?? []) as Produto[])), [loja.id]);
  useEffect(() => { void carregar(); }, [carregar]);

  async function alterar(p: Produto, publicar: boolean) {
    setOcupado(p.id); setMsg(null);
    const { data, error } = await supabase.rpc("produto_visibilidade", { p_produto: p.id, p_publicar: publicar });
    setOcupado(null);
    if (error) setMsg({ ok: false, texto: error.code === "42501" ? "Só o lojista da loja pode mostrar ou ocultar produtos." : "Não foi possível atualizar o produto." });
    else { setMsg(mensagemVisibilidade(data as RespostaVisibilidade, publicar)); void carregar(); }
  }

  return (
    <div className="cartao">
      <h1>Catálogo</h1>
      <p className="suave">Espelho somente leitura do Bling: o cadastro vem do ERP e não é editado aqui. O produto só aparece na loja quando você clica em <strong>Mostrar no site</strong>, e pode ocultá-lo quando quiser. Produto incompleto não pode ser mostrado.</p>
      {msg && <p className={msg.ok ? "msg-ok" : "msg-erro"} role="status">{msg.texto}</p>}
      {itens === null ? <p className="suave">Carregando…</p> : itens.length === 0 ? <p className="suave">Nenhum produto sincronizado ainda. Conecte o Bling.</p> : (
        <div className="rolagem">
          <table>
            <thead><tr><th>SKU</th><th>Nome</th><th>Preço</th><th>Estoque</th><th>Site</th></tr></thead>
            <tbody>{itens.map((p) => (
              <tr key={p.id}><td>{p.sku ?? "—"}</td><td>{p.nome ?? "—"}</td><td>{brl(p.preco)}</td><td>{p.estoque ?? "—"}</td>
                <td>
                  <span className={`selo ${p.publicado ? "ok" : "atencao"}`}>{p.publicado ? "visível" : "oculto"}</span>{" "}
                  {p.publicado
                    ? <button className="sec" disabled={ocupado === p.id} onClick={() => void alterar(p, false)}>Ocultar do site</button>
                    : <button disabled={ocupado === p.id} onClick={() => void alterar(p, true)}>Mostrar no site</button>}
                </td></tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
