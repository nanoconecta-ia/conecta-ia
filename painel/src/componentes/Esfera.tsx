import { ROTULO_ESTADO, type EstadoAgente } from "../lib/estadoAgente.ts";

/** Estados antigos (loja pública e assistente do cliente) continuam valendo; os 12 do Nano.IA vêm de lib/estadoAgente. */
export type EstadoEsfera = EstadoAgente | "parado" | "ouvindo" | "pensando" | "falando";
const LEGADO: Record<string, EstadoAgente> = { parado: "ocioso", ouvindo: "escutando", pensando: "interpretando" };

export function normalizarEstado(estado: EstadoEsfera): EstadoAgente | "falando" {
  return estado === "falando" ? "falando" : (LEGADO[estado] ?? (estado as EstadoAgente));
}

/** API histórica preservada; a esfera orbital foi substituída pelo avatar Nano. */
import { RoboNano } from "./RoboNano.tsx";

export function Orbe({ estado = "ocioso", tamanho = 40, decorativo = false, rotulo }: { estado?: EstadoEsfera; tamanho?: number; decorativo?: boolean; rotulo?: string }) {
  const e = normalizarEstado(estado);
  return <span role={decorativo ? undefined : "img"} aria-label={decorativo ? undefined : (rotulo ?? `Nano.IA: ${e === "falando" ? "Falando" : ROTULO_ESTADO[e]}`)} aria-hidden={decorativo || undefined}>
    <RoboNano estado={estado} tamanho={tamanho} decorativo />
  </span>;
}

export function Esfera({ estado = "ocioso", tamanho = 96, comRotulo = false, decorativo = false }: { estado?: EstadoEsfera; tamanho?: number; comRotulo?: boolean; peso?: boolean; decorativo?: boolean }) {
  const e = normalizarEstado(estado);
  return <div className="esfera-bloco">
    <Orbe estado={estado} tamanho={tamanho} decorativo={decorativo || comRotulo} />
    {comRotulo && <span className="esfera-rotulo">{e === "falando" ? "Falando" : ROTULO_ESTADO[e]}</span>}
  </div>;
}
