import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase.ts";
import type { Loja } from "../lib/dados.ts";
import { caminhoAte, contar, montarArvore, type No, type NoComTotais } from "../lib/arvore.ts";
import { iconeDaCategoria } from "../lib/icones.ts";
import { IconePeca } from "../componentes/IconePeca.tsx";
import { vistaDaArea } from "../lib/vistas.ts";
import { VistaExplodida } from "../componentes/VistaExplodida.tsx";
import { SincroniaBling } from "../componentes/SincroniaBling.tsx";
import { conferir, type CategoriaBling, type Ligacao } from "../lib/taxonomiaBling.ts";
import { eixoDaRaiz, indicePecas, pct, sinaisVeiculo, sugerirPeca, type NoPeca, type Sugestao, type TermoVeiculo } from "../lib/lentesTaxonomia.ts";
import "./taxonomia.css";

type Produto = { id: string; sku: string | null; nome: string | null; marca: string | null; situacao: string | null; publicado: boolean; taxonomia_no_id: string | null };
type Montadora = { id: string; nome: string };
type Modelo = { id: string; montadora_id: string; nome: string };
type Motor = { id: string; codigo: string };
type Dados = {
  nos: No[]; produtos: Produto[]; categoriasBling: CategoriaBling[]; ligacoes: Ligacao[];
  montadoras: Montadora[]; modelos: Modelo[]; motores: Motor[]; aplicacoes: number;
};
type Lente = "pecas" | "veiculos" | "marcas" | "fila";
type ItemFila = { p: Produto; sugestao: Sugestao | null; sinais: TermoVeiculo[] };

const LENTES: { id: Lente; rotulo: string; ajuda: string }[] = [
  { id: "pecas", rotulo: "Peças", ajuda: "Sistema e tipo de peça" },
  { id: "veiculos", rotulo: "Veículos", ajuda: "Montadora, modelo e motor" },
  { id: "marcas", rotulo: "Marcas", ajuda: "Fabricante da peça" },
  { id: "fila", rotulo: "Fila", ajuda: "Sem classificação" },
];
const POR_PAGINA = 40;

function Coluna({ titulo, itens, ativoId, aoEscolher }: { titulo: string; itens: NoComTotais[]; ativoId: string | null; aoEscolher: (n: NoComTotais) => void }) {
  return (
    <section className="esp-coluna" aria-label={titulo}>
      <h2>{titulo}</h2>
      <ul>
        {itens.map((n) => (
          <li key={n.id}>
            <button className={`esp-no ${n.id === ativoId ? "ativo" : ""}`} onClick={() => aoEscolher(n)} aria-current={n.id === ativoId ? "true" : undefined}>
              <IconePeca nome={iconeDaCategoria(n.slug, n.nome)} tamanho={28} />
              <span className="esp-nome">{n.nome}</span>
              <span className="esp-contagem mono" title={`${n.produtos} produto(s) no Conecta`}>{n.produtos}</span>
              {n.filhos.length > 0 && <span className="esp-seta" aria-hidden="true">›</span>}
            </button>
          </li>
        ))}
        {!itens.length && <li className="suave">Nada aqui.</li>}
      </ul>
    </section>
  );
}

/** Anel de progresso (SVG): parte classificada do catálogo. */
function Anel({ valor }: { valor: number }) {
  const r = 52, c = 2 * Math.PI * r;
  return (
    <svg className="tx-anel" viewBox="0 0 128 128" role="img" aria-label={`${valor}% do catálogo classificado`}>
      <circle cx="64" cy="64" r={r} className="tx-anel-fundo" />
      <circle cx="64" cy="64" r={r} className="tx-anel-valor" strokeDasharray={`${(c * valor) / 100} ${c}`} transform="rotate(-90 64 64)" />
      <text x="64" y="62" textAnchor="middle" className="tx-anel-num">{valor}%</text>
      <text x="64" y="82" textAnchor="middle" className="tx-anel-rot">classificado</text>
    </svg>
  );
}

function Indicador({ rotulo, valor, tom, nota }: { rotulo: string; valor: number | string; tom?: "ok" | "atencao" | "erro"; nota?: string }) {
  return (
    <div className={`tx-ind ${tom ? `tx-${tom}` : ""}`}>
      <span className="tx-ind-valor mono">{valor}</span>
      <span className="tx-ind-rot">{rotulo}</span>
      {nota && <span className="tx-ind-nota">{nota}</span>}
    </div>
  );
}

