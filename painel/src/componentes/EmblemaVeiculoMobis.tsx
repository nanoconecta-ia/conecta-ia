import { IconeVeiculo } from "./IconePeca.tsx";

/** Imagens locais da identidade visual MOBIS (18/11/2026).
 * Não alterar o mapa global de ícones de veículo do Conecta.IA.
 * São ilustrações por categoria, não veículos/anos homologados.
 */
const EMBLEMAS:Readonly<Record<string,string>>={
  picape:"/icones-veiculos-mobis/mobis-veiculo-picapes-512.webp",
  furgao:"/icones-veiculos-mobis/mobis-veiculo-vans-512.webp",
  caminhao:"/icones-veiculos-mobis/mobis-veiculo-utilitarios-512.webp",
  passeio:"/icones-veiculos-mobis/mobis-veiculo-passeio-512.webp",
};
export function EmblemaVeiculoMobis({tipo,tamanho=120}:{tipo:string;tamanho?:number}){
  const src=EMBLEMAS[tipo];
  if(!src)return <IconeVeiculo tipo={tipo} largura={tamanho}/>;
  return <img className="m4-emblema-veiculo" src={src}
    width={tamanho} height={tamanho}
    loading="lazy" decoding="async" alt="" aria-hidden="true"/>;
}
