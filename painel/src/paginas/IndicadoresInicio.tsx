import { useState } from "react";
import { ir } from "../lib/rota.ts";

type Ind = { id: string; icone: string; rotulo: string; detalhe: string; cor: string; ir?: string };

/** Indicadores minúsculos e retráteis, só indicativos. Cada ícone mostra uma linha ao tocar; a seta recolhe todos. Só dados reais (consulta da loja); sem dado, mostra "—". */
export function IndicadoresInicio({ fila, erro }: { fila: number | null | undefined; erro?: string | null }) {
  const [aberto, setAberto] = useState(true);
  const [foco, setFoco] = useState<string | null>(null);
  const lista: Ind[] = [
    { id: "fila", icone: "✓", rotulo: "Aprovações pendentes", detalhe: fila == null ? "Aprovações pendentes: —" : `${fila.toLocaleString("pt-BR")} aprovações pendentes na Central`, cor: fila ? "#9a5500" : "#5a544a", ir: "/aprovacoes" },
    { id: "alerta", icone: "!", rotulo: "Alertas", detalhe: erro ? erro : "Sem alertas na consulta desta loja", cor: erro ? "#b42318" : "#1a6f4d" },
  ];
  const atual = lista.find((i) => i.id === foco);
  return (
    <div className="ap-indicadores" role="group" aria-label="Indicadores">
      <div className="ap-ind-linha">
        {aberto && lista.map((i) => (
          <button key={i.id} className="ap-ind-bt" aria-label={i.rotulo} aria-pressed={foco === i.id} onClick={() => setFoco(foco === i.id ? null : i.id)}>
            <span aria-hidden>{i.icone}</span><i className="ap-ind-ponto" style={{ background: i.cor }} aria-hidden />
          </button>
        ))}
        <button className="ap-ind-bt ap-ind-recolher" aria-label={aberto ? "Recolher indicadores" : "Mostrar indicadores"} aria-expanded={aberto} onClick={() => { setAberto(!aberto); setFoco(null); }}>{aberto ? "⌃" : "⌄"}</button>
      </div>
      {aberto && atual && <p className="ap-ind-detalhe" role="status">{atual.detalhe}{atual.ir && <> <button className="ap-ind-ver" onClick={() => ir(atual.ir!)}>Ver</button></>}</p>}
    </div>
  );
}
