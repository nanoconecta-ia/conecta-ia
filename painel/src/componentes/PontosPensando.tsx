/** Quatro esferas pequenas em movimento, para mostrar que o Nano está pensando (referência: o indicador do chat do Claude).
 *  Só anima enquanto o estado é real; com prefers-reduced-motion ficam paradas. */
export function PontosPensando() {
  return <span className="pontos-pensando" aria-hidden="true"><span /><span /><span /><span /></span>;
}
