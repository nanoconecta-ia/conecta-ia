import { linhaCandidato, linhaFonte, resumoConclusao, selosCandidato, type CandidatoEv, type ConclusaoEv, type FonteEv } from "../lib/evidencia.ts";

export type EvidenciaBusca = {
  origem: string; simulado: boolean; consultado_em: string; sincronizado_em?: string | null; motivo?: string | null;
  dados: { sku?: string | null; nome?: string | null; preco?: number | null; estoque?: number | null };
  candidatos?: CandidatoEv[]; fontes?: FonteEv[]; conclusao?: ConclusaoEv; total_candidatos?: number; truncado?: boolean;
};

/** Evidência de uma consulta de produto. Evidência antiga (sem candidatos) mantém o cartão simples de antes. */
export function EvidenciaProduto({ ev }: { ev: EvidenciaBusca }) {
  const caixa = { marginTop: 8, padding: 8, border: "1px solid currentColor", borderRadius: 6, overflowWrap: "anywhere" as const };
  if (!ev.candidatos || !ev.fontes || !ev.conclusao) {
    return (
      <aside style={caixa}>
        <strong>{ev.simulado ? "SIMULADO · " : ""}{ev.origem === "api_bling" ? "API Bling consultada" : "Espelho sincronizado"}</strong>
        <p>{ev.dados.nome} · SKU {ev.dados.sku}</p>
        <p>Preço: {ev.dados.preco == null ? "não informado" : `R$ ${ev.dados.preco.toFixed(2)}`} · Estoque: {ev.dados.estoque ?? "não informado"}</p>
        <small>Consulta: {new Date(ev.consultado_em).toLocaleString()}{ev.sincronizado_em ? ` · Sincronização: ${new Date(ev.sincronizado_em).toLocaleString()}` : ""}{ev.motivo ? ` · Alternativa usada: ${ev.motivo}` : ""}</small>
      </aside>
    );
  }
  return (
    <aside style={caixa} aria-label="Resultado da busca de produto">
      <strong>{ev.simulado ? "SIMULADO · " : ""}Busca de produto: {ev.candidatos.length} candidato(s){ev.truncado ? ` de ${ev.total_candidatos} (lista cortada)` : ""}</strong>
      <ul aria-label="Fontes consultadas" style={{ margin: "6px 0", paddingLeft: 18 }}>{ev.fontes.map((f, i) => <li key={i}><small>{linhaFonte(f)}</small></li>)}</ul>
      {ev.candidatos.length > 0 && (
        <ol aria-label="Candidatos" style={{ margin: "6px 0", paddingLeft: 18 }}>
          {ev.candidatos.map((c) => <li key={c.id}><p style={{ margin: 0 }}>{linhaCandidato(c)}</p><small>{selosCandidato(c).join(" · ")}</small></li>)}
        </ol>
      )}
      <p style={{ margin: "6px 0" }}><b>{resumoConclusao(ev.conclusao)}</b></p>
      <small>{ev.conclusao.aviso}</small><br />
      <small>Consulta: {new Date(ev.consultado_em).toLocaleString()}{ev.sincronizado_em ? ` · Espelho sincronizado em: ${new Date(ev.sincronizado_em).toLocaleString()}` : ""}</small>
    </aside>
  );
}
