import { type EstadoEsfera } from "./Esfera.tsx";
import { RoboNano } from "./RoboNano.tsx";

/** Marca do Conecta.IA no cabeçalho: o mesmo avatar orbital do Nano.IA. O estado vem do store por loja (passado por quem renderiza). */
export function LogoConecta({ tamanho = 40, nome = false, estado = "ocioso" }: { tamanho?: number; nome?: boolean; estado?: EstadoEsfera }) {
  return (
    <span className="logo-conecta">
      <RoboNano estado={estado} tamanho={tamanho} decorativo={nome} />
      {nome && <b>Conecta<span>.IA</span></b>}
    </span>
  );
}
