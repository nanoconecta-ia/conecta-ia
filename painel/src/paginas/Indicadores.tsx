import { useEffect, useState } from "react";
import { formatarValor, normalizar, rotaDoFiltro, TITULO_FILTRO } from "../lib/indicadores.ts";
import type { ListaIndicador } from "../lib/conectorDados.ts";
import type { Loja } from "../lib/dados.ts";
import { useFonte } from "../lib/useFonte.ts";
import "./dashboards.css";

/** Domínio curto do indicador (prefixo do filtro), só para rotular o cartão. */
const dominio = (filtro: string) => (filtro.split(":")[0] || "geral").replace("sincronizacao", "sync").toUpperCase();

/** Indicadores operacionais REAIS (rpc dashboard_operacional). "não medido" quando o banco devolve null; cada cartão abre os registros. */
export function Indicadores({ loja }: { loja: Loja }) {
  const fonte = useFonte();
  const [r, setR] = useState<ReturnType<typeof normalizar> | undefined>(undefined);
  const [erro, setErro] = useState("");
  useEffect(() => {
    if (!fonte) return;
    setR(undefined); setErro("");
    fonte.dashboard(loja.id).then((b) => { const n = normalizar(b); if (!n) setErro("Resposta inesperada do banco."); setR(n); }).catch((e) => { setErro(e instanceof Error ? e.message : "Não foi possível carregar os indicadores."); setR(null); });
  }, [fonte, loja.id]);
  return (
    <div className="dash">
      <header className="dash-cabecalho">
        <p className="dash-eyebrow"><i aria-hidden="true" /> OPERAÇÃO · CONECTA.IA</p>
        <h1>Indicadores detalhados</h1>
        <p>Números lidos do banco agora. “Não medido” significa que a plataforma ainda não calcula aquele indicador — nunca é um zero de enfeite. Cada cartão abre os registros.</p>
      </header>
      {erro && <p className="msg-erro" role="alert">{erro}</p>}
      {r === undefined && !erro && <p className="suave">Carregando…</p>}
      {r && (
        <>
          <div className="dash-kpis" role="list">
            {r.indicadores.map((i) => {
              const rota = rotaDoFiltro(i.filtro);
              const nm = i.valor === null;
              const corpo = (<><span className="dash-kpi-dom">{dominio(i.filtro)}</span><span className="dash-kpi-num">{formatarValor(i.valor)}</span><span className="dash-kpi-rot">{i.titulo}</span><span className="dash-kpi-aj">{i.observacao ?? i.ajuda}</span></>);
              const cls = `dash-kpi ${nm ? "dash-nm" : ""}`;
              return rota ? <a key={i.chave} role="listitem" className={cls} href={`#${rota}`} aria-label={`${i.titulo}: ${formatarValor(i.valor)}. Abrir lista`}>{corpo}</a> : <div key={i.chave} role="listitem" className={cls}>{corpo}</div>;
            })}
          </div>
          <div className="dash-bloco">
            <h2>Custo por agente neste mês</h2>
            {r.custo.length === 0 ? <p className="suave">Nenhuma resposta de IA registrada neste mês.</p> : (
              <div className="rolagem"><table><thead><tr><th>Provedor</th><th>Modelo</th><th>Tokens</th><th>Custo estimado</th></tr></thead>
                <tbody>{r.custo.map((c, k) => <tr key={k}><td>{c.provedor}</td><td>{c.modelo}</td><td>{c.tokens.toLocaleString("pt-BR")}</td><td>{c.custo_estimado == null ? "não calculado" : `US$ ${c.custo_estimado.toFixed(4)}`}</td></tr>)}</tbody></table></div>)}
          </div>
        </>
      )}
    </div>
  );
}

/** Lista de registros que um indicador abre. */
export function ListaDoIndicador({ loja, filtro }: { loja: Loja; filtro: string }) {
  const fonte = useFonte();
  const [l, setL] = useState<ListaIndicador | null | undefined>(undefined);
  useEffect(() => { if (!fonte) return; setL(undefined); fonte.lista(loja.id, filtro).then(setL).catch(() => setL(null)); }, [fonte, loja.id, filtro]);
  const nome = TITULO_FILTRO[filtro.replace(":", "_")] ?? l?.titulo ?? "Registros";
  return (
    <div className="cartao">
      <p><a href="#/indicadores">← Indicadores</a></p>
      <h1>{l?.titulo ?? nome}</h1>
      {l === undefined ? <p className="suave">Carregando…</p> : l === null ? <p className="msg-erro" role="alert">Não foi possível carregar esta lista.</p> : l.linhas.length === 0 ? <p className="suave">{l.vazio}</p> : (
        <div className="rolagem"><table>
          <thead><tr>{l.colunas.map((c) => <th key={c} scope="col">{c}</th>)}</tr></thead>
          <tbody>{l.linhas.map((x, i) => <tr key={i}>{x.cols.map((c, j) => <td key={j}>{j === 0 && x.href ? <a href={`#${x.href}`}>{c ?? "—"}</a> : (typeof c === "number" ? c.toLocaleString("pt-BR") : c ?? "—")}</td>)}</tr>)}</tbody></table></div>)}
    </div>
  );
}
