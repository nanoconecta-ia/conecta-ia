import { EXEMPLO, ROTULO_ESTADO, resumoEstados, type EstadoDado } from "../lib/demoCadastro.ts";
import { IconePeca, IconeVeiculo } from "../componentes/IconePeca.tsx";
import "./demo-cadastro.css";

const Selo = ({ e }: { e: EstadoDado }) => <span className={`dc-selo dc-${e}`}>{ROTULO_ESTADO[e]}</span>;

/** Demonstração (SIMULAÇÃO): como o Nano apresentaria a proposta de cadastro de um produto. Dados fixos, nada é gravado. */
export function DemoCadastro() {
  const r = resumoEstados();
  return (
    <section className="dc" aria-label="Demonstração do cadastro assistido">
      <p className="dc-faixa" role="status">SIMULAÇÃO · dados reais do Bling e da pesquisa · nada é gravado</p>
      <article className="dc-cartao" aria-label={`Proposta de cadastro ${EXEMPLO.sku}`}>
        <header className="dc-topo">
          <div className="dc-foto" role="img" aria-label="Foto principal ainda não aprovada"><span>foto principal<br />pendente</span></div>
          <div className="dc-id">
            <strong>{EXEMPLO.nome}</strong>
            <span className="suave">{EXEMPLO.marca.valor} · {EXEMPLO.sku} · {EXEMPLO.dentes.valor} dentes</span>
            <div className="dc-mini" aria-label="Miniaturas pendentes">{Array.from({ length: EXEMPLO.fotos.miniaturas }, (_, i) => <span key={i} aria-hidden="true" />)}</div>
          </div>
        </header>
        <p className="dc-resumo">
          <Selo e="confirmado" /> {r.confirmado} · <Selo e="a_confirmar" /> {r.a_confirmar} · <Selo e="divergente" /> {r.divergente} · <Selo e="ausente" /> {r.ausente}
        </p>

        <h3>Taxonomia</h3>
        <ol className="dc-taxonomia">
          {EXEMPLO.taxonomia.map((n, i) => (
            <li key={n.nome}>
              {i === 0 && <IconePeca nome="motor" tamanho={34} titulo="Sistema motor" />}
              <span className="dc-nivel">{n.nivel}</span><span>{n.nome}</span><Selo e={n.estado} />
            </li>
          ))}
        </ol>

        <h3>Códigos e equivalentes</h3>
        <ul className="dc-lista">
          {EXEMPLO.codigos.map((c) => (
            <li key={c.marca + c.codigo}><b>{c.marca}</b> <code>{c.codigo}</code> <Selo e={c.estado} /><small className="suave">{c.fonte}</small></li>
          ))}
        </ul>

        <h3>Aplicações</h3>
        <ul className="dc-lista dc-aplic">
          {EXEMPLO.aplicacoes.map((a) => (
            <li key={a.veiculo}>
              <IconeVeiculo tipo={a.tipoVeiculo} largura={54} />
              <span><b>{a.veiculo}</b><small className="suave">{a.motor} · {a.anos}</small></span>
              <Selo e={a.estado} />
            </li>
          ))}
        </ul>

        <h3>Antes / depois (Bling)</h3>
        <p className="dc-diff"><span className="suave">{EXEMPLO.antesDepois.campo}</span><br /><del>{EXEMPLO.antesDepois.antes}</del> → <ins>{EXEMPLO.antesDepois.depois}</ins></p>

        <footer className="dc-rodape">
          <button type="button" disabled title="Demonstração: nada é gravado">Aprovar proposta</button>
          <button type="button" className="sec" disabled title="Demonstração: nada é gravado">Recusar</button>
        </footer>
      </article>
    </section>
  );
}
