import type { GuiaProvedor } from "../lib/guiaProvedores.ts";
import { Retratil } from "./Retratil.tsx";

/** Faixa de orientação no topo de cada integração: de quem é, onde criar a chave e como ela começa.
 *  Texto grande e contraste alto; os passos ficam recolhidos e só abrem ao toque. */
export function GuiaProvedorFaixa({ guia }: { guia: GuiaProvedor }) {
  return (
    <div className="guia-empresa" role="group" aria-label={`Orientação: ${guia.empresa}`}>
      <div className="guia-empresa-topo">
        {guia.logo ? <img className="guia-empresa-logo" src={`./${guia.logo}`} alt="" width={40} height={40} /> : null}
        <span className="guia-empresa-nome">{guia.empresa}</span>
      </div>
      <p className="guia-empresa-formato">A chave {guia.formato}.</p>
      <div className="linha">
        <a className="guia-empresa-link" href={guia.onde} target="_blank" rel="noopener noreferrer">Abrir a página para criar a chave <span className="guia-empresa-aviso">(abre em nova aba)</span></a>
        {guia.doc && <a className="guia-empresa-link guia-empresa-link--sec" href={guia.doc} target="_blank" rel="noopener noreferrer">Documentação oficial <span className="guia-empresa-aviso">(nova aba)</span></a>}
      </div>
      <Retratil id={`guia-${guia.id}`} titulo="Passo a passo" aberto={false}>
        <ol className="guia-empresa-passos">{guia.passos.map((p) => <li key={p}>{p}</li>)}</ol>
        {guia.observacao && <p className="suave">{guia.observacao}</p>}
        <p className="suave">Nunca envie a chave por mensagem ou e-mail: cole só aqui, no campo da chave.</p>
      </Retratil>
    </div>
  );
}
