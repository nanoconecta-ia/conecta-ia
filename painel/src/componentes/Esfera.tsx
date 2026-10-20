import { ESTADO_ATIVO, ROTULO_ESTADO, type EstadoAgente } from "../lib/estadoAgente.ts";

/** Estados antigos (loja pública e assistente do cliente) continuam valendo; os 12 do Conector IA vêm de lib/estadoAgente. */
export type EstadoEsfera = EstadoAgente | "parado" | "ouvindo" | "pensando" | "falando";
const LEGADO: Record<string, EstadoAgente> = { parado: "ocioso", ouvindo: "escutando", pensando: "interpretando" };

/** Esfera do agente em CSS puro. O estado vem do que está acontecendo de verdade (eventos do servidor, microfone, voz): nunca é simulado.
 *  Com prefers-reduced-motion não há movimento; a cor e o texto do estado continuam informando. */
export function Esfera({ estado = "ocioso", tamanho = 96, comRotulo = false }: { estado?: EstadoEsfera; tamanho?: number; comRotulo?: boolean }) {
  const e: EstadoAgente | "falando" = estado === "falando" ? "falando" : (LEGADO[estado] ?? (estado as EstadoAgente));
  const rotulo = e === "falando" ? "Falando" : ROTULO_ESTADO[e];
  const ativo = e === "falando" ? true : ESTADO_ATIVO[e];
  return (
    <div className="esfera-bloco">
      <span className="esfera-caixa">
        <div className="esfera" data-estado={e} data-ativo={ativo ? "true" : "false"} style={{ ["--d" as string]: `${tamanho}px` }} role="img" aria-label={`Conector IA: ${rotulo}`}>
          <span className="nuvem" aria-hidden="true"><i /><i /><i /></span>
          <span className="brilho" aria-hidden="true" />
        </div>
        <span className="orbita" aria-hidden="true"><b /><b /><b /></span>
      </span>
      {comRotulo && <span className="esfera-rotulo">{rotulo}</span>}
    </div>
  );
}
