import { useEffect, useState } from "react";
import type { FonteDados, ProdutoResumo } from "../../lib/conectorDados.ts";
import { prazo, type ItemProposta, type Operacao, type Proposta } from "../../lib/propostas.ts";
import { DecisaoProposta } from "./DecisaoProposta.tsx";
import { TabelaItens } from "./TabelaItens.tsx";
import { hashCurto, SeloProposta, SeloRisco } from "./ui.tsx";
import { CENTRAL_ATIVA } from "../../lib/flags.ts";

/** Cartão de aprovação dentro do chat: mostra o antes/depois lido do banco (não do texto do modelo) e permite decidir. */
export function CartaoProposta({ propostaId, fonte, lojaId }: { propostaId: string; fonte: FonteDados; lojaId: string }) {
  const [d, setD] = useState<{ proposta: Proposta; itens: ItemProposta[]; operacoes: Operacao[]; produtos: Record<string, ProdutoResumo> } | null | undefined>(undefined);
  const [msg, setMsg] = useState("");
  const carregar = () => { void fonte.proposta(propostaId).then(setD).catch(() => setD(null)); };
  useEffect(carregar, [propostaId]);
  if (d === undefined) return <div className="cartao-ia"><p className="suave">Carregando proposta…</p></div>;
  if (d === null) return <div className="cartao-ia"><p className="msg-erro">Não foi possível ler a proposta no banco (ela pode ainda não estar disponível neste ambiente).</p></div>;
  const { proposta, itens, produtos } = d;
  return (
    <article className="cartao-ia" aria-label={`Proposta: ${proposta.titulo}`}>
      <header className="linha" style={{ justifyContent: "space-between" }}>
        <strong>{proposta.titulo}</strong>
        <span className="linha"><SeloProposta estado={proposta.estado} /><SeloRisco risco={proposta.risco} /></span>
      </header>
      <p className="suave" style={{ margin: "2px 0 8px" }}>Versão {proposta.versao} · código <code>{hashCurto(proposta.hash)}</code> · {prazo(proposta.expira_em).texto} · {proposta.agente} ({proposta.modelo ?? "modelo n/d"})</p>
      <TabelaItens itens={itens} produtos={produtos} compacto />
      {msg ? <p className="msg-ok" role="status">{msg}</p> : (
        <DecisaoProposta proposta={proposta} itens={itens} selecionados={null} fonte={fonte} lojaId={lojaId} aoConcluir={(m) => { setMsg(m); carregar(); }} />
      )}
      {CENTRAL_ATIVA && <p style={{ marginBottom: 0 }}><a href={`#/central?proposta=${proposta.id}`}>Abrir na Central de Inteligência</a></p>}
    </article>
  );
}
