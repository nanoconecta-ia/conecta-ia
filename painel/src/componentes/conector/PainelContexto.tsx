import { useEffect, useState } from "react";
import { Dialogo } from "../Dialogo.tsx";
import type { ChamadaFerramenta, ContextoProduto, FonteDados, ProdutoResumo, StatusSync } from "../../lib/conectorDados.ts";
import { dataBr } from "./ui.tsx";

const brl = (v: number | null) => (v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
const ROTULO_TRAVA: Record<string, string> = { bloqueado: "Bloqueado: só sugestões", liberado_propostas: "Liberado para propostas", pendente_aprovacao: "Pendente de aprovação", aprovado_execucao: "Aprovado para execução", em_execucao: "Em execução", sincronizado: "Sincronizado", erro_divergencia: "Erro ou divergência" };

/** Contexto operacional do produto selecionado. Tudo vem do banco; sem dado, mostra vazio (nunca preenche por palpite). */
export function PainelContexto({ fonte, lojaId, produtoId, aoEscolher, versaoDados, aoMudou, aoFechar }: {
  fonte: FonteDados; lojaId: string; produtoId: string | null; aoEscolher: (id: string | null) => void; versaoDados: number; aoMudou: () => void; aoFechar: () => void;
}) {
  const [busca, setBusca] = useState("");
  const [achados, setAchados] = useState<ProdutoResumo[]>([]);
  const [ctx, setCtx] = useState<ContextoProduto | null>(null);
  const [sync, setSync] = useState<StatusSync | null>(null);
  const [chamadas, setChamadas] = useState<ChamadaFerramenta[]>([]);
  const [confirmar, setConfirmar] = useState<null | "travar" | "destravar">(null);
  const [motivo, setMotivo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => { void fonte.statusSync(lojaId).then(setSync).catch(() => setSync(null)); void fonte.chamadas(lojaId, 8).then(setChamadas).catch(() => setChamadas([])); }, [lojaId, versaoDados]);
  useEffect(() => { const t = setTimeout(() => { void fonte.buscarProdutos(lojaId, busca).then(setAchados).catch(() => setAchados([])); }, 250); return () => clearTimeout(t); }, [busca, lojaId]);
  useEffect(() => { if (!produtoId) { setCtx(null); return; } void fonte.contexto(lojaId, produtoId).then(setCtx).catch(() => setCtx(null)); }, [produtoId, lojaId, versaoDados]);

  async function aplicar() {
    if (!confirmar || !ctx) return;
    setOcupado(true); setErro("");
    const r = await fonte.chamar("conector-aprovacoes", { loja_id: lojaId, acao: confirmar, produtos: [ctx.produto.id], motivo: motivo || (confirmar === "travar" ? "Auditado pelo lojista" : "Liberado pelo lojista") });
    setOcupado(false);
    if (!r.ok) { setErro(r.erro ?? "Não foi possível alterar a trava."); return; }
    setConfirmar(null); setMotivo(""); aoMudou();
  }
  const travado = ctx?.trava?.estado === "bloqueado";
  return (
    <aside className="painel-dir" aria-label="Contexto operacional">
      <div className="linha" style={{ justifyContent: "space-between" }}>
        <h2 style={{ margin: 0 }}>Contexto</h2>
        <button className="sec mini" onClick={aoFechar} aria-label="Recolher painel de contexto">✕</button>
      </div>
      <label>Produto
        <input type="search" placeholder="Buscar por nome ou SKU" value={busca} onChange={(e) => setBusca(e.target.value)} />
      </label>
      <ul className="fontes achados" aria-label="Resultados da busca">
        {achados.slice(0, 6).map((p) => <li key={p.id}><button className={`sec mini-texto ${p.id === produtoId ? "sel" : ""}`} onClick={() => aoEscolher(p.id)}><span className="mono">{p.sku ?? "sem SKU"}</span> {p.nome}</button></li>)}
        {achados.length === 0 && <li className="suave">Nenhum produto encontrado.</li>}
      </ul>

      {!ctx ? <p className="suave">Selecione um produto para ver dados do Bling, taxonomia, fontes e operações.</p> : (
        <>
          <section>
            <h3>{ctx.produto.nome ?? "Produto"}</h3>
            <p className="suave" style={{ margin: 0 }}><span className="mono">{ctx.produto.sku ?? "sem SKU"}</span> · <a href={`#/studio?produto=${ctx.produto.id}`}>abrir no Studio</a></p>
            <p style={{ margin: "6px 0" }}>
              <span className={`selo ${travado ? "atencao" : "ok"}`}>{ROTULO_TRAVA[ctx.trava?.estado ?? "liberado_propostas"]}</span>
            </p>
            {ctx.trava?.motivo && <p className="suave" style={{ margin: 0 }}>Motivo: {ctx.trava.motivo} ({dataBr(ctx.trava.alterado_em)})</p>}
            <div className="linha" style={{ marginTop: 8 }}>
              {travado
                ? <button className="sec" onClick={() => setConfirmar("destravar")}>Destravar produto</button>
                : <button className="sec" onClick={() => setConfirmar("travar")} disabled={ctx.trava?.estado === "em_execucao"}>Travar produto</button>}
            </div>
            <p className="suave" style={{ fontSize: ".82rem" }}>Travado: o agente continua consultando e sugerindo, mas nada é escrito neste produto.</p>
          </section>
          <section>
            <h3>Dados do Bling</h3>
            <dl className="dados">
              <dt>Preço</dt><dd>{brl(ctx.produto.preco)}</dd><dt>Estoque</dt><dd>{ctx.produto.estoque ?? "—"}</dd>
              <dt>Marca</dt><dd>{ctx.produto.marca ?? "—"}</dd><dt>GTIN</dt><dd className="mono">{ctx.produto.gtin ?? "—"}</dd>
              <dt>Peso</dt><dd>{ctx.produto.peso_kg != null ? `${ctx.produto.peso_kg} kg` : "—"}</dd><dt>Categoria Bling</dt><dd>{ctx.categoriaBling ?? (ctx.produto.categoria_bling_id ? `id ${ctx.produto.categoria_bling_id} (não encontrada)` : "—")}</dd>
            </dl>
          </section>
          <section>
            <h3>Taxonomia</h3>
            <p style={{ margin: 0 }}>{ctx.taxonomia ? <>{ctx.taxonomia.nome} <span className={`selo ${ctx.taxonomia.status === "aprovado" ? "ok" : "atencao"}`}>{ctx.taxonomia.status}</span></> : <span className="suave">Sem nó de taxonomia ligado.</span>}</p>
          </section>
          <section>
            <h3>Campos faltantes</h3>
            {ctx.faltantes.length === 0 ? <p className="suave" style={{ margin: 0 }}>Nenhum.</p> : <p style={{ margin: 0 }}>{ctx.faltantes.map((f) => <span key={f} className="selo atencao" style={{ marginRight: 4 }}>{f}</span>)}</p>}
          </section>
          <section>
            <h3>Fontes consultadas</h3>
            {ctx.fontes.length === 0 ? <p className="suave" style={{ margin: 0 }}>Nenhuma fonte registrada.</p> : (
              <ul className="fontes">{ctx.fontes.map((f) => <li key={f}>{/^https?:\/\//.test(f) ? <a href={f} target="_blank" rel="noreferrer noopener nofollow">{f.replace(/^https?:\/\//, "").slice(0, 48)}</a> : f}</li>)}</ul>)}
          </section>
          <section>
            <h3>Operações pendentes</h3>
            {ctx.pendentes.length === 0 ? <p className="suave" style={{ margin: 0 }}>Nenhuma.</p> : (
              <ul className="fontes">{ctx.pendentes.map((p, i) => <li key={i}><a href={`#/central?proposta=${p.proposta_id}`}>{p.titulo}</a> <span className="suave">· {p.operacao}</span></li>)}</ul>)}
          </section>
        </>
      )}
      <section>
        <h3>Sincronização com o Bling</h3>
        {!sync ? <p className="suave" style={{ margin: 0 }}>Sem conexão cadastrada.</p> : (
          <p style={{ margin: 0 }}><span className={`selo ${sync.status === "conectada" ? "ok" : "atencao"}`}>{sync.status}</span> <span className="suave">última ok: {dataBr(sync.ultimo_sync_ok_em)}</span>
            {sync.ultimo_erro && <><br /><span className="msg-erro">{sync.ultimo_erro}</span></>}</p>)}
      </section>
      <section>
        <h3>Auditoria (últimas chamadas)</h3>
        {chamadas.length === 0 ? <p className="suave" style={{ margin: 0 }}>Nenhuma chamada registrada.</p> : (
          <ul className="fontes">{chamadas.map((c) => <li key={c.id}><code>{c.ferramenta}</code> <span className={`selo ${c.decisao === "negada" ? "erro" : c.decisao === "requer_aprovacao" ? "atencao" : "ok"}`}>{c.decisao}</span> <span className="suave">{dataBr(c.quando)} · {c.origem}</span></li>)}</ul>)}
      </section>
      <Dialogo aberto={!!confirmar} titulo={confirmar === "travar" ? "Travar produto" : "Destravar produto"} rotuloConfirmar={confirmar === "travar" ? "Travar" : "Destravar"} ocupado={ocupado} aoCancelar={() => { setConfirmar(null); setErro(""); }} aoConfirmar={() => void aplicar()}>
        <p>{confirmar === "travar" ? "O agente não poderá mais escrever neste produto; propostas pendentes viram sugestão." : "O agente voltará a poder propor alterações para este produto (toda escrita continua exigindo sua aprovação)."}</p>
        <label>Motivo (opcional)<input value={motivo} maxLength={200} onChange={(e) => setMotivo(e.target.value)} /></label>
        {erro && <p className="msg-erro" role="alert">{erro}</p>}
      </Dialogo>
    </aside>
  );
}