/** Taxonomia por LENTES (issue #297): o mesmo catálogo visto por peça, por veículo, por marca e pela fila sem classificação. Somente leitura. */
export function Taxonomia({ loja }: { loja: Loja }) {
  const [dados, setDados] = useState<Dados | null>(null);
  const [lente, setLente] = useState<Lente>("pecas");
  const [sel, setSel] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<"todos" | "com" | "sem">("todos");
  const [soAtivos, setSoAtivos] = useState(true);
  const [limite, setLimite] = useState(POR_PAGINA);

  useEffect(() => {
    let vivo = true;
    void (async () => {
      const [n, p, b, cb, mo, md, mt, ap] = await Promise.all([
        supabase.from("taxonomia_nos").select("id, pai_id, nome, slug, ordem").eq("perfil_ramo", loja.perfil_ramo).order("ordem").order("nome"),
        supabase.from("produtos").select("id, sku, nome, marca, situacao, publicado, taxonomia_no_id").eq("loja_id", loja.id).limit(10000),
        supabase.from("bling_categoria_taxonomia").select("bling_categoria_id, taxonomia_no_id").eq("loja_id", loja.id),
        supabase.from("bling_categorias").select("bling_id, nome, pai_bling_id").eq("loja_id", loja.id).limit(2000),
        supabase.from("montadoras").select("id, nome").order("nome"),
        supabase.from("modelos").select("id, montadora_id, nome").order("nome"),
        supabase.from("motores").select("id, codigo").order("codigo"),
        supabase.from("produto_aplicacoes").select("id", { count: "exact" }).eq("loja_id", loja.id).limit(1),
      ]);
      if (!vivo) return;
      setDados({
        nos: (n.data ?? []) as No[], produtos: (p.data ?? []) as Produto[],
        ligacoes: (b.data ?? []) as Ligacao[], categoriasBling: (cb.data ?? []) as CategoriaBling[],
        montadoras: (mo.data ?? []) as Montadora[], modelos: (md.data ?? []) as Modelo[], motores: (mt.data ?? []) as Motor[], aplicacoes: ap.count ?? 0,
      });
    })();
    return () => { vivo = false; };
  }, [loja.id, loja.perfil_ramo]);

  const v = useMemo(() => {
    if (!dados) return null;
    const porNo = contar(dados.produtos, (x) => x.taxonomia_no_id);
    const raizes = montarArvore(dados.nos, porNo, contar(dados.ligacoes as { taxonomia_no_id: string }[], (x) => x.taxonomia_no_id));
    const raizesPeca = raizes.filter((r) => eixoDaRaiz(r.nome) === "peca");
    const idsFila = new Set<string>();
    const juntar = (no: NoComTotais) => { idsFila.add(no.id); no.filhos.forEach(juntar); };
    raizes.filter((r) => eixoDaRaiz(r.nome) === "fila").forEach(juntar);
    const nosPeca: NoPeca[] = [];
    const descer = (no: NoComTotais, trilha: string[], prof: number) => { const t = [...trilha, no.nome]; nosPeca.push({ id: no.id, nome: no.nome, caminho: t.join(" › "), profundidade: prof }); no.filhos.forEach((f) => descer(f, t, prof + 1)); };
    raizesPeca.forEach((r) => descer(r, [], 0));
    const indice = indicePecas(nosPeca);
    const montadoraDe = new Map(dados.montadoras.map((m) => [m.id, m.nome]));
    const termos: TermoVeiculo[] = [
      ...dados.modelos.map((m) => ({ tipo: "modelo" as const, id: m.id, rotulo: m.nome, grupo: montadoraDe.get(m.montadora_id) ?? "Outras" })),
      ...dados.motores.map((m) => ({ tipo: "motor" as const, id: m.id, rotulo: m.codigo, grupo: "Motores" })),
    ];
    const naFila = (p: Produto) => !p.taxonomia_no_id || idsFila.has(p.taxonomia_no_id);
    const fila: ItemFila[] = dados.produtos.filter(naFila).map((p) => ({ p, sugestao: sugerirPeca(p.nome ?? "", indice), sinais: sinaisVeiculo(p.nome ?? "", termos) }))
      .sort((a, b) => (a.p.nome ?? "").localeCompare(b.p.nome ?? "", "pt-BR"));
    // Veículos: produtos cujo NOME cita o modelo/motor cadastrado (candidato pelo nome; não é aplicação homologada).
    const porTermo = new Map<string, number>();
    for (const p of dados.produtos) for (const s of sinaisVeiculo(p.nome ?? "", termos)) porTermo.set(s.id, (porTermo.get(s.id) ?? 0) + 1);
    const veiculos = dados.montadoras.map((m) => {
      const modelos = dados.modelos.filter((x) => x.montadora_id === m.id).map((x) => ({ ...x, citados: porTermo.get(x.id) ?? 0 })).sort((a, b) => b.citados - a.citados || a.nome.localeCompare(b.nome, "pt-BR"));
      return { ...m, modelos, citados: modelos.reduce((s, x) => s + x.citados, 0) };
    }).sort((a, b) => b.citados - a.citados || a.nome.localeCompare(b.nome, "pt-BR"));
    const motores = dados.motores.map((m) => ({ ...m, citados: porTermo.get(m.id) ?? 0 })).sort((a, b) => b.citados - a.citados || a.codigo.localeCompare(b.codigo));
    const marcas = [...contar(dados.produtos, (p) => (p.marca ?? "").trim() || "Sem marca informada")].map(([nome, total]) => ({ nome, total })).sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, "pt-BR"));
    const total = dados.produtos.length, classificados = total - fila.length;
    return {
      raizes, raizesPeca, fila, veiculos, motores, marcas, total, classificados,
      comSugestao: fila.filter((f) => f.sugestao).length, filaAtivos: fila.filter((f) => f.p.situacao === "A").length,
      publicados: dados.produtos.filter((p) => p.publicado).length, semMarca: dados.produtos.filter((p) => !(p.marca ?? "").trim()).length,
      maxPeca: Math.max(1, ...raizesPeca.map((r) => r.produtos)), maxMarca: Math.max(1, ...marcas.map((m) => m.total)),
    };
  }, [dados]);

  const conferencia = useMemo(() => (dados ? conferir(dados.nos, dados.categoriasBling, dados.ligacoes) : null), [dados]);
  const trilha = useMemo(() => caminhoAte(v?.raizesPeca ?? [], sel), [v, sel]);
  const atual = trilha.at(-1) ?? null;
  const filaVisivel = useMemo(() => {
    if (!v) return [];
    const b = busca.trim().toLowerCase();
    return v.fila.filter((f) => (!soAtivos || f.p.situacao === "A") && (filtro === "todos" || (filtro === "com") === !!f.sugestao)
      && (!b || (f.p.nome ?? "").toLowerCase().includes(b) || (f.p.sku ?? "").toLowerCase().includes(b)));
  }, [v, busca, filtro, soAtivos]);

  return (
    <div className="janela" aria-label="Taxonomia do catálogo">
      <div className="janela-barra">
        <span className="janela-pontos" aria-hidden="true"><i /><i /><i /></span>
        <span className="janela-aba"><IconePeca nome="motor" tamanho={18} /> Taxonomia</span>
        <code className="janela-endereco">conecta.ia/taxonomia/{loja.perfil_ramo}/{lente}{lente === "pecas" ? trilha.map((t) => `/${t.slug}`).join("") : ""}</code>
      </div>
      <div className="janela-corpo">
        {!dados || !v ? <p className="suave">Carregando…</p> : (
          <>
            <header className="tx-hero">
              <Anel valor={pct(v.classificados, v.total)} />
              <div className="tx-hero-texto">
                <h1>Taxonomia do catálogo</h1>
                <p className="suave">Um produto físico, três formas de achar: pela <strong>peça</strong>, pelo <strong>veículo</strong> e pela <strong>marca</strong>. Somente leitura: nada aqui grava no Bling.</p>
                <div className="tx-inds">
                  <Indicador rotulo="produtos no espelho" valor={v.total} />
                  <Indicador rotulo="sem classificação" valor={v.fila.length} tom={v.fila.length ? "atencao" : "ok"} nota={`${v.filaAtivos} ativos`} />
                  <Indicador rotulo="com sugestão pelo nome" valor={v.comSugestao} tom="ok" nota="aguardam revisão" />
                  <Indicador rotulo="aplicações homologadas" valor={dados.aplicacoes} tom={dados.aplicacoes ? "ok" : "erro"} nota={dados.aplicacoes ? undefined : "nenhuma ainda"} />
                  <Indicador rotulo="publicados no site" valor={v.publicados} tom={v.publicados ? "ok" : "erro"} />
                </div>
              </div>
            </header>

            <nav className="tx-lentes" role="tablist" aria-label="Lentes da taxonomia">
              {LENTES.map((l) => (
                <button key={l.id} role="tab" aria-selected={lente === l.id} className={`sec tx-lente ${lente === l.id ? "ativa" : ""}`} onClick={() => setLente(l.id)}>
                  <span className="tx-lente-rot">{l.rotulo}</span>
                  <span className="tx-lente-ajuda">{l.ajuda}</span>
                  {l.id === "fila" && v.fila.length > 0 && <span className="tx-selo mono">{v.fila.length}</span>}
                </button>
              ))}
            </nav>

            {lente === "pecas" && (
              <section className="tx-painel" role="tabpanel" aria-label="Peças">
                <div className="tx-cartoes">
                  {v.raizesPeca.map((r) => (
                    <button key={r.id} className={`sec tx-cartao ${trilha[0]?.id === r.id ? "ativo" : ""} ${r.produtos ? "" : "vazio"}`} onClick={() => setSel(r.id)}>
                      <IconePeca nome={iconeDaCategoria(r.slug, r.nome)} tamanho={40} />
                      <span className="tx-cartao-nome">{r.nome}</span>
                      <span className="tx-cartao-num mono">{r.produtos}</span>
                      <span className="tx-barra" aria-hidden="true"><i style={{ width: `${pct(r.produtos, v.maxPeca)}%` }} /></span>
                      <span className="tx-cartao-sub">{r.filhos.length} subcategorias</span>
                    </button>
                  ))}
                </div>
                {trilha.length > 0 && (
                  <div className="esp-colunas">
                    {trilha.map((t, i) => (
                      <Coluna key={t.id} titulo={t.nome} itens={t.filhos} ativoId={trilha[i + 1]?.id ?? null} aoEscolher={(n) => setSel(n.id)} />
                    ))}
                    <aside className="esp-detalhe" aria-label="Detalhe do nó">
                      {atual && (
                        <>
                          <IconePeca nome={iconeDaCategoria(atual.slug, atual.nome)} tamanho={72} titulo={atual.nome} />
                          <h2>{atual.nome}</h2>
                          <p className="mono suave">{atual.slug}</p>
                          <dl className="dados">
                            <dt>Produtos no Conecta</dt><dd>{atual.produtos}</dd>
                            <dt>Categorias do Bling ligadas</dt><dd>{atual.categoriasBling}</dd>
                            <dt>Subcategorias</dt><dd>{atual.filhos.length}</dd>
                          </dl>
                          {vistaDaArea(trilha[0]?.slug) && (
                            <VistaExplodida vista={vistaDaArea(trilha[0]?.slug)!} ativo={atual.slug} aoEscolher={(slug) => { const n = dados.nos.find((x) => x.slug === slug); if (n) setSel(n.id); }} />
                          )}
                          <p className="aviso-discreto">Só leitura. Quando falta um nó, o agente propõe um novo e você aprova na fila.</p>
                        </>
                      )}
                    </aside>
                  </div>
                )}
              </section>
            )}

            {lente === "veiculos" && (
              <section className="tx-painel" role="tabpanel" aria-label="Veículos">
                <p className="tx-aviso"><strong>Candidato pelo nome.</strong> Os números contam produtos cujo nome cita o modelo ou o motor. Isso não é aplicação homologada: {dados.aplicacoes} aplicação(ões) com fonte registrada até agora.</p>
                <div className="tx-veiculos">
                  {v.veiculos.map((m) => (
                    <article key={m.id} className={`tx-montadora ${m.citados ? "" : "vazio"}`}>
                      <header><h2>{m.nome}</h2><span className="tx-selo mono">{m.citados}</span></header>
                      <ul>
                        {m.modelos.map((x) => (
                          <li key={x.id}><span>{x.nome}</span><span className="tx-barra" aria-hidden="true"><i style={{ width: `${pct(x.citados, Math.max(1, m.modelos[0]?.citados ?? 1))}%` }} /></span><span className="mono">{x.citados}</span></li>
                        ))}
                        {!m.modelos.length && <li className="suave">Nenhum modelo cadastrado.</li>}
                      </ul>
                    </article>
                  ))}
                </div>
                <h2 className="tx-sub">Motores citados nos nomes</h2>
                <div className="tx-chips">
                  {v.motores.map((m) => <span key={m.id} className={`tx-chip ${m.citados ? "" : "vazio"}`}><span className="mono">{m.codigo}</span><b className="mono">{m.citados}</b></span>)}
                </div>
              </section>
            )}

            {lente === "marcas" && (
              <section className="tx-painel" role="tabpanel" aria-label="Marcas">
                <p className="tx-aviso">Marca do cadastro no Bling (campo estruturado). {v.semMarca} produto(s) sem marca informada.</p>
                <ul className="tx-ranking">
                  {v.marcas.map((m) => (
                    <li key={m.nome} className={m.nome === "Sem marca informada" ? "tx-atencao" : ""}>
                      <span className="tx-rank-nome">{m.nome}</span>
                      <span className="tx-barra" aria-hidden="true"><i style={{ width: `${pct(m.total, v.maxMarca)}%` }} /></span>
                      <span className="mono">{m.total}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {lente === "fila" && (
              <section className="tx-painel" role="tabpanel" aria-label="Fila sem classificação">
                <p className="tx-aviso"><strong>Sugestão pelo nome, sem IA.</strong> A categoria sugerida é a que aparece escrita no nome do produto. Nada foi gravado: a classificação só muda com a sua aprovação.</p>
                <div className="tx-filtros">
                  <input type="search" value={busca} onChange={(e) => { setBusca(e.target.value); setLimite(POR_PAGINA); }} placeholder="Buscar por nome ou SKU" aria-label="Buscar na fila" />
                  <div className="tx-seg" role="group" aria-label="Filtrar por sugestão">
                    {([["todos", "Todos"], ["com", "Com sugestão"], ["sem", "Sem sinal"]] as const).map(([id, r]) => (
                      <button key={id} className={`sec mini ${filtro === id ? "ativo" : ""}`} aria-pressed={filtro === id} onClick={() => { setFiltro(id); setLimite(POR_PAGINA); }}>{r}</button>
                    ))}
                  </div>
                  <label className="marcar tx-check"><input type="checkbox" checked={soAtivos} onChange={(e) => setSoAtivos(e.target.checked)} /> Só ativos</label>
                  <span className="suave mono">{filaVisivel.length} item(ns)</span>
                </div>
                <ul className="tx-fila">
                  {filaVisivel.slice(0, limite).map(({ p, sugestao, sinais }) => (
                    <li key={p.id} className={sugestao ? "" : "tx-sem-sinal"}>
                      <div className="tx-fila-id">
                        <span className="mono tx-sku">{p.sku ?? "sem SKU"}</span>
                        {p.situacao !== "A" && <span className="tx-tag">inativo</span>}
                      </div>
                      <div className="tx-fila-nome">
                        <span>{p.nome ?? "(sem nome)"}</span>
                        <span className="tx-fila-meta">
                          {p.marca && <span className="tx-tag">{p.marca}</span>}
                          {sinais.map((s) => <span key={s.tipo + s.id} className={`tx-tag tx-${s.tipo}`}>{s.rotulo}</span>)}
                        </span>
                      </div>
                      <div className="tx-fila-sug">
                        {sugestao ? <><span className="tx-seta" aria-hidden="true">→</span><span>{sugestao.caminho}</span></> : <span className="suave">Sem sinal no nome: revisar à mão</span>}
                      </div>
                    </li>
                  ))}
                  {!filaVisivel.length && <li className="suave">Nada na fila com esse filtro.</li>}
                </ul>
                {filaVisivel.length > limite && <button className="sec" onClick={() => setLimite((l) => l + POR_PAGINA)}>Mostrar mais {Math.min(POR_PAGINA, filaVisivel.length - limite)}</button>}
              </section>
            )}
          </>
        )}
        {conferencia && lente === "pecas" && <SincroniaBling c={conferencia} />}
      </div>
    </div>
  );
}
