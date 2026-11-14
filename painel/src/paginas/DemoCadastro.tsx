import { useState } from "react";
import { EXEMPLO, ROTULO_ESTADO, resumoEstados, type EstadoDado } from "../lib/demoCadastro.ts";
import { EXEMPLO_MOTOR } from "../lib/demoMotor.ts";
import { FOTOS_MOTOR } from "../lib/demoMotorFotos.ts";
import { IconePeca, IconeVeiculo } from "../componentes/IconePeca.tsx";
import "./demo-cadastro.css";

const Selo = ({ e }: { e: EstadoDado }) => <span className={`dc-selo dc-${e}`}>{ROTULO_ESTADO[e]}</span>;

/** Demonstração (SIMULAÇÃO): como o Nano apresentaria a proposta de cadastro de um produto. Dados fixos, nada é gravado. */
export function DemoCadastro() {
  const [ex, setEx] = useState<"correia" | "motor">("motor");
  return (
    <>
      <div className="dc-abas" role="tablist" aria-label="Exemplo">
        <button type="button" role="tab" aria-selected={ex === "motor"} onClick={() => setEx("motor")}>Motor HR 8v</button>
        <button type="button" role="tab" aria-selected={ex === "correia"} onClick={() => setEx("correia")}>Correia 099SHP190H</button>
      </div>
      {ex === "motor" ? <DemoMotor /> : <DemoCorreia />}
    </>
  );
}

function DemoMotor() {
  const [i, setI] = useState(0);
  const f = FOTOS_MOTOR[i]!;
  return (
    <section className="dc" aria-label="Demonstração: motor HR 8 válvulas">
      <p className="dc-faixa" role="status">SIMULAÇÃO · fotos reais do lojista · nada é gravado</p>
      <article className="dc-cartao" aria-label="Proposta de cadastro do motor HR 8 válvulas">
        <header className="dc-topo">
          <img className="dc-foto dc-foto-real" src={f.grande} alt={`Motor HR 8 válvulas, ${f.legenda}`} width={84} height={84} />
          <div className="dc-id">
            <strong>{EXEMPLO_MOTOR.nome}</strong>
            <span className="suave">SKU: {EXEMPLO_MOTOR.sku} · {EXEMPLO_MOTOR.direitosFotos}</span>
            <div className="dc-mini" role="group" aria-label="Fotos do produto">
              {FOTOS_MOTOR.map((m, k) => (
                <button key={m.legenda} type="button" className={k === i ? "ativa" : ""} aria-label={`Foto ${k + 1}: ${m.legenda}`} aria-pressed={k === i} onClick={() => setI(k)}>
                  <img src={m.mini} alt="" width={34} height={34} />
                </button>
              ))}
            </div>
          </div>
        </header>
        <h3>O que as fotos mostram</h3>
        <ul className="dc-lista">
          {EXEMPLO_MOTOR.evidencias.map((e) => (
            <li key={e.dado}><span>{e.dado}</span> <Selo e={e.estado} /><small className="suave">{e.fonte}</small></li>
          ))}
        </ul>
        <h3>Taxonomia proposta</h3>
        <ol className="dc-taxonomia">
          {EXEMPLO_MOTOR.taxonomia.map((n, k) => (
            <li key={n.nome}>
              {k === 0 && <IconePeca nome="motor" tamanho={34} titulo="Sistema motor" />}
              <span className="dc-nivel">{n.nivel}</span><span>{n.nome}</span><Selo e={n.estado} />
            </li>
          ))}
        </ol>
        <footer className="dc-rodape">
          <button type="button" disabled title="Demonstração: nada é gravado">Aprovar proposta</button>
          <button type="button" className="sec" disabled title="Demonstração: nada é gravado">Recusar</button>
        </footer>
      </article>
    </section>
  );
}

function DemoCorreia() {
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
