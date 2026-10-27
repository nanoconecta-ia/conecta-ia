import { useState } from "react";
import { mapaParaTexto, resumoDoMapa, type MapaNo } from "../lib/mapaPagina.ts";
import { perguntarAoNano } from "../lib/contextoPagina.ts";

/** Resumo da tela calculado aqui, sem IA e sem rede. O lojista decide se leva a pergunta ao Nano.ia. */
export function ResumoPagina({ raiz, titulo }: { raiz: MapaNo; titulo: string }) {
  const linhas = resumoDoMapa(raiz);
  const [copiado, setCopiado] = useState(false);
  async function copiar() { try { await navigator.clipboard.writeText(`${titulo}\n${linhas.join("\n")}`); setCopiado(true); setTimeout(() => setCopiado(false), 1800); } catch { /* sem permissão da área de transferência */ } }
  return (
    <section className="resumo" aria-label={`Resumo: ${titulo}`}>
      <h3>{titulo}</h3>
      <ul className="resumo-lista">{linhas.map((x) => <li key={x} className={x.startsWith("Atenção") ? "resumo-atencao" : undefined}>{x}</li>)}</ul>
      <div className="mapa-barra">
        <button type="button" onClick={() => perguntarAoNano(`Resuma a tela "${titulo}" e sugira os próximos passos, só com estes dados:\n${mapaParaTexto(raiz)}`)}>Pedir análise ao Nano.ia</button>
        <button type="button" className="sec" onClick={() => void copiar()}>{copiado ? "Copiado" : "Copiar resumo"}</button>
      </div>
      <p className="suave mapa-nota">Feito neste navegador, sem enviar nada. A análise do Nano.ia só acontece quando você clica e envia a pergunta.</p>
    </section>
  );
}
