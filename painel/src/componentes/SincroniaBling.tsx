import type { Conferencia } from "../lib/taxonomiaBling.ts";

/** Conferência taxonomia ↔ Bling nos dois sentidos. Só leitura: criar no Bling passa por proposta e aprovação (escrita desligada até autorização). */
export function SincroniaBling({ c }: { c: Conferencia }) {
  const pendencias = c.faltamNoBling.length + c.sugestoes.length + c.blingSemNo.length + c.divergencias.length + c.ligacoesQuebradas.length;
  return (
    <section className="sinc-bling" aria-labelledby="sinc-titulo">
      <h2 id="sinc-titulo">Sincronia com o Bling</h2>
      <p className="suave">A taxonomia do Conecta e as categorias do Bling devem ser o espelho uma da outra. Aqui você vê o que já está ligado e o que falta em cada lado.</p>
      <ul className="sinc-resumo" aria-label="Resumo">
        <li className="ok"><b>{c.ligados.length}</b><span>ligadas nos dois lados</span></li>
        <li className={c.faltamNoBling.length ? "atencao" : "ok"}><b>{c.faltamNoBling.length}</b><span>faltam no Bling</span></li>
        <li className={c.blingSemNo.length ? "atencao" : "ok"}><b>{c.blingSemNo.length}</b><span>do Bling sem nó na taxonomia</span></li>
        <li className={c.sugestoes.length ? "atencao" : "ok"}><b>{c.sugestoes.length}</b><span>com nome igual, ainda não ligadas</span></li>
        <li className={c.divergencias.length + c.ligacoesQuebradas.length ? "erro" : "ok"}><b>{c.divergencias.length + c.ligacoesQuebradas.length}</b><span>divergências</span></li>
      </ul>
      {pendencias === 0 && <p className="msg-ok">Tudo em dia: a taxonomia e o Bling estão iguais.</p>}

      {c.faltamNoBling.length > 0 && (
        <details open>
          <summary>Falta criar no Bling ({c.faltamNoBling.length})</summary>
          <p className="suave">Na ordem de criação: primeiro as áreas, depois as subcategorias. Peça ao Nano.ia para preparar a criação; ele monta uma proposta e você aprova. Nada é gravado no Bling sem a sua aprovação e a liberação da escrita.</p>
          <ol className="sinc-lista">
            {c.faltamNoBling.map((f) => <li key={f.no.id}><b>{f.no.nome}</b>{f.paiNome && <span className="suave"> dentro de {f.paiNome}{f.dependeDoPai ? " (criar a mãe antes)" : ""}</span>}</li>)}
          </ol>
        </details>
      )}
      {c.sugestoes.length > 0 && (
        <details>
          <summary>Mesmo nome nos dois lados, falta ligar ({c.sugestoes.length})</summary>
          <ul className="sinc-lista">{c.sugestoes.map((s) => <li key={s.no.id}><b>{s.no.nome}</b> <span className="suave">↔ categoria {s.categoria.nome} (Bling {s.categoria.bling_id})</span></li>)}</ul>
        </details>
      )}
      {c.blingSemNo.length > 0 && (
        <details>
          <summary>Existem só no Bling ({c.blingSemNo.length})</summary>
          <p className="suave">Decida se entram na taxonomia (o agente propõe o nó e você aprova na fila) ou se ficam fora.</p>
          <ul className="sinc-lista">{c.blingSemNo.map((b) => <li key={b.bling_id}><b>{b.nome}</b> <span className="suave mono">{b.bling_id}</span></li>)}</ul>
        </details>
      )}
      {c.divergencias.length + c.ligacoesQuebradas.length > 0 && (
        <details open>
          <summary>Divergências ({c.divergencias.length + c.ligacoesQuebradas.length})</summary>
          <ul className="sinc-lista">
            {c.divergencias.map((d) => <li key={d.no.id}><b>{d.no.nome}</b> <span className="suave">· {d.motivo}</span></li>)}
            {c.ligacoesQuebradas.map((l) => <li key={l.bling_categoria_id + l.taxonomia_no_id}><b>Ligação com categoria que não existe mais no espelho do Bling</b> <span className="suave mono">{l.bling_categoria_id}</span></li>)}
          </ul>
        </details>
      )}
    </section>
  );
}
