import { useCallback, useEffect, useState } from "react";
import { Dialogo } from "../componentes/Dialogo.tsx";
import { DecisaoProposta } from "../componentes/conector/DecisaoProposta.tsx";
import { TabelaItens } from "../componentes/conector/TabelaItens.tsx";
import { dataBr, hashCurto, nomeModelo, SeloProposta, SeloRisco } from "../componentes/conector/ui.tsx";
import type { ProdutoResumo } from "../lib/conectorDados.ts";
import type { Loja } from "../lib/dados.ts";
import { aReconciliar, agruparPorProduto, itensAprovaveis, prazo, resumoOperacoes, ROTULO_PROPOSTA, type EstadoProposta, type ItemProposta, type Operacao, type Proposta } from "../lib/propostas.ts";
import { useFonte } from "../lib/useFonte.ts";
import { ir } from "../lib/rota.ts";

const FILTROS: [string, string][] = [["pendente", "Aguardando decisão"], ["aprovada", "Aprovadas"], ["executando", "Em execução"], ["executada", "Executadas"], ["parcial", "Parciais"], ["rejeitada", "Rejeitadas"], ["expirada", "Expiradas"], ["", "Todas"]];
type ItemSim = { item_id: string; operacao: string; ok: boolean; motivo?: string; previsto?: unknown; confirmacao_simulada?: boolean };
type ItemExec = { item_id: string; operacao: string; estado: "confirmada" | "falhou" | "desconhecida"; motivo?: string; evidencia?: unknown };
type Relatorio = { tipo: "simulado"; itens: ItemSim[]; aviso: string; semeado_de: string[] } | { tipo: "executado"; itens: ItemExec[]; estado_final: string };
const ROTULO_OP = { pendente: "Pendente", enviada: "Enviada, sem confirmação", confirmada: "Confirmada por leitura", falhou: "Falhou", desconhecida: "Resultado desconhecido" } as const;

