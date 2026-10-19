import { useCallback, useEffect, useState } from "react";
import { supabase } from "../supabase.ts";
import type { Loja } from "../lib/dados.ts";
import { mensagemVisibilidade, type RespostaVisibilidade } from "../lib/visibilidade.ts";
import { alternar, alternarTodos, erroAutomacao, mensagemAutomacao, textoLote } from "../lib/automacao.ts";

type Produto = { id: string; sku: string | null; nome: string | null; preco: number | null; estoque: number | null; publicado: boolean };
const brl = (v: number | null) => (v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));

export function Catalogo({ loja }: { loja: Loja }) {
  const [itens, setItens] = useState<Produto[] | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [pausados, setPausados] = useState<Set<string>>(new Set());
  const carregar = useCallback(async () => {
    const { data } = await supabase.from("produtos").select("id, sku, nome, preco, estoque, publicado").eq("loja_id", loja.id).order("nome").limit(100);
    setItens((data ?? []) as Produto[]);
    const { data: pz } = await supabase.from("produto_automacao").select("produto_id").eq("loja_id", loja.id).eq("pausado", true);
    setPausados(new Set((pz ?? []).map((x: { produto_id: string }) => x.produto_id)));
  }, [loja.id]);
  useEffect(() => { void carregar(); }, [carregar]);

  async function alterar(p: Produto, publicar: boolean) {
    setOcupado(p.id); setMsg(null);
    const { data, error } = await supabase.rpc("produto_visibilidade", { p_produto: p.id, p_publicar: publicar });
    setOcupado(null);
    if (error) setMsg({ ok: false, texto: error.code === "42501" ? "Só o lojista da loja pode mostrar ou ocultar produtos." : "Não foi possível atualizar o produto." });
    else { setMsg(mensagemVisibilidade(data as RespostaVisibilidade, publicar)); void carregar(); }
  }

  async function automacao(pausar: boolean) {
    const ids = [...selecionados];
    if (ids.length === 0) return;
    setOcupado("lote"); setMsg(null);
    const { error } = await supabase.rpc("automacao_pausar", { p_produtos: ids, p_pausar: pausar, p_motivo: null });
    setOcupado(null);
    if (error) setMsg({ ok: false, texto: erroAutomacao(error.code, ids.length) });
    else { setMsg({ ok: true, texto: mensagemAutomacao(pausar, ids.length) }); setSelecionados(new Set()); void carregar(); }
  }
  const idsVisiveis = (itens ?? []).map((p) => p.id);

  return (
    <div className="cartao">
      <h1>Catálogo</h1>
      <p className="suave">Espelho somente leitura do Bling: o cadastro vem do ERP e não é editado aqui. O produto só aparece na loja quando você clica em <strong>Mostrar no site</strong>, e pode ocultá-lo quando quiser. Produto incompleto não pode ser mostrado.</p>
      <p className="suave">Para reforçar a qualidade do cadastro, marque um produto ou vários e use <strong>Parar cadastro automático</strong>: nenhum agente propõe dados neles até você retomar. O Bling continua sendo a fonte e nada é apagado.</p>
      {msg && <p className={msg.ok ? "msg-ok" : "msg-erro"} role="status">{msg.texto}</p>}
      {selecionados.size > 0 && (
        <div className="linha" role="group" aria-label="Ações para os produtos selecionados">
          <strong>{textoLote(selecionados.size)} selecionado(s)</strong>
          <button className="sec" disabled={ocupado === "lote"} onClick={() => void automacao(true)}>Parar cadastro automático</button>
          <button className="sec" disabled={ocupado === "lote"} onClick={() => void automacao(false)}>Retomar cadastro automático</button>
        </div>
      )}
      {itens === null ? <p className="suave">Carregando…</p> : itens.length === 0 ? <p className="suave">Nenhum produto sincronizado ainda. Conecte o Bling.</p> : (
        <div className="rolagem">
          <table>
            <thead><tr><th><input type="checkbox" aria-label="Selecionar todos" checked={idsVisiveis.length > 0 && idsVisiveis.every((i) => selecionados.has(i))} onChange={() => setSelecionados(alternarTodos(selecionados, idsVisiveis))} style={{ width: 20, minHeight: 20 }} /></th><th>SKU</th><th>Nome</th><th>Preço</th><th>Estoque</th><th>Site</th></tr></thead>
            <tbody>{itens.map((p) => (
              <tr key={p.id}><td><input type="checkbox" aria-label={`Selecionar ${p.sku ?? p.nome ?? "produto"}`} checked={selecionados.has(p.id)} onChange={() => setSelecionados(alternar(selecionados, p.id))} style={{ width: 20, minHeight: 20 }} /></td><td>{p.sku ?? "—"}</td><td>{p.nome ?? "—"}{pausados.has(p.id) && <>{" "}<span className="selo atencao">automação parada</span></>}</td><td>{brl(p.preco)}</td><td>{p.estoque ?? "—"}</td>
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
