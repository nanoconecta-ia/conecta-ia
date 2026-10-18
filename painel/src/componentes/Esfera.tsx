export type EstadoEsfera = "parado" | "ouvindo" | "pensando" | "falando";
const ROTULO: Record<EstadoEsfera, string> = { parado: "Assistente pronto", ouvindo: "Ouvindo você", pensando: "Pensando", falando: "Falando" };

/** Esfera do agente em CSS puro, com uma nuvem girando no núcleo. O estado vem do que está acontecendo de verdade (microfone, pedido, voz). */
export function Esfera({ estado = "parado", tamanho = 96 }: { estado?: EstadoEsfera; tamanho?: number }) {
  return (
    <div className="esfera" data-estado={estado} style={{ ["--d" as string]: `${tamanho}px` }} role="img" aria-label={ROTULO[estado]}>
      <span className="nuvem" aria-hidden="true"><i /><i /><i /></span>
      <span className="brilho" aria-hidden="true" />
    </div>
  );
}
