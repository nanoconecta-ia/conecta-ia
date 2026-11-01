import { Orbe, type EstadoEsfera } from "./Esfera.tsx";

/** Marca do Conecta.IA no cabeçalho: o mesmo avatar orbital do Nano.IA. O estado vem do store por loja (passado por quem renderiza). */
export function LogoConecta({ tamanho = 40, nome = false, estado = "ocioso" }: { tamanho?: number; nome?: boolean; estado?: EstadoEsfera }) {
  return (
    <span className="logo-conecta">
      <Orbe estado={estado} tamanho={tamanho} decorativo={nome} rotulo="Conecta.IA" />
      {nome && <b>Conecta<span>.IA</span></b>}
    </span>
  );
}
