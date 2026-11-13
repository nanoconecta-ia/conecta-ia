import type { EstadoEsfera } from "./Esfera.tsx";
import { AtivoAprovado } from "./AtivoAprovado.tsx";
import "./avatar-nano-aprovado.css";
export function AvatarNanoAprovado({tamanho=40,estado="ocioso",decorativo=false}:{tamanho?:number;estado?:EstadoEsfera;decorativo?:boolean}){
 return <span className="nano-robo nano-aprovado" data-estado={estado} role={decorativo?undefined:"img"} aria-label={decorativo?undefined:`Nano.IA · ${estado}`} aria-hidden={decorativo||undefined} style={{width:tamanho,height:tamanho}}><AtivoAprovado nome={tamanho>64?"robo":"nano"} tamanho={tamanho}/></span>;
}
