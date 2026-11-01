import { useSyncExternalStore } from "react";
import { assinar, obter } from "../lib/contextoPagina.ts";
import { IconePeca } from "./IconePeca.tsx";
import { Icone } from "./Icone.tsx";
import "./PontosPensando.css";

/** Quatro pontos existentes + um pictograma contextual do mapa.
 * Montado apenas quando o Assistente está de fato trabalhando; não anuncia consulta ao Bling sem requisição.
 * A rota indica contexto visual, NÃO qual peça ou operação está sendo executada. */
export function PontosPensando() {
  const pagina = useSyncExternalStore(assinar, obter);
  const catalogo = pagina?.rota === "/catalogo" || pagina?.rota === "/taxonomia";
  return <span className="nano-atividade" aria-hidden="true">
    <span className="nano-atividade-icone">{catalogo ? <IconePeca nome="todas" tamanho={18} /> : <Icone nome="ajustes" tamanho={17} />}</span>
    <span className="pontos-pensando"><span /><span /><span /><span /></span>
  </span>;
}
