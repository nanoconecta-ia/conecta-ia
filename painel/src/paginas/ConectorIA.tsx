import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { Esfera } from "../componentes/Esfera.tsx";
import { Markdown } from "../componentes/Markdown.tsx";
import { CartaoProposta } from "../componentes/conector/CartaoProposta.tsx";
import { Compositor } from "../componentes/conector/Compositor.tsx";
import { PainelContexto } from "../componentes/conector/PainelContexto.tsx";
import { PainelConversas } from "../componentes/conector/PainelConversas.tsx";
import { nomeModelo } from "../componentes/conector/ui.tsx";
import type { Provedor } from "../lib/chat.ts";
import type { Capacidade, Conversa, DocumentoFonte, ProdutoResumo, ProvedorAtivo } from "../lib/conectorDados.ts";
import type { Loja } from "../lib/dados.ts";
import { ROTULO_ESTADO, reduzirEstado } from "../lib/estadoAgente.ts";
import { mensagensParaItens, tituloDe, type ItemChat } from "../lib/historico.ts";
import { useFonte } from "../lib/useFonte.ts";
import { gravarPreferenciaFala, lerPreferenciaFala, useVoz } from "../lib/voz.ts";

const SUGESTOES = ["Resumo da loja", "O que está pendente?", "Quais produtos estão incompletos?", "Organize o cadastro de um produto"];
const uid = () => crypto.randomUUID();

