import { createContext, useContext } from "react";
import atlas from "../assets/atlas-modelo-aprovado.jpg";

const POSICOES: Record<string, [number, number]> = {
  inicio:[0,4], nano:[4,1], robo:[3,5], olho:[4,5], catalogo:[7,2], matriz:[1,3],
  taxonomia:[2,3], revisao:[7,1], historico:[4,2], ajustes:[6,3], grafico:[2,2],
  imagens:[3,3], web:[2,2], contexto:[6,1], motor:[4,0], arrefecimento:[5,0],
  freios:[6,0], suspensao:[7,0], eletrica:[0,1], transmissao:[1,1],
};
// Escopo de apresentação, não autoridade de taxonomia ou aprovação.
// Mobis não pode herdar a biblioteca anterior enquanto a nova não estiver homologada.
export const AtivosMobisSemLegado = createContext(false);
/** Atlas histórico preservado para os ambientes que ainda não adotaram MA Display. */
export function AtivoAprovado({nome,tamanho=32}:{nome:string;tamanho?:number}){
 const semLegado=useContext(AtivosMobisSemLegado);
 // Não usar outra peça, avatar ou ícone genérico para substituir um ativo ausente.
 // O texto adjacente da interface mantém a identidade funcional do controle.
 if(semLegado)return <span className="ap-ativo" data-ativo-estado="pendente" data-ativo-chave={nome} aria-hidden="true" title="Ativo visual aguardando homologação" style={{display:"inline-flex",alignItems:"center",justifyContent:"center",flexShrink:0,width:tamanho,height:tamanho,border:"1px dashed currentColor",borderRadius:8,fontSize:Math.min(12,tamanho/3),opacity:.75}}>—</span>;
 const posicao=POSICOES[nome];
 if(!posicao)return <span className="ap-ativo" data-ativo-estado="desconhecido" aria-hidden="true" style={{display:"inline-block",width:tamanho,height:tamanho,flexShrink:0}}/>;
 const [col,row]=posicao;
 const x=4+col*192,y=[4,216,429,641,854,1067][row];
 return <span className="ap-ativo" data-ativo-estado="atlas-historico" aria-hidden="true" style={{display:"inline-block",flexShrink:0,backgroundRepeat:"no-repeat",width:tamanho,height:tamanho,
  backgroundImage:`url(${atlas})`,backgroundSize:`${1536/184*tamanho}px ${1275/184*tamanho}px`,
  backgroundPosition:`${-x/184*tamanho}px ${-y/184*tamanho}px`}}/>;
}
