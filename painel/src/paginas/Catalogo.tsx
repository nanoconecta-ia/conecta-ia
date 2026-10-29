import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase.ts";
import type { Loja } from "../lib/dados.ts";
import { mensagemVisibilidade, type RespostaVisibilidade } from "../lib/visibilidade.ts";
import { alternar, alternarTodos, erroAutomacao, mensagemAutomacao, textoLote } from "../lib/automacao.ts";
import { despublicar, publicar } from "../lib/contextoPagina.ts";
import { mapaDoCatalogo } from "../lib/mapaPagina.ts";
import { pesquisarProdutos, resumoDoLote } from "../lib/catalogoExperiencia.ts";
import { Icone } from "../componentes/Icone.tsx";
import "./catalogo-workspace.css";
import { camposFaltando, contagens, filtrar, ROTULO_FILTRO, semCategoria, situacaoTexto, type Filtro, type LinhaPlanilha } from "../lib/planilha.ts";

type Produto = LinhaPlanilha & { preco: number | null; estoque: number | null; publicado: boolean };
type No = { id: string; pai_id: string | null; nome: string };
const FILTROS: Filtro[] = ["todos", "sem_categoria", "incompletos", "inativos", "sem_no"];
const brl = (v: number | null) => (v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));

export function Catalogo({ loja }: { loja: Loja }) {
  const [itens, setItens] = useState<Produto[] | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [pausados, setPausados] = useState<Set<string>>(new Set());
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [busca, setBusca] = useState("");
  const [vista, setVista] = useState<"tabela" | "cartoes">(() =>
    typeof window !== "undefined" && window.matchMedia("(max-width: 760px)").matches ? "cartoes" : "tabela");
  const [fichaId, setFichaId] = useState<string | null>(null);
  const [categorias, setCategorias] = useState<Map<string, string>>(new Map());
  const [nos, setNos] = useState<Map<string, No>>(new Map());
  const carregar = useCallback(async () => {
    const [{ data }, { data: cats }, { data: tx }, { data: imgs }] = await Promise.all([
      supabase.from("produtos").select("id, sku, nome, preco, estoque, publicado, marca, gtin, peso_kg, descricao_curta, descricao_complementar, categoria_bling_id, situacao, taxonomia_no_id").eq("loja_id", loja.id).order("nome").limit(500),
      supabase.from("bling_categorias").select("bling_id, nome").eq("loja_id", loja.id).limit(2000),
      supabase.from("taxonomia_nos").select("id, pai_id, nome").eq("perfil_ramo", loja.perfil_ramo).limit(2000),
      supabase.from("produto_imagens").select("produto_id").eq("loja_id", loja.id).limit(5000),
    ]);
    setCategorias(new Map((cats ?? []).map((c: { bling_id: string; nome: string }) => [c.bling_id, c.nome])));
    setNos(new Map((tx ?? []).map((n: No) => [n.id, n])));
    const comImagem = new Map<string, number>();
    for (const i of (imgs ?? []) as { produto_id: string }[]) comImagem.set(i.produto_id, (comImagem.get(i.produto_id) ?? 0) + 1);
    setItens(((data ?? []) as Omit<Produto, "imagens">[]).map((p) => ({ ...p, imagens: comImagem.get(p.id) ?? 0 })));
    const { data: pz } = await supabase.from("produto_automacao").select("produto_id").eq("loja_id", loja.id).eq("pausado", true);
    setPausados(new Set((pz ?? []).map((x: { produto_id: string }) => x.produto_id)));
  }, [loja.id]);
  useEffect(() => { void carregar(); }, [carregar]);
  useEffect(() => { setFichaId(null); setSelecionados(new Set()); setBusca(""); }, [loja.id]);
  useEffect(() => {
    if (!fichaId) return;
    const aoTeclar = (e: KeyboardEvent) => { if (e.key === "Escape") setFichaId(null); };
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [fichaId]);

  async function alterar(p: Produto, publicar: boolean) {
    setOcupado(p.id); setMsg(null);
    const { data, error } = await supabase.rpc("produto_visibilidade", { p_produto: p.id, p_publicar: publicar });
    setOcupado(null);
    if (error) setMsg({ ok: false, texto: error.code === "42501" ? "Só o lojista da loja pode mostrar ou ocultar produtos." : "Não foi possível atualizar o produto." });
    else { setMsg(mensagemVisibilidade(data as RespostaVisibilidade, publicar)); void carregar(); }
  }

  async function automacao(pausar: boolean) {
    const ids = [...selecionados];
    if (ids.length === 0) return;
    setOcupado("lote"); setMsg(null);
    const { error } = await supabase.rpc("automacao_pausar", { p_produtos: ids, p_pausar: pausar, p_motivo: null });
    setOcupado(null);
    if (error) setMsg({ ok: false, texto: erroAutomacao(error.code, ids.length) });
    else { setMsg({ ok: true, texto: mensagemAutomacao(pausar, ids.length) }); setSelecionados(new Set()); void carregar(); }
  }
  const idsListados = new Set(categorias.keys());
  const mapa = useMemo(() => {
    if (!itens) return null;
    const ids = new Set(categorias.keys());
    const faltando: Record<string, number> = {};
    for (const p of itens) for (const f of camposFaltando(p)) faltando[f] = (faltando[f] ?? 0) + 1;
    const porNo = new Map<string, number>();
    for (const p of itens) if (p.taxonomia_no_id) porNo.set(p.taxonomia_no_id, (porNo.get(p.taxonomia_no_id) ?? 0) + 1);
    return mapaDoCatalogo({
      total: itens.length, publicados: itens.filter((p) => p.publicado).length, inativos: itens.filter((p) => p.situacao !== "A").length,
      semCategoria: itens.filter((p) => semCategoria(p, ids)).length, semLugarNaTaxonomia: itens.filter((p) => p.taxonomia_no_id == null).length,
      incompletos: itens.filter((p) => camposFaltando(p).length > 0).length, faltando,
      porNo: [...nos.values()].map((n) => ({ id: n.id, pai_id: n.pai_id, nome: n.nome, produtos: porNo.get(n.id) ?? 0 })),
    });
  }, [itens, categorias, nos]);
  useEffect(() => { if (mapa) publicar("/catalogo", "Catálogo", mapa); return () => despublicar("/catalogo"); }, [mapa]);
  const totais = contagens(itens ?? [], idsListados);
  const visiveis = pesquisarProdutos(filtrar(itens ?? [], filtro, idsListados), busca);
  const resumo = resumoDoLote(itens ?? []);
  const ficha = itens?.find((p) => p.id === fichaId) ?? null;
  const idsVisiveis = visiveis.map((p) => p.id);
  const nomeNo = (id: string | null) => {
    const n = id ? nos.get(id) : undefined;
    if (!n) return "—";
    const pai = n.pai_id ? nos.get(n.pai_id) : undefined;
    return pai ? `${pai.nome} › ${n.nome}` : n.nome;
  };

  return (
    <div className="catalogo-workspace">
      <header className="catalogo-intro">
        <div>
          <span className="catalogo-sobretitulo"><Icone nome="catalogo" tamanho={16} /> INTELIGÊNCIA DE PRODUTOS · ERP BLING</span>
          <h1>Catálogo <em>técnico.</em></h1>
          <p>Explore os produtos espelhados, identifique campos pendentes e abra a ficha de cada peça. O Bling é a fonte oficial; o Nano.IA propõe complementos, sujeitos à aprovação.</p>
        </div>
        <a className="catalogo-abrir-bling" href="#/bling"><Icone nome="erp" tamanho={19} /> Conexão Bling</a>
      </header>
      <section className="catalogo-resumo" aria-label="Indicadores do lote carregado">
        <div><Icone nome="catalogo" tamanho={22}/><strong>{itens === null ? "…" : resumo.carregados.toLocaleString("pt-BR")}</strong><span>Produtos carregados</span></div>
        <div><Icone nome="loja" tamanho={22}/><strong>{itens === null ? "…" : resumo.publicados.toLocaleString("pt-BR")}</strong><span>Na vitrine</span></div>
        <div><Icone nome="escudo" tamanho={22}/><strong>{itens === null ? "…" : resumo.inativos.toLocaleString("pt-BR")}</strong><span>Inativos/excluídos</span></div>
        <div><Icone nome="imagem" tamanho={22}/><strong>{itens === null ? "…" : resumo.semImagem.toLocaleString("pt-BR")}</strong><span>Sem imagem no espelho</span></div>
      </section>
      <div className="catalogo-barra">
        <label className="catalogo-pesquisa"><span>Buscar no lote carregado</span>
          <div><Icone nome="busca" tamanho={19} /><input type="search" aria-label="Buscar produto por SKU, nome, marca ou GTIN" placeholder="SKU, nome, marca ou GTIN…" value={busca} onChange={(e) => { setBusca(e.target.value); setSelecionados(new Set()); }} /></div>
        </label>
        <div className="catalogo-modos" role="group" aria-label="Modo de visualização">
          <button type="button" className={vista === "tabela" ? "ativo" : ""} aria-pressed={vista === "tabela"} onClick={() => setVista("tabela")}><Icone nome="fila" tamanho={17} /> Tabela</button>
          <button type="button" className={vista === "cartoes" ? "ativo" : ""} aria-pressed={vista === "cartoes"} onClick={() => setVista("cartoes")}><Icone nome="caixas" tamanho={17} /> Cartões</button>
        </div>
      </div>
      <div className="catalogo-filtros" role="group" aria-label="Filtrar produtos">
        {FILTROS.map((f) => (
          <button key={f} className={filtro === f ? "" : "sec"} aria-pressed={filtro === f} onClick={() => { setFiltro(f); setSelecionados(new Set()); }}>
            {ROTULO_FILTRO[f]} ({totais[f]})
          </button>
        ))}
      </div>
      <p className="catalogo-informacao" role="note"><Icone nome="escudo" tamanho={18} /><span>Esta pesquisa considera apenas os <strong>até 500 produtos carregados</strong> do espelho. Valores de custo e fornecedores não são exibidos. A publicação no site e a pausa de automação continuam sendo decisões explícitas do lojista.</span></p>
      <div className="catalogo-resultados" role="status">{itens === null ? "Consultando o espelho…" : `${visiveis.length} produto(s) nesta visualização · ${itens.length} carregado(s)`}</div>
      {msg && <p className={msg.ok ? "msg-ok" : "msg-erro"} role="status">{msg.texto}</p>}
      {selecionados.size > 0 && (
        <div className="linha" role="group" aria-label="Ações para os produtos selecionados">
          <strong>{textoLote(selecionados.size)} selecionado(s)</strong>
          <button className="sec" disabled={ocupado === "lote"} onClick={() => void automacao(true)}>Parar cadastro automático</button>
          <button className="sec" disabled={ocupado === "lote"} onClick={() => void automacao(false)}>Retomar cadastro automático</button>
        </div>
      )}
      {itens === null ? <p className="suave">Carregando…</p> : itens.length === 0 ? <p className="suave">Nenhum produto sincronizado ainda. Confira a conexão com o Bling.</p> : visiveis.length === 0 ? <p className="suave">Nenhum produto corresponde à busca e ao filtro selecionados.</p> : vista === "tabela" ? (
        <div className="rolagem catalogo-rolagem">
          <table>
            <thead><tr><th><input type="checkbox" aria-label="Selecionar todos" checked={idsVisiveis.length > 0 && idsVisiveis.every((i) => selecionados.has(i))} onChange={() => setSelecionados(alternarTodos(selecionados, idsVisiveis))} style={{ width: 20, minHeight: 20 }} /></th><th>SKU</th><th>Nome</th><th>Marca</th><th>Categoria no Bling</th><th>Lugar na taxonomia</th><th>Preço</th><th>Estoque</th><th>Falta</th><th>Ficha</th><th>Site</th></tr></thead>
            <tbody>{visiveis.map((p) => (
              <tr key={p.id}><td><input type="checkbox" aria-label={`Selecionar ${p.sku ?? p.nome ?? "produto"}`} checked={selecionados.has(p.id)} onChange={() => setSelecionados(alternar(selecionados, p.id))} style={{ width: 20, minHeight: 20 }} /></td><td className="mono">{p.sku ?? "—"}</td><td>{p.nome ?? "—"}{p.situacao !== "A" && <>{" "}<span className="selo atencao">{situacaoTexto(p.situacao)}</span></>}{pausados.has(p.id) && <>{" "}<span className="selo atencao">automação parada</span></>}</td><td>{p.marca ?? "—"}</td>
                <td>{semCategoria(p, idsListados) ? <span className="selo atencao">sem categoria</span> : categorias.get(p.categoria_bling_id ?? "") ?? "—"}</td><td>{p.taxonomia_no_id ? nomeNo(p.taxonomia_no_id) : <span className="selo atencao">sem lugar</span>}</td><td>{brl(p.preco)}</td><td>{p.estoque ?? "—"}</td>
                <td>{camposFaltando(p).length === 0 ? <span className="selo ok">sem lacunas verificadas</span> : camposFaltando(p).join(", ")}</td>
                <td><button type="button" className="sec" onClick={() => setFichaId(p.id)}>Ver ficha</button></td>
                <td>
                  <span className={`selo ${p.publicado ? "ok" : "atencao"}`}>{p.publicado ? "visível" : "oculto"}</span>{" "}
                  {p.publicado
                    ? <button className="sec" disabled={ocupado === p.id} onClick={() => void alterar(p, false)}>Ocultar do site</button>
                    : <button disabled={ocupado === p.id} onClick={() => void alterar(p, true)}>Mostrar no site</button>}
                </td></tr>
            ))}</tbody>
          </table>
        </div>
      ) : (
        <div className="catalogo-grade" aria-label="Produtos em cartões">
          {visiveis.map((p) => (
            <article className="catalogo-produto" key={p.id}>
              <div className="catalogo-produto-topo">
                <span className="catalogo-produto-icone" aria-hidden="true"><Icone nome="catalogo" tamanho={29}/></span>
                <span className={`selo ${p.situacao === "A" ? "ok" : "atencao"}`}>{situacaoTexto(p.situacao)}</span>
              </div>
              <span className="catalogo-sku">{p.sku ?? "SKU não cadastrado"}</span>
              <h2>{p.nome ?? "Produto sem nome"}</h2>
              <span className="catalogo-marca">{p.marca ?? "Marca pendente"}</span>
              <div className="catalogo-produto-numeros">
                <div><small>Preço no espelho</small><strong>{brl(p.preco)}</strong></div>
                <div><small>Estoque no espelho</small><strong>{p.estoque ?? "—"}</strong></div>
              </div>
              <div className="catalogo-produto-avisos">
                <span className={`selo ${p.publicado ? "ok" : "atencao"}`}>{p.publicado ? "Visível no site" : "Oculto no site"}</span>
                {pausados.has(p.id) && <span className="selo atencao">Automação pausada</span>}
                {camposFaltando(p).length > 0 && <span className="selo atencao">Falta: {camposFaltando(p).slice(0,3).join(", ")}{camposFaltando(p).length > 3 ? "…" : ""}</span>}
              </div>
              <div className="catalogo-produto-acoes">
                <label><input type="checkbox" checked={selecionados.has(p.id)} onChange={() => setSelecionados(alternar(selecionados, p.id))} /> Selecionar</label>
                <button type="button" className="sec" onClick={() => setFichaId(p.id)}>Ver ficha técnica</button>
              </div>
            </article>
          ))}
        </div>
      )}
      {ficha && (
        <div className="catalogo-ficha-fundo" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setFichaId(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="catalogo-ficha-titulo" className="catalogo-ficha">
            <div className="catalogo-ficha-topo"><span>FICHA ADMINISTRATIVA · ESPELHO BLING</span><button type="button" className="sec" onClick={() => setFichaId(null)} aria-label="Fechar ficha técnica"><Icone nome="fechar" tamanho={20}/></button></div>
            <h2 id="catalogo-ficha-titulo">{ficha.nome ?? "Produto sem nome"}</h2>
            <p className="catalogo-ficha-sku">SKU: <strong>{ficha.sku ?? "não cadastrado"}</strong> · {situacaoTexto(ficha.situacao)}</p>
            <dl className="catalogo-ficha-campos">
              <div><dt>Marca</dt><dd>{ficha.marca ?? "Pendente"}</dd></div>
              <div><dt>GTIN/EAN</dt><dd>{ficha.gtin ?? "Pendente"}</dd></div>
              <div><dt>Preço de venda espelhado</dt><dd>{brl(ficha.preco)}</dd></div>
              <div><dt>Estoque espelhado</dt><dd>{ficha.estoque ?? "—"}</dd></div>
              <div><dt>Categoria Bling</dt><dd>{categorias.get(ficha.categoria_bling_id ?? "") ?? "Sem categoria validada"}</dd></div>
              <div><dt>Taxonomia</dt><dd>{nomeNo(ficha.taxonomia_no_id)}</dd></div>
              <div><dt>Peso cadastrado</dt><dd>{ficha.peso_kg != null && ficha.peso_kg > 0 ? `${ficha.peso_kg.toLocaleString("pt-BR")} kg` : "Pendente"}</dd></div>
              <div><dt>Imagens registradas</dt><dd>{ficha.imagens}</dd></div>
            </dl>
            <div className="catalogo-ficha-pendencias">
              <strong>Campos faltando no espelho</strong>
              <p>{camposFaltando(ficha).length ? camposFaltando(ficha).join(" · ") : "Nenhuma das lacunas básicas detectadas. Aplicações e equivalências exigem comprovação independente."}</p>
            </div>
            <p className="catalogo-ficha-ressalva">As informações acima vêm do espelho interno; não provam compatibilidade com outros modelos, referências OEM ou procedência. Preço de custo, fornecedor e dados fiscais não são exibidos.</p>
            <div className="catalogo-ficha-links"><a href="#/assistente" onClick={() => setFichaId(null)}><Icone nome="agentes" tamanho={18}/> Consultar Nano.IA</a><a href="#/fila" onClick={() => setFichaId(null)}>Abrir aprovações</a></div>
          </section>
        </div>
      )}
    </div>
  );
}