/** Conector IA: chat persistente com streaming, ferramentas, cartões de aprovação e contexto operacional. */
export function ConectorIA({ loja, query }: { loja: Loja; query: URLSearchParams }) {
  const fonte = useFonte();
  const [conversas, setConversas] = useState<Conversa[] | null>(null);
  const [ativaId, setAtivaId] = useState<string | null>(null);
  const ativaRef = useRef<string | null>(null); ativaRef.current = ativaId;
  const [itens, setItens] = useState<ItemChat[]>([]);
  const [texto, setTexto] = useState("");
  const [anexos, setAnexos] = useState<File[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [estado, despachar] = useReducer(reduzirEstado, "ocioso");
  const [provedores, setProvedores] = useState<ProvedorAtivo[] | null>(null);
  const [capacidades, setCapacidades] = useState<Capacidade[]>([]);
  const [provedor, setProvedor] = useState<Provedor | "">("");
  const [documentos, setDocumentos] = useState<DocumentoFonte[]>([]);
  const [emAnalise, setEmAnalise] = useState<ProdutoResumo[]>([]);
  const [produtoId, setProdutoId] = useState<string | null>(query.get("produto"));
  const [versao, setVersao] = useState(0);
  const [esqAberta, setEsqAberta] = useState(false);
  const [dirAberta, setDirAberta] = useState(false);
  const [ctxVisivel, setCtxVisivel] = useState(true);
  const [uso, setUso] = useState("");
  const [lerAlto, setLerAlto] = useState(lerPreferenciaFala);
  const abortar = useRef<AbortController | null>(null);
  const fim = useRef<HTMLDivElement>(null);
  const iaAtual = useRef<string | null>(null);
  const ultimoTexto = useRef("");

  const produtoQ = query.get("produto");
  useEffect(() => { if (produtoQ) setProdutoId(produtoQ); }, [produtoQ]);
  const recarregarConversas = useCallback(() => { if (fonte) void fonte.conversas(loja.id).then(setConversas).catch(() => setConversas([])); }, [fonte, loja.id]);
  useEffect(() => {
    if (!fonte) return;
    recarregarConversas();
    void fonte.provedores(loja.id).then((p) => { setProvedores(p); setProvedor((atual) => atual || (p.find((x) => x.principal) ?? p[0])?.provedor || ""); }).catch(() => setProvedores([]));
    void fonte.capacidades().then(setCapacidades).catch(() => setCapacidades([]));
    void fonte.documentos(loja.id).then(setDocumentos).catch(() => setDocumentos([]));
    void fonte.produtosEmAnalise(loja.id).then(setEmAnalise).catch(() => setEmAnalise([]));
  }, [fonte, loja.id, recarregarConversas]);
  useEffect(() => { fim.current?.scrollIntoView({ block: "end" }); }, [itens]);

  const voz = useVoz((t, final) => { setTexto(t); if (final && t) void enviar(t); });
  useEffect(() => { despachar({ tipo: "microfone", ouvindo: voz.ouvindo }); }, [voz.ouvindo]);

  async function selecionar(id: string) {
    if (!fonte) return;
    setAtivaId(id); setItens([]); setUso("");
    const c = conversas?.find((x) => x.id === id);
    if (c?.provedor && provedores?.some((p) => p.provedor === c.provedor)) setProvedor(c.provedor as Provedor);
    try { setItens(mensagensParaItens(await fonte.mensagens(id))); }
    catch { setItens([{ k: "erro", id: uid(), texto: "Não foi possível carregar as mensagens desta conversa." }]); }
  }
  function nova() { abortar.current?.abort(); setAtivaId(null); setItens([]); setUso(""); despachar({ tipo: "cancelado" }); }

  async function enviar(textoDireto?: string) {
    const msg = (textoDireto ?? texto).trim();
    if (!fonte || enviando || !provedor || (!msg && anexos.length === 0)) return;
    const arquivos = anexos;
    setItens((l) => [...l, { k: "user", id: uid(), texto: msg + (arquivos.length ? `\n\n📎 ${arquivos.map((f) => f.name).join(", ")}` : "") }]);
    setTexto(""); setAnexos([]); setEnviando(true); setUso(""); iaAtual.current = null; ultimoTexto.current = "";
    const ac = new AbortController(); abortar.current = ac;
    try {
      let conversaId = ativaRef.current; const ids: string[] = [];
      if (arquivos.length) {
        if (!conversaId) {
          const r = await fonte.chamar<{ id: string }>("conector-conversas", { loja_id: loja.id, acao: "criar", titulo: tituloDe(msg), provedor });
          if (!r.ok || !r.dados?.id) throw new Error(r.erro ?? "Não foi possível criar a conversa para enviar os anexos.");
          conversaId = r.dados.id; setAtivaId(conversaId);
        }
        for (const f of arquivos) ids.push((await fonte.anexar(loja.id, conversaId, f)).id);
      }
      await fonte.enviar({ loja_id: loja.id, conversa_id: conversaId, texto: msg, anexos: ids.length ? ids : undefined, provedor: provedor || undefined }, {
        conversa: (d) => { setAtivaId(d.id); },
        estado: (e) => despachar({ tipo: "servidor", estado: e }),
        texto: (delta) => {
          ultimoTexto.current += delta;
          if (!iaAtual.current) { const id = uid(); iaAtual.current = id; setItens((l) => [...l, { k: "ia", id, texto: delta, provedor }]); }
          else { const id = iaAtual.current; setItens((l) => l.map((x) => (x.k === "ia" && x.id === id ? { ...x, texto: x.texto + delta } : x))); }
        },
        ferramentaInicio: (d) => { iaAtual.current = null; setItens((l) => [...l, { k: "ferramenta", id: d.id, nome: d.nome, risco: d.risco, rodando: true }]); },
        ferramentaFim: (d) => setItens((l) => l.map((x) => (x.k === "ferramenta" && x.id === d.id ? { ...x, rodando: false, decisao: d.decisao, ok: d.ok, resumo: d.resumo } : x))),
        proposta: (d) => { iaAtual.current = null; setItens((l) => [...l, { k: "proposta", id: uid(), propostaId: d.id, versao: d.versao, hash: d.hash, titulo: d.titulo, risco: d.risco }]); setVersao((v) => v + 1); },
        uso: (d) => setUso(`${nomeModelo(d.provedor)} · ${d.modelo} · ${d.tokens.toLocaleString("pt-BR")} tokens · ${d.custo_estimado != null ? `~US$ ${d.custo_estimado.toFixed(4)}` : "custo não estimado"}`),
        aviso: (d) => setItens((l) => [...l, { k: "aviso", id: uid(), texto: d.mensagem }]),
        erro: (m) => setItens((l) => [...l, { k: "erro", id: uid(), texto: m }]),
        fim: () => despachar({ tipo: "fim" }),
      }, ac.signal);
      if (ac.signal.aborted) { despachar({ tipo: "cancelado" }); setItens((l) => [...l, { k: "erro", id: uid(), texto: "Resposta cancelada." }]); }
      else if (lerAlto && ultimoTexto.current) voz.falar(ultimoTexto.current);
    } catch (e) {
      despachar({ tipo: "falha_rede" });
      setItens((l) => [...l, { k: "erro", id: uid(), texto: e instanceof Error ? e.message : "Não foi possível enviar a mensagem." }]);
    } finally {
      setEnviando(false); abortar.current = null; recarregarConversas(); setVersao((v) => v + 1);
    }
  }

  async function excluir(id: string) {
    if (!fonte) return;
    const r = await fonte.chamar("conector-conversas", { loja_id: loja.id, acao: "excluir", conversa_id: id });
    if (!r.ok) { setItens((l) => [...l, { k: "erro", id: uid(), texto: r.erro ?? "Não foi possível excluir a conversa." }]); return; }
    if (id === ativaId) nova();
    recarregarConversas();
  }
  async function renomear(id: string, titulo: string) {
    if (!fonte) return;
    const r = await fonte.chamar("conector-conversas", { loja_id: loja.id, acao: "renomear", conversa_id: id, titulo });
    if (!r.ok) setItens((l) => [...l, { k: "erro", id: uid(), texto: r.erro ?? "Não foi possível renomear." }]); else recarregarConversas();
  }

  if (!fonte) return <p className="suave">Carregando…</p>;
  const painelEsq = esqAberta ? "aberto" : "fechado", painelDir = dirAberta ? "aberto" : "fechado";
  return (
    <div className="conector" data-ctx={ctxVisivel ? "visivel" : "recolhido"} data-esq={painelEsq} data-dir={painelDir}>
      {(esqAberta || dirAberta) && <button className="fundo-painel" aria-label="Fechar painel" onClick={() => { setEsqAberta(false); setDirAberta(false); }} />}
      <PainelConversas conversas={conversas} ativaId={ativaId} documentos={documentos} emAnalise={emAnalise} aoNova={nova} aoSelecionar={(id) => void selecionar(id)}
        aoExcluir={excluir} aoRenomear={renomear} aoEscolherProduto={(id) => { setProdutoId(id); setDirAberta(true); setCtxVisivel(true); }} aoFechar={() => setEsqAberta(false)} />
      <section className="centro" aria-label="Conversa com o Conector IA">
        <header className="cab-chat">
          <button className="sec so-estreito" onClick={() => setEsqAberta(true)} aria-label="Abrir conversas">☰ Conversas</button>
          <Esfera estado={estado} tamanho={48} />
          <div className="cab-texto"><h1>Conector IA</h1><span className="estado" role="status" aria-live="polite">{ROTULO_ESTADO[estado]}</span></div>
          <div className="linha cab-acoes">
            {voz.suporteFala && <label className="linha marcar-linha"><input type="checkbox" checked={lerAlto} onChange={(e) => { setLerAlto(e.target.checked); gravarPreferenciaFala(e.target.checked); if (!e.target.checked) voz.calar(); }} /> <span>Ler respostas</span></label>}
            <button className="sec so-estreito" onClick={() => setDirAberta(true)}>Contexto</button>
            <button className="sec so-largo" aria-expanded={ctxVisivel} aria-label={ctxVisivel ? "Recolher painel de contexto" : "Mostrar painel de contexto"} onClick={() => setCtxVisivel((v) => !v)}>Contexto</button>
          </div>
        </header>
        <div className="mensagens" role="log" aria-live="polite" aria-busy={enviando} aria-label="Mensagens" tabIndex={0}>
          {itens.length === 0 && (
            <div className="vazio-chat">
              <Esfera estado={estado} tamanho={88} comRotulo />
              <h2>Como posso ajudar?</h2>
              <p className="suave">Eu consulto o Bling e o catálogo, pesquiso fontes, preparo propostas com antes/depois e só gravo algo depois da sua aprovação. Nada é inventado: sem fonte, o dado fica “a confirmar”.</p>
              <div className="linha" style={{ justifyContent: "center" }}>{SUGESTOES.map((s) => <button key={s} className="sec" disabled={enviando || !provedor} onClick={() => void enviar(s)}>{s}</button>)}</div>
            </div>
          )}
          {itens.map((it) => {
            switch (it.k) {
              case "user": return <div key={it.id} className="bolha eu">{it.texto}</div>;
              case "ia": return <div key={it.id} className="bolha ia"><Markdown texto={it.texto} />{it.provedor && <span className="quem">{nomeModelo(it.provedor)}{it.modelo ? ` · ${it.modelo}` : ""}</span>}</div>;
              case "aviso": return <p key={it.id} className="aviso-discreto" role="status">{it.texto}</p>;
              case "erro": return <div key={it.id} className="bolha aviso-msg" role="alert">{it.texto}</div>;
              case "ferramenta": return (
                <div key={it.id} className="ferramenta-card" aria-label={`Ferramenta ${it.nome}`}>
                  <span className="mono">{it.nome}</span>
                  {it.risco && <span className={`selo ${it.risco === "LOW" ? "ok" : it.risco === "MEDIUM" ? "" : "atencao"}`}>{it.risco}</span>}
                  {it.rodando ? <span className="selo atencao">em execução…</span> : <span className={`selo ${it.decisao === "negada" ? "erro" : it.decisao === "requer_aprovacao" ? "atencao" : it.ok === false ? "erro" : "ok"}`}>{it.decisao ?? (it.ok === false ? "erro" : "concluída")}</span>}
                  {it.resumo && <span className="suave resumo">{it.resumo}</span>}
                </div>);
              case "proposta": return <CartaoProposta key={it.id} propostaId={it.propostaId} fonte={fonte} lojaId={loja.id} />;
            }
          })}
          {uso && <p className="suave uso">{uso}</p>}
          <div ref={fim} />
        </div>
        <Compositor texto={texto} aoTexto={setTexto} enviando={enviando} aoEnviar={() => void enviar()} aoCancelar={() => abortar.current?.abort()} anexos={anexos} aoAnexos={setAnexos}
          provedores={provedores} provedor={provedor} aoProvedor={setProvedor} capacidades={capacidades} voz={voz} />
      </section>
      {(ctxVisivel || dirAberta) && (
        <PainelContexto fonte={fonte} lojaId={loja.id} produtoId={produtoId} aoEscolher={setProdutoId} versaoDados={versao} aoMudou={() => setVersao((v) => v + 1)}
          aoFechar={() => { setCtxVisivel(false); setDirAberta(false); }} />
      )}
    </div>
  );
}
