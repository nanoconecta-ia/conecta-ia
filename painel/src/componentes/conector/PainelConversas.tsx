import { useState } from "react";
import { Dialogo } from "../Dialogo.tsx";
import type { Conversa, DocumentoFonte, ProdutoResumo } from "../../lib/conectorDados.ts";
import { agruparPorProjeto } from "../../lib/historico.ts";

export function PainelConversas({ conversas, ativaId, documentos, emAnalise, aoNova, aoSelecionar, aoExcluir, aoRenomear, aoEscolherProduto, aoFechar }: {
  conversas: Conversa[] | null; ativaId: string | null; documentos: DocumentoFonte[]; emAnalise: ProdutoResumo[];
  aoNova: () => void; aoSelecionar: (id: string) => void; aoExcluir: (id: string) => Promise<void>; aoRenomear: (id: string, titulo: string) => Promise<void>;
  aoEscolherProduto: (id: string) => void; aoFechar: () => void;
}) {
  const [excluir, setExcluir] = useState<Conversa | null>(null);
  const [editando, setEditando] = useState<{ id: string; titulo: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const grupos = agruparPorProjeto(conversas ?? []);
  return (
    <aside className="painel-esq" aria-label="Conversas e fontes">
      <div className="linha" style={{ justifyContent: "space-between" }}>
        <button onClick={() => { aoNova(); aoFechar(); }} style={{ flex: 1 }}>+ Nova conversa</button>
        <button className="sec fechar-painel" onClick={aoFechar} aria-label="Fechar lista de conversas">✕</button>
      </div>
      <nav aria-label="Histórico de conversas" className="lista-conversas">
        {conversas === null ? <p className="suave">Carregando…</p> : conversas.length === 0 ? <p className="suave">Nenhuma conversa ainda. Escreva uma mensagem para começar.</p> : grupos.map((g) => (
          <details key={g.projeto ?? "_"} open>
            <summary>{g.projeto ?? "Conversas"}</summary>
            <ul>{g.itens.map((c) => (
              <li key={c.id} className={c.id === ativaId ? "ativa" : ""}>
                {editando?.id === c.id ? (
                  <form className="linha" style={{ maxWidth: "none" }} onSubmit={(e) => { e.preventDefault(); setOcupado(true); void aoRenomear(c.id, editando.titulo).finally(() => { setOcupado(false); setEditando(null); }); }}>
                    <input aria-label="Novo título" value={editando.titulo} maxLength={120} autoFocus onChange={(e) => setEditando({ id: c.id, titulo: e.target.value })} />
                    <button disabled={ocupado || !editando.titulo.trim()}>Salvar</button>
                  </form>
                ) : (
                  <>
                    <button className="conv-titulo" onClick={() => { aoSelecionar(c.id); aoFechar(); }} aria-current={c.id === ativaId ? "true" : undefined}>{c.titulo}</button>
                    <button className="sec mini" aria-label={`Renomear ${c.titulo}`} onClick={() => setEditando({ id: c.id, titulo: c.titulo })}>✎</button>
                    <button className="sec mini" aria-label={`Excluir ${c.titulo}`} onClick={() => setExcluir(c)}>🗑</button>
                  </>
                )}
              </li>))}
            </ul>
          </details>
        ))}
      </nav>
      <details className="bloco-lateral">
        <summary>Documentos e fontes</summary>
        {documentos.length === 0 ? <p className="suave">Nenhuma fonte cadastrada.</p> : (
          <ul className="fontes">{documentos.map((d) => <li key={d.id}>{/^https?:\/\//.test(d.fonte) ? <a href={d.fonte} target="_blank" rel="noreferrer noopener nofollow">{d.titulo}</a> : d.titulo}
            <span className="suave"> · {d.tipo}{d.fonte_versao ? ` · v${d.fonte_versao}` : ""}</span></li>)}</ul>)}
      </details>
      <details className="bloco-lateral">
        <summary>Produtos em análise</summary>
        {emAnalise.length === 0 ? <p className="suave">Nenhum produto com proposta pendente.</p> : (
          <ul className="fontes">{emAnalise.map((p) => <li key={p.id}><button className="sec mini-texto" onClick={() => { aoEscolherProduto(p.id); aoFechar(); }}><span className="mono">{p.sku ?? "sem SKU"}</span> {p.nome}</button></li>)}</ul>)}
      </details>
      <Dialogo aberto={!!excluir} titulo="Excluir conversa" perigo rotuloConfirmar="Excluir" ocupado={ocupado} aoCancelar={() => setExcluir(null)}
        aoConfirmar={() => { if (!excluir) return; setOcupado(true); void aoExcluir(excluir.id).finally(() => { setOcupado(false); setExcluir(null); }); }}>
        <p>Excluir <strong>{excluir?.titulo}</strong>? As mensagens desta conversa somem. Tarefas, propostas, aprovações e a auditoria <strong>permanecem</strong>.</p>
      </Dialogo>
    </aside>
  );
}
