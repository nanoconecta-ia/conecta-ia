import type { FonteDados } from "../../lib/conectorDados.ts";
import type { PropostaTurno, RiscoTurno } from "../../lib/streamAssistente.ts";
import { Icone } from "../Icone.tsx";
import { CartaoProposta } from "./CartaoProposta.tsx";

const RISCO: Record<RiscoTurno, { classe: string; texto: string }> = {
  LOW: { classe: "ok", texto: "baixo" }, MEDIUM: { classe: "atencao", texto: "médio" }, HIGH: { classe: "erro", texto: "alto" }, CRITICAL: { classe: "erro", texto: "crítico" },
};

/** Proposta no chat em UMA linha discreta; os detalhes (lidos do banco) só carregam quando o lojista abre. */
export function PropostaCompacta({ p, fonte, lojaId }: { p: PropostaTurno; fonte: FonteDados | null; lojaId: string }) {
  const r = p.risco ? RISCO[p.risco] : null;
  return (
    <details className="proposta-compacta">
      <summary aria-label={`Proposta para aprovar: ${p.titulo ?? "sem título"}${r ? `, risco ${r.texto}` : ""}`}>
        <Icone nome="escudo" tamanho={14} />
        <span className="proposta-compacta-titulo">{p.titulo ?? "Proposta para aprovar"}</span>
        {r && <span className={`proposta-compacta-risco ${r.classe}`} title={`Risco ${r.texto}`}><i aria-hidden="true" />{r.texto}</span>}
        <span className="proposta-compacta-ver">Ver</span>
      </summary>
      {fonte ? <CartaoProposta propostaId={p.id} fonte={fonte} lojaId={lojaId} /> : <p className="suave">Carregando…</p>}
    </details>
  );
}
