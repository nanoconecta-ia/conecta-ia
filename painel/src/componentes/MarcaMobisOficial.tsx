import type { ReactNode } from "react";
import logoOficial from "../assets/marcas/mobis-mstyle-v3-sem-slogan.svg";

/**
 * ÚNICO componente de logotipo para páginas showroom.
 * Não reconstruir MA com texto, SVG novo, filtros ou gerador de imagem.
 * O arquivo importado é o mesmo M-STYLE CROMO V3 utilizado na vitrine Mobis.
 */
export function MarcaMobisOficial({
  link = "#/loja/mobis",
  complemento,
  compacta = false,
}: {
  link?: string;
  complemento?: ReactNode;
  compacta?: boolean;
}) {
  return <div className={"sm-marca"+(compacta ? " sm-marca-compacta" : "")}>
    <a href={link} className="sm-marca-link" aria-label="Mobis Autopeças — voltar à loja">
      <img src={logoOficial} alt="MOBIS AUTOPEÇAS — logotipo oficial MA" width={1983} height={793} />
    </a>
    <div className="sm-marca-legenda">
      <strong>Loja revendedora independente</strong>
      {complemento&&<span>{complemento}</span>}
    </div>
  </div>;
}