/** Central de Inteligência: propostas do Conector IA com antes/depois, fontes, risco, aprovação versionada, trava e relatório de execução. */
export function CentralInteligencia({ loja, query }: { loja: Loja; query: URLSearchParams }) {
  const fonte = useFonte();
  const estadoQ = query.get("estado"); const propostaQ = query.get("proposta");
  const [filtro, setFiltro] = useState<string>(estadoQ ?? "pendente");
  const [lista, setLista] = useState<Proposta[] | null>(null);
  const [sel, setSel] = useState<string | null>(propostaQ);
  const [det, setDet] = useState<{ proposta: Proposta; itens: ItemProposta[]; operacoes: Operacao[]; produtos: Record<string, ProdutoResumo> } | null | undefined>(undefined);
  const [travas, setTravas] = useState<Record<string, string>>({});
  const [escolhidos, setEscolhidos] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState(""); const [erro, setErro] = useState("");
  const [meuId, setMeuId] = useState<string | null>(null);
  const [confTrava, setConfTrava] = useState<null | { acao: "travar" | "destravar"; produtos: string[] }>(null);
  const [ocupado, setOcupado] = useState(false);
  const [confExec, setConfExec] = useState(false);
  const [relatorio, setRelatorio] = useState<Relatorio | null>(null);

  const carregarLista = useCallback(() => { if (fonte) void fonte.propostas(loja.id, filtro || null).then(setLista).catch(() => setLista([])); }, [fonte, loja.id, filtro]);
  const carregarDet = useCallback(() => {
    if (!fonte || !sel) { setDet(undefined); return; }
    void fonte.proposta(sel).then((d) => { setDet(d); setEscolhidos(new Set(d ? itensAprovaveis(d.itens).map((i) => i.id) : [])); }).catch(() => setDet(null));
    void fonte.travas(loja.id).then(setTravas).catch(() => setTravas({}));
  }, [fonte, sel, loja.id]);
  useEffect(() => { if (propostaQ) setSel(propostaQ); }, [propostaQ]);
  useEffect(carregarLista, [carregarLista]);
  useEffect(carregarDet, [carregarDet]);
  useEffect(() => { if (fonte) void fonte.usuario().then((u) => setMeuId(u?.id ?? null)); }, [fonte]);

  if (!fonte) return <p className="suave">Carregando…</p>;
  const escolher = (id: string) => { setSel(id); setMsg(""); setErro(""); setRelatorio(null); ir(`/central?proposta=${id}${filtro ? `&estado=${filtro}` : ""}`); };
  const alternar = (id: string) => setEscolhidos((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const concluiu = (m: string) => { setMsg(m); setErro(""); carregarLista(); carregarDet(); };

  async function aplicarTrava() {
    if (!confTrava) return;
    setOcupado(true);
    const r = await fonte!.chamar("conector-aprovacoes", { loja_id: loja.id, acao: confTrava.acao, produtos: confTrava.produtos, motivo: confTrava.acao === "travar" ? "Auditado pelo lojista" : "Liberado pelo lojista" });
    setOcupado(false); setConfTrava(null);
    if (!r.ok) setErro(r.erro ?? "Não foi possível alterar a trava."); else concluiu(confTrava.acao === "travar" ? "Produto(s) travado(s)." : "Produto(s) destravado(s).");
  }
  async function executarSimulado(p: Proposta) {
    setOcupado(true); setErro("");
    const r = await fonte!.chamar<{ relatorio?: { itens?: ItemSim[] }; semeado_de?: string[]; aviso?: string }>("conector-aprovacoes", { loja_id: loja.id, acao: "executar_simulado", proposta_id: p.id });
    setOcupado(false);
    if (!r.ok) { setErro(r.erro ?? "Não foi possível fazer o ensaio."); return; }
    setRelatorio({ tipo: "simulado", itens: r.dados?.relatorio?.itens ?? [], aviso: r.dados?.aviso ?? "Ensaio: nada foi enviado ao Bling.", semeado_de: r.dados?.semeado_de ?? [] });
    setMsg("Ensaio concluído. Nada foi enviado ao Bling e nenhum estado mudou.");
  }
  async function executar(p: Proposta) {
    setOcupado(true); setErro("");
    const r = await fonte!.chamar<{ relatorio?: { itens?: ItemExec[]; estado_final?: string } }>("conector-aprovacoes", { loja_id: loja.id, acao: "executar", proposta_id: p.id });
    setOcupado(false); setConfExec(false);
    if (!r.ok) { setErro(r.erro ?? "Não foi possível executar."); return; }
    setRelatorio({ tipo: "executado", itens: r.dados?.relatorio?.itens ?? [], estado_final: r.dados?.relatorio?.estado_final ?? "—" });
    concluiu("Execução concluída. Veja o relatório abaixo: itens do Bling continuam bloqueados.");
  }
  async function reconciliar(o: Operacao) {
    setOcupado(true); setErro("");
    const r = await fonte!.chamar<{ resultado?: "gravado" | "nao_gravado" | "indeterminado"; aviso?: string }>("conector-aprovacoes", { loja_id: loja.id, acao: "reconciliar", operacao_id: o.id });
    setOcupado(false);
    if (!r.ok) { setErro(r.erro ?? "Não foi possível reconciliar."); return; }
    const t = r.dados?.resultado === "gravado" ? "Confirmado: o Bling mostra o dado gravado." : r.dados?.resultado === "nao_gravado" ? "O Bling mostra que NÃO gravou: o item pode ser tentado de novo." : "Indeterminado: o Bling não trouxe prova suficiente. Nada foi repetido.";
    concluiu(`${t}${r.dados?.aviso ? ` ${r.dados.aviso}` : ""}`);
  }

  const D = det ?? undefined;
  const produtosDe = D ? [...agruparPorProduto(D.itens).keys()].filter((k) => k !== "sem-produto") : [];
  const opsBling = D ? D.itens.filter((i) => i.operacao.startsWith("bling.")) : [];
  return (
    <div className="central">
      <div className="cartao">
        <h1>Central de Inteligência</h1>
        <p className="suave">Tudo que o Conector IA quer alterar passa por aqui: você vê o antes e o depois, as fontes e o risco, e decide sobre a <strong>versão exata</strong> da proposta.</p>
        <p className="aviso" role="note"><strong>Escrita real no Bling: DESLIGADA nesta fase.</strong> As execuções são simuladas; nenhum cadastro real do Bling é alterado.</p>
        <div className="linha" role="group" aria-label="Filtrar por estado">
          {FILTROS.map(([v, t]) => <button key={v || "todas"} className={filtro === v ? "" : "sec"} aria-pressed={filtro === v} onClick={() => { setFiltro(v); ir(`/central${v ? `?estado=${v}` : ""}`); setSel(null); }}>{t}</button>)}
        </div>
      </div>
      {msg && <p className="msg-ok" role="status">{msg}</p>}
      {erro && <p className="msg-erro" role="alert">{erro}</p>}
      <div className="central-grade">
        <div className="cartao lista-prop" aria-label="Propostas">
          {lista === null ? <p className="suave">Carregando…</p> : lista.length === 0 ? <p className="suave">Nenhuma proposta neste filtro.</p> : (
            <ul>{lista.map((p) => (
              <li key={p.id}><button className={`prop-item ${p.id === sel ? "sel" : ""}`} onClick={() => escolher(p.id)} aria-current={p.id === sel ? "true" : undefined}>
                <strong>{p.titulo}</strong>
                <span className="linha"><SeloProposta estado={p.estado} /><SeloRisco risco={p.risco} /></span>
                <span className="suave">v{p.versao} · {p.lote ? "lote · " : ""}{dataBr(p.criado_em)}</span>
              </button></li>))}
            </ul>)}
        </div>
        <div className="detalhe-prop">
          {!sel ? <div className="cartao"><p className="suave">Escolha uma proposta para ver o antes e o depois.</p></div>
            : D === undefined ? <div className="cartao"><p className="suave">Carregando…</p></div>
            : D === null ? <div className="cartao"><p className="msg-erro">Não foi possível ler esta proposta (ela pode não existir ou o banco ainda não tem as tabelas do Conector IA).</p></div> : (
            <>
              <div className="cartao">
                <div className="linha" style={{ justifyContent: "space-between" }}><h2 style={{ margin: 0 }}>{D.proposta.titulo}</h2><span className="linha"><SeloProposta estado={D.proposta.estado} /><SeloRisco risco={D.proposta.risco} /></span></div>
                {D.proposta.resumo && <p>{D.proposta.resumo}</p>}
                <dl className="dados dados-largo">
                  <dt>Solicitante</dt><dd>{D.proposta.solicitante_user === meuId ? "Você" : <span className="mono">{D.proposta.solicitante_user.slice(0, 8)}</span>}</dd>
                  <dt>Agente e modelo</dt><dd>{D.proposta.agente} · {nomeModelo(D.proposta.provedor)}{D.proposta.modelo ? ` (${D.proposta.modelo})` : ""}</dd>
                  <dt>Versão / código</dt><dd>v{D.proposta.versao} · <code>{hashCurto(D.proposta.hash)}</code></dd>
                  <dt>Prazo</dt><dd>{prazo(D.proposta.expira_em).texto}</dd>
                  <dt>Enviada em</dt><dd>{dataBr(D.proposta.enviado_em)}</dd>
                  <dt>Resultado esperado</dt><dd>{D.proposta.resumo ?? "Os campos acima passam a ter o valor “Depois”, com a fonte indicada."}</dd>
                  <dt>Operações previstas no Bling</dt><dd>{opsBling.length === 0 ? "Nenhuma — só a camada do Conecta.IA." : <>{opsBling.length} (simuladas nesta fase): {[...new Set(opsBling.map((o) => o.operacao))].map((o) => <code key={o} style={{ marginRight: 6 }}>{o}</code>)}</>}</dd>
                </dl>
              </div>

              <div className="cartao">
                <h2>Produtos afetados ({produtosDe.length})</h2>
                {D.proposta.lote && <p className="aviso">Lote: confira a lista individual abaixo. Você pode aprovar só alguns itens marcando as caixas.</p>}
                <ul className="produtos-afetados">{produtosDe.map((id) => {
                  const p = D.produtos[id]; const trav = travas[id] === "bloqueado";
                  return <li key={id} className="linha"><span><span className="mono">{p?.sku ?? "sem SKU"}</span> {p?.nome}</span>
                    <span className={`selo ${trav ? "atencao" : "ok"}`}>{trav ? "travado" : "liberado"}</span>
                    <button className="sec" onClick={() => setConfTrava({ acao: trav ? "destravar" : "travar", produtos: [id] })}>{trav ? "Destravar" : "Travar"}</button></li>;
                })}</ul>
                {produtosDe.length > 1 && <div className="linha">
                  <button className="sec" onClick={() => setConfTrava({ acao: "travar", produtos: produtosDe })}>Travar todos</button>
                  <button className="sec" onClick={() => setConfTrava({ acao: "destravar", produtos: produtosDe })}>Destravar todos</button></div>}
              </div>

              <div className="cartao">
                <h2>Itens: antes e depois</h2>
                {D.proposta.estado === "pendente" && itensAprovaveis(D.itens).length > 1 && (
                  <div className="linha"><button className="sec" onClick={() => setEscolhidos(new Set(itensAprovaveis(D.itens).map((i) => i.id)))}>Marcar todos</button><button className="sec" onClick={() => setEscolhidos(new Set())}>Limpar</button>
                    <span className="suave">{escolhidos.size} de {itensAprovaveis(D.itens).length} selecionado(s)</span></div>)}
                <TabelaItens itens={D.itens} produtos={D.produtos} selecionados={D.proposta.estado === "pendente" ? escolhidos : undefined} aoAlternar={D.proposta.estado === "pendente" ? alternar : undefined} />
              </div>

              <div className="cartao">
                <h2>Decisão</h2>
                <DecisaoProposta proposta={D.proposta} itens={D.itens} selecionados={escolhidos} fonte={fonte} lojaId={loja.id} aoConcluir={concluiu} />
                {(["aprovada", "parcial", "falhou"] as EstadoProposta[]).includes(D.proposta.estado) && (
                  <div className="linha" style={{ marginTop: 12 }}>
                    {D.proposta.estado === "aprovada" && <button disabled={ocupado} onClick={() => setConfExec(true)}>Executar aprovado</button>}
                    <button className="sec" disabled={ocupado} onClick={() => void executarSimulado(D.proposta)}>Fazer ensaio (simulado)</button>
                  </div>)}
                {D.proposta.estado === "aprovada" && <p className="suave" style={{ marginBottom: 0 }}>Executar roda os itens <strong>internos</strong> (enriquecimento e publicação). Itens do <strong>Bling</strong> continuam bloqueados (escrita desligada) e voltam como falha, com o motivo. O ensaio não muda nada.</p>}
              </div>

              <div className="cartao">
                <h2>Relatório de execução</h2>
                {D.operacoes.length === 0 ? <p className="suave">Nada foi executado ainda ({ROTULO_PROPOSTA[D.proposta.estado].toLowerCase()}).</p> : (
                  <>
                    <p className="suave">{Object.entries(resumoOperacoes(D.operacoes)).filter(([, n]) => n > 0).map(([k, n]) => `${n} ${ROTULO_OP[k as keyof typeof ROTULO_OP].toLowerCase()}`).join(" · ")}</p>
                    <div className="rolagem"><table><thead><tr><th>Ferramenta</th><th>Tent.</th><th>Estado</th><th>Evidência / erro</th><th /></tr></thead>
                      <tbody>{D.operacoes.map((o) => (
                        <tr key={o.id}><td><code>{o.ferramenta}</code></td><td>{o.tentativa}</td><td><span className={`selo ${o.estado === "confirmada" ? "ok" : o.estado === "falhou" ? "erro" : "atencao"}`}>{ROTULO_OP[o.estado]}</span></td>
                          <td className="suave">{o.erro ?? (o.evidencia ? JSON.stringify(o.evidencia).slice(0, 120) : "—")}</td>
                          <td>{o.estado === "desconhecida" && <button className="sec" disabled={ocupado} onClick={() => void reconciliar(o)}>Reconciliar</button>}</td></tr>))}</tbody></table></div>
                    {aReconciliar(D.operacoes).length > 0 && <p className="aviso">Há operação com resultado desconhecido (timeout). Nada é repetido às cegas: o sistema lê o Bling e só conclui com prova antes de tentar de novo.</p>}
                  </>)}
                {relatorio && (
                  <div className="relatorio" aria-live="polite">
                    <h3>{relatorio.tipo === "simulado" ? "Resultado do ensaio" : `Resultado da execução (${relatorio.estado_final})`}</h3>
                    {relatorio.tipo === "simulado" && <p className="aviso"><strong>{relatorio.aviso}</strong>{relatorio.semeado_de.length > 0 && <> Partiu da leitura de {relatorio.semeado_de.length} produto(s) do Bling (só leitura).</>}</p>}
                    <ul className="fontes">{relatorio.itens.map((i) => {
                      const ok = relatorio.tipo === "simulado" ? (i as ItemSim).ok : (i as ItemExec).estado === "confirmada";
                      const rotulo = relatorio.tipo === "simulado" ? (ok ? "ok (simulado)" : "falha") : ROTULO_OP[(i as ItemExec).estado];
                      return <li key={i.item_id}><span className={`selo ${ok ? "ok" : "erro"}`}>{rotulo}</span> <code>{i.operacao}</code>{i.motivo ? <span className="suave"> — {i.motivo}</span> : null}</li>;
                    })}</ul>
                  </div>)}
              </div>
            </>)}
        </div>
      </div>

      <Dialogo aberto={!!confTrava} titulo={confTrava?.acao === "travar" ? "Travar produto(s)" : "Destravar produto(s)"} rotuloConfirmar={confTrava?.acao === "travar" ? "Travar" : "Destravar"} ocupado={ocupado} aoCancelar={() => setConfTrava(null)} aoConfirmar={() => void aplicarTrava()}>
        <p>{confTrava?.acao === "travar" ? `Travar ${confTrava.produtos.length} produto(s): o agente só poderá sugerir; propostas pendentes viram sugestão e perdem a possibilidade de aprovação.` : `Destravar ${confTrava?.produtos.length} produto(s): o agente volta a poder propor (toda escrita continua exigindo sua aprovação).`}</p>
      </Dialogo>
      <Dialogo aberto={confExec} titulo="Executar o que foi aprovado" rotuloConfirmar="Executar agora" ocupado={ocupado} aoCancelar={() => setConfExec(false)} aoConfirmar={() => D && void executar(D.proposta)}>
        <p>Serão executados <strong>só os itens aprovados</strong> desta versão. Itens internos (enriquecimento, publicação) rodam; itens do Bling continuam bloqueados e aparecerão como falha com o motivo. Nada é enviado ao Bling.</p>
      </Dialogo>
    </div>
  );
}
