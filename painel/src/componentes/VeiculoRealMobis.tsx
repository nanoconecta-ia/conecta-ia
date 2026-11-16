/** Identidade veicular: fotografia REAL e logo homologados em PNG transparente.
 * Nunca inventar veículo, imagem genérica 3D, logo ou motorização. */
type Props = {
  foto?: string|null;
  logo?: string|null;
  montadora: string;
  modelo: string;
  tamanho?: "mini"|"cartao"|"banner";
  credito?: string|null;
};

export function VeiculoRealMobis({
  foto,logo,montadora,modelo,tamanho="mini",credito,
}:Props){
  return <div className={"m2-veiculo-real m2-veiculo-real--"+tamanho}>
    <div className="m2-veiculo-real-foto">
      {foto
        ? <img src={foto} alt={"Fotografia real de referência: "+montadora+" "+modelo}
            loading="lazy" decoding="async"/>
        : <div className="m2-veiculo-real-falta" aria-label={"Imagem de "+montadora+" "+modelo+" aguardando aprovação"}>
            <strong>{modelo}</strong>
            <span>Foto real em preparação</span>
          </div>}
    </div>
    <div className="m2-veiculo-real-marca">
      {logo
        ? <img src={logo} alt={"Logotipo de identificação "+montadora} loading="lazy"/>
        : <strong>{montadora}</strong>}
    </div>
    {foto&&credito&&<details className="m2-veiculo-real-credito"><summary>Créditos da fotografia</summary><small>{credito}</small></details>}
  </div>;
}
