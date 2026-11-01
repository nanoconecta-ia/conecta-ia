/** Marca do Conecta.IA e esfera única do Nano.IA: núcleo de sol com pupila (olho de máquina), órbita de átomo e faíscas.
 *  Reage ao estado do Nano pelo atributo `data-nano-estado` do <html> (definido pelo chat); sem o atributo fica em repouso.
 *  CSS puro, sem imagem. Com prefers-reduced-motion não há movimento. Com `nome`, mostra também o nome. */
export function LogoConecta({ tamanho = 32, nome = false }: { tamanho?: number; nome?: boolean }) {
  return (
    <span className="logo-conecta">
      <span className="orbe" style={{ ["--d" as string]: `${tamanho}px` }} role={nome ? undefined : "img"} aria-label={nome ? undefined : "Conecta.IA"} aria-hidden={nome ? true : undefined}>
        <span className="orbe-aura" aria-hidden="true" />
        <span className="orbe-anel" aria-hidden="true" />
        <span className="orbe-anel orbe-anel-2" aria-hidden="true" />
        <span className="orbe-nucleo" aria-hidden="true"><span className="orbe-pupila" /></span>
        <span className="orbe-faiscas" aria-hidden="true"><b /><b /><b /></span>
      </span>
      {nome && <b>Conecta<span>.IA</span></b>}
    </span>
  );
}
