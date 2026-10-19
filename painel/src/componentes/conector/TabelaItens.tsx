import { compararCampos, type ItemProposta } from "../../lib/propostas.ts";
import type { ProdutoResumo } from "../../lib/conectorDados.ts";
import { alvoOperacao, SeloItem, SeloRisco } from "./ui.tsx";

/** Comparação antes/depois por campo, com fontes e validações. Em tela estreita cada campo vira um cartão empilhado. */
export function TabelaItens({ itens, produtos, selecionados, aoAlternar, compacto }: {
  itens: ItemProposta[]; produtos: Record<string, ProdutoResumo>; selecionados?: Set<string>; aoAlternar?: (id: string) => void; compacto?: boolean;
}) {
  const lista = compacto ? itens.slice(0, 3) : itens;
  return (
    <div className="itens">
      {lista.map((i) => {
        const p = i.produto_id ? produtos[i.produto_id] : null;
        const aprovavel = i.estado === "pendente";
        return (
          <section key={i.id} className={`item-prop ${i.estado === "travado" ? "travado" : ""}`} aria-label={`Item ${i.ordem + 1}`}>
            <header className="linha" style={{ justifyContent: "space-between" }}>
              <div className="linha">
                {aoAlternar && (
                  <label className="marcar"><input type="checkbox" disabled={!aprovavel} checked={!!selecionados?.has(i.id)} onChange={() => aoAlternar(i.id)} />
                    <span className="sr">Incluir o item {i.ordem + 1} na aprovação</span></label>
                )}
                <strong>{p ? <><span className="mono">{p.sku ?? "sem SKU"}</span> · {p.nome}</> : i.alvo ?? "Sem produto"}</strong>
              </div>
              <div className="linha"><SeloItem estado={i.estado} /><SeloRisco risco={i.risco} /></div>
            </header>
            <p className="suave" style={{ margin: "2px 0 8px" }}>Operação prevista: <code>{i.operacao}</code> — {alvoOperacao(i.operacao)}</p>
            {i.estado === "travado" && <p className="aviso">Produto travado: isto é só uma sugestão e não pode ser aprovado. Destrave o produto e peça uma revisão para aplicá-la.</p>}
            <div className="comp" role="table" aria-label="Antes e depois">
              <div className="comp-cab" role="row"><span role="columnheader">Campo</span><span role="columnheader">Antes</span><span role="columnheader">Depois</span></div>
              {compararCampos(i.antes, i.depois, i.campos).map((l) => (
                <div key={l.campo} className={`comp-linha ${l.mudou ? "mudou" : ""}`} role="row">
                  <span role="cell" className="mono">{l.campo}</span>
                  <span role="cell" data-rotulo="Antes">{l.antes}</span>
                  <span role="cell" data-rotulo="Depois"><strong>{l.depois}</strong></span>
                </div>
              ))}
            </div>
            {!compacto && (
              <>
                <p className="suave" style={{ margin: "8px 0 2px" }}>Fontes consultadas:</p>
                <ul className="fontes">{i.fontes.map((f, k) => <li key={k}>{f.url ? <a href={f.url} target="_blank" rel="noreferrer noopener nofollow">{f.titulo ?? f.url}</a> : <span>{f.documento ?? "fonte sem identificação"}</span>}</li>)}</ul>
                {i.validacoes.length > 0 && (<>
                  <p className="suave" style={{ margin: "8px 0 2px" }}>Validações executadas:</p>
                  <ul className="fontes">{i.validacoes.map((v, k) => <li key={k}><span className={v.ok === false ? "msg-erro" : "msg-ok"}>{v.ok === false ? "✗" : "✓"}</span> {v.nome ?? "validação"}{v.detalhe ? ` — ${v.detalhe}` : ""}</li>)}</ul>
                </>)}
                {i.motivo && <p className="suave">Observação: {i.motivo}</p>}
              </>
            )}
          </section>
        );
      })}
      {compacto && itens.length > 3 && <p className="suave">+ {itens.length - 3} item(ns) — abra a Central de Inteligência para ver todos.</p>}
    </div>
  );
}
