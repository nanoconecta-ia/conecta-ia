import type { CSSProperties } from "react";
import { ESTADO_ATIVO, ROTULO_ESTADO, type EstadoAgente } from "../lib/estadoAgente.ts";
import "./NanoOrbita.css";

/**
 * Avatar visual (Olho + Atomo + Aurora). Nao cria inteligencia ou acesso ao ERP.
 * Recebe SOMENTE estados confirmados pelo aplicativo: SSE, microfone ou ferramentas.
 * Quando dentro de um botao, use decorativa para evitar rotulos acessiveis duplicados.
 */
export function NanoOrbita({
  estado = "ocioso",
  tamanho = 56,
  comRotulo = false,
  decorativa = false,
}: {
  estado?: EstadoAgente;
  tamanho?: number;
  comRotulo?: boolean;
  decorativa?: boolean;
}) {
  const rotulo = ROTULO_ESTADO[estado];
  const ativo = ESTADO_ATIVO[estado];
  const dimensao = Math.max(32, Math.min(144, tamanho));
  const estilo = { "--nano-tamanho": `${dimensao}px` } as CSSProperties;
  return (
    <span className="nano-orbita-bloco">
      <span
        className="nano-orbita"
        data-estado={estado}
        data-ativo={ativo ? "true" : "false"}
        style={estilo}
        role={decorativa ? undefined : "img"}
        aria-hidden={decorativa ? true : undefined}
        aria-label={decorativa ? undefined : `Nano.IA: ${rotulo}`}
      >
        <span className="nano-orbita__halo" aria-hidden="true" />
        <span className="nano-orbita__anel nano-orbita__anel--um" aria-hidden="true"><i /></span>
        <span className="nano-orbita__anel nano-orbita__anel--dois" aria-hidden="true"><i /></span>
        <span className="nano-orbita__nucleo" aria-hidden="true" />
        <span className="nano-orbita__reflexo" aria-hidden="true" />
      </span>
      {comRotulo && <span className="nano-orbita__legenda">{rotulo}</span>}
    </span>
  );
}
