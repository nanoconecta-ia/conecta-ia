import { ESTADO_ATIVO, ROTULO_ESTADO, type EstadoAgente } from "../lib/estadoAgente.ts";

/** Estados antigos (loja pública e assistente do cliente) continuam valendo; os 12 do Nano.IA vêm de lib/estadoAgente. */
export type EstadoEsfera = EstadoAgente | "parado" | "ouvindo" | "pensando" | "falando";
const LEGADO: Record<string, EstadoAgente> = { parado: "ocioso", ouvindo: "escutando", pensando: "interpretando" };

export function normalizarEstado(estado: EstadoEsfera): EstadoAgente | "falando" {
  return estado === "falando" ? "falando" : (LEGADO[estado] ?? (estado as EstadoAgente));
}

/** Marcação do avatar orbital único do Nano.IA (CSS puro): núcleo com pupila, duas órbitas elípticas, faíscas e halo.
 *  `decorativo` esconde do leitor de tela (balão e cabeçalho: o rótulo está no botão/texto vizinho). */
export function Orbe({ estado = "ocioso", tamanho = 40, decorativo = false, rotulo }: { estado?: EstadoEsfera; tamanho?: number; decorativo?: boolean; rotulo?: string }) {
  const e = normalizarEstado(estado);
  const texto = e === "falando" ? "Falando" : ROTULO_ESTADO[e];
  const ativo = e === "falando" ? true : ESTADO_ATIVO[e];
  return (
    <span className="orbe" data-estado={e} data-ativo={ativo ? "true" : "false"} style={{ ["--d" as string]: `${tamanho}px` }}
      role={decorativo ? undefined : "img"} aria-label={decorativo ? undefined : (rotulo ?? `Nano.IA: ${texto}`)} aria-hidden={decorativo ? true : undefined}>
      <span className="orbe-aura" aria-hidden="true" />
      <span className="orbe-anel" aria-hidden="true"><i /></span>
      <span className="orbe-anel orbe-anel-2" aria-hidden="true"><i /></span>
      <span className="orbe-nucleo" aria-hidden="true"><span className="orbe-pupila" /></span>
      <span className="orbe-reflexo" aria-hidden="true" />
      <span className="orbe-faiscas" aria-hidden="true"><b /><b /><b /></span>
    </span>
  );
}

/** Mesma API de sempre (estado, tamanho, comRotulo); agora desenha o avatar orbital único. `peso` ficou só por compatibilidade. */
export function Esfera({ estado = "ocioso", tamanho = 96, comRotulo = false, decorativo = false }: { estado?: EstadoEsfera; tamanho?: number; comRotulo?: boolean; peso?: boolean; decorativo?: boolean }) {
  const e = normalizarEstado(estado);
  return (
    <div className="esfera-bloco">
      <Orbe estado={estado} tamanho={tamanho} decorativo={decorativo || comRotulo} />
      {comRotulo && <span className="esfera-rotulo">{e === "falando" ? "Falando" : ROTULO_ESTADO[e]}</span>}
    </div>
  );
}
