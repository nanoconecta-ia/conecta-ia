import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabase.ts";
import type { Loja } from "../lib/dados.ts";
import { mensagemVisibilidade, type RespostaVisibilidade } from "../lib/visibilidade.ts";
import { alternar, alternarTodos, erroAutomacao, mensagemAutomacao, textoLote } from "../lib/automacao.ts";
import { despublicar, publicar } from "../lib/contextoPagina.ts";
import { mapaDoCatalogo } from "../lib/mapaPagina.ts";
import { resumoDoLote } from "../lib/catalogoExperiencia.ts";
import { TAMANHO_LOTE_CATALOGO, expressaoBuscaCatalogo, juntarProdutosPorId, existemMaisProdutos } from "../lib/catalogoPaginacao.ts";
import { Icone } from "../componentes/Icone.tsx";
import { GaleriaProduto } from "../componentes/GaleriaProduto.tsx";
import "./catalogo-workspace.css";
import { IconePeca } from "../componentes/IconePeca.tsx";
import { iconeDaCategoria } from "../lib/icones.ts";
import { pedirAoNanoNaConversa } from "../lib/contextoPagina.ts";
import { publicarSelecao } from "../lib/contextoVivo.ts";
import { montarPedidoCorrecao as montarPedidoCorrecaoCadastro } from "../lib/correcaoCadastro.ts";
import { montarPedidoCorrecao, pendenciasDaFicha } from "../lib/pedidoCorrecao.ts";
import { camposFaltando, contagens, filtrar, ROTULO_FILTRO, semCategoria, situacaoTexto, type Filtro, type LinhaPlanilha } from "../lib/planilha.ts";

type Produto = LinhaPlanilha & {
  preco: number | null; estoque: number | null; publicado: boolean;
  bling_id: string | null; pai_bling_id: string | null; familia_id: string | null;
};
type No = { id: string; pai_id: string | null; nome: string; slug?: string | null };
const FILTROS: Filtro[] = ["todos", "sem_categoria", "incompletos", "inativos", "sem_no"];
const brl = (v: number | null) => (v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));

export function Catalogo({ loja }: { loja: Loja }) {
  const [itens, setItens] = useState<Produto[] | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [pausados, setPausados] = useState<Set<string>>(new Set());
  // Sistema de enriquecimento indexado: o Nano precisa saber o que o lojista seleciona, então o compartilhamento NASCE LIGADO e lembra a escolha (por loja).
  // O interruptor continua visível: o lojista pode desligar, e a escolha dele é respeitada nas próximas sessões.
  const chaveCompartilhar = `nano:contexto:compartilhar:${loja.id}`;
  const [compartilhar, setCompartilharEstado] = useState(() => { try { return localStorage.getItem(chaveCompartilhar) !== "0"; } catch { return true; } });
  const setCompartilhar = (v: boolean) => { setCompartilharEstado(v); try { localStorage.setItem(chaveCompartilhar, v ? "1" : "0"); } catch { /* sem armazenamento: vale só nesta sessão */ } };
  const jaPublicou = useRef(false); // não publica "seleção vazia" só por abrir a tela: isso apagaria o produto aberto pela extensão no Bling
  const [avisoContexto, setAvisoContexto] = useState("");
  const [statusContexto, setStatusContexto] = useState(""); // confirmação REAL do servidor (versão gravada), nunca presumida
  const estadoContexto = useRef({ versao: 0 });
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const buscaInicial = () => {
    const texto = typeof window !== "undefined" ? new URLSearchParams((window.location.hash.split("?")[1] ?? "")).get("q") : null;
    return (texto ?? "").slice(0, 80);
  };
  const [busca, setBusca] = useState(buscaInicial);
  const [buscaAplicada, setBuscaAplicada] = useState(buscaInicial);
  const [totalBanco, setTotalBanco] = useState<number | null>(null);
  const [proximoOffset, setProximoOffset] = useState(0);
  const [ultimoLote, setUltimoLote] = useState(0);
  const [carregando, setCarregando] = useState(false);
  const [erroConsulta, setErroConsulta] = useState("");
  const sequenciaConsulta = useRef(0);
  useEffect(() => {
    if (!compartilhar) return;
    if (!jaPublicou.current && selecionados.size === 0) return;
    jaPublicou.current = true;
    const t = window.setTimeout(() => {
      void publicarSelecao((a) => supabase.rpc("contexto_registrar", a) as unknown as Promise<{ data: unknown; error: unknown }>, loja.id, [...selecionados], estadoContexto.current)
        .then((r) => { setAvisoContexto(r.ok ? "" : `Não foi possível compartilhar a seleção com o Nano agora (${r.erro ?? "erro"}).`); setStatusContexto(r.ok ? (selecionados.size ? `Compartilhado com o Nano: ${selecionados.size} produto(s), versão ${estadoContexto.current.versao}.` : `Compartilhamento ligado; nenhuma seleção (versão ${estadoContexto.current.versao}).`) : ""); });
    }, 400);
    return () => window.clearTimeout(t);
  }, [compartilhar, selecionados, loja.id]);
  const [vista, setVista] = useState<"tabela" | "cartoes">(() =>
    typeof window !== "undefined" && window.matchMedia("(max-width: 760px)").matches ? "cartoes" : "tabela");
  const [fichaId, setFichaId] = useState<string | null>(null);
  const [aplicacoesFicha, setAplicacoesFicha] = useState<{ total: number; aprovadas: number } | null>(null);
  useEffect(() => {
    if (!fichaId) { setAplicacoesFicha(null); return; }
    let ativo = true; setAplicacoesFicha(null);
    const contar = async () => {
      const [a, b] = await Promise.all([
        supabase.from("produto_aplicacoes").select("id", { head:true,count:"exact" })
          .eq("loja_id",loja.id).eq("produto_id",fichaId),
        supabase.from("produto_aplicacoes").select("id", { head:true,count:"exact" })
          .eq("loja_id",loja.id).eq("produto_id",fichaId).eq("status","aprovado"),
      ]);
      if (ativo) setAplicacoesFicha(!a.error && !b.error
        ? { total:a.count ?? 0, aprovadas:b.count ?? 0 } : null);
    };
    void contar();
    return () => { ativo = false; };
  }, [fichaId,loja.id]);
  const [obsFicha, setObsFicha] = useState("");
  const [noSugerido, setNoSugerido] = useState("");
  const [form, setForm] = useState({ marca: "", gtin: "", pesoKg: "", descricaoCurta: "", fonte: "" });
  const [corrigindo, setCorrigindo] = useState(false);
  const [msgCorrecao, setMsgCorrecao] = useState<{ ok: boolean; texto: string } | null>(null);
  const [categorias, setCategorias] = useState<Map<string, string>>(new Map());
  const [nos, setNos] = useState<Map<string, No>>(new Map());
  const carregar = useCallback(async (offset = 0) => {
    // Qualquer nova consulta invalida as respostas anteriores, incluindo troca de loja.
    const chamada = ++sequenciaConsulta.current;
    const inicial = offset === 0;
    setCarregando(true);
    setErroConsulta("");
    if (inicial) {
      setItens(null);
      setTotalBanco(null);
      setProximoOffset(0);
      setUltimoLote(0);
      setSelecionados(new Set());
      setPausados(new Set());
      setCategorias(new Map());
      setNos(new Map());
    }
    const codigoFiltro = expressaoBuscaCatalogo(buscaAplicada);
    let produtosQuery = supabase.from("produtos")
      .select("id, sku, nome, preco, estoque, publicado, marca, gtin, peso_kg, descricao_curta, descricao_complementar, categoria_bling_id, situacao, taxonomia_no_id, bling_id, pai_bling_id, familia_id", { count: "exact" })
      .eq("loja_id", loja.id)
      .order("nome", { ascending: true, nullsFirst: false })
      .order("id", { ascending: true })
      .range(offset, offset + TAMANHO_LOTE_CATALOGO - 1);
    if (codigoFiltro) produtosQuery = produtosQuery.or(codigoFiltro);
    try {
      const [prod, cats, tx] = await Promise.all([
        produtosQuery,
        inicial ? supabase.from("bling_categorias").select("bling_id, nome").eq("loja_id", loja.id).limit(2000) : Promise.resolve(null),
        inicial ? supabase.from("taxonomia_nos").select("id, pai_id, nome, slug").eq("perfil_ramo", loja.perfil_ramo).limit(2000) : Promise.resolve(null),
      ]);
      if (sequenciaConsulta.current !== chamada) return;
      if (prod.error || !Array.isArray(prod.data)) {
        setErroConsulta("Falha ao consultar produtos do espelho. A lista anterior não foi alterada no Bling.");
        return;
      }
      const registros = prod.data as Omit<Produto, "imagens">[];
      const ids = registros.map(p => p.id);
      // Consultar imagens/pausas apenas para os SKUs desta página — nunca carregar a loja inteira.
      const [imagens, pausas] = ids.length ? await Promise.all([
        supabase.from("produto_imagens").select("produto_id").eq("loja_id", loja.id).in("produto_id", ids).limit(5000),
        supabase.from("produto_automacao").select("produto_id").eq("loja_id", loja.id).eq("pausado", true).in("produto_id", ids),
      ]) : [{ data: [], error: null }, { data: [], error: null }];
      if (sequenciaConsulta.current !== chamada) return;
      if (imagens.error || pausas.error) {
        setErroConsulta("Produtos consultados, mas não foi possível conferir todas as imagens ou pausas. Confira antes de publicar.");
      }
      const comImagem = new Map<string, number>();
      for (const img of (imagens.data ?? []) as { produto_id: string }[]) comImagem.set(img.produto_id, (comImagem.get(img.produto_id) ?? 0) + 1);
      const lote = registros.map(p => ({ ...p, imagens: comImagem.get(p.id) ?? 0 }));
      setItens(atual => inicial ? lote : juntarProdutosPorId(atual ?? [], lote));
      setTotalBanco(prod.count ?? null);
      setUltimoLote(registros.length);
      setProximoOffset(offset + registros.length);
      const novosPausados = (pausas.data ?? []).map(x => x.produto_id as string);
      setPausados(atual => inicial ? new Set(novosPausados) : new Set([...atual, ...novosPausados]));
      if (inicial) {
        if (cats?.error || tx?.error) setErroConsulta("Produtos consultados, mas categorias ou taxonomia estão temporariamente indisponíveis.");
        setCategorias(new Map((cats?.data ?? []).map((c: { bling_id: string; nome: string }) => [String(c.bling_id), c.nome])));
        setNos(new Map((tx?.data ?? []).map((n: No) => [n.id, n])));
      }
    } catch {
      if (sequenciaConsulta.current === chamada) setErroConsulta("Não foi possível acessar o espelho. Confira a conexão e tente novamente.");
    } finally {
      if (sequenciaConsulta.current === chamada) setCarregando(false);
    }
  }, [loja.id, loja.perfil_ramo, buscaAplicada]);
  useEffect(() => {
    void carregar(0);
    return () => { sequenciaConsulta.current++; };
  }, [carregar]);
  useEffect(() => {
    const timer = window.setTimeout(() => setBuscaAplicada(busca.trim()), 350);
    return () => window.clearTimeout(timer);
  }, [busca]);
  useEffect(() => { setObsFicha(""); setNoSugerido(""); setForm({ marca: "", gtin: "", pesoKg: "", descricaoCurta: "", fonte: "" }); setMsgCorrecao(null); }, [fichaId]);
  useEffect(() => { setFichaId(null); setSelecionados(new Set()); setBusca(buscaInicial()); setBuscaAplicada(buscaInicial()); }, [loja.id]);
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
    if (!itens || totalBanco === null || itens.length < totalBanco || buscaAplicada !== "") return null;
    const ids = new Set(categorias.keys());
    const faltando: Record<string, number> = {};
    for (const p of itens) for (const f of camposFaltando(p)) faltando[f] = (faltando[f] ?? 0) + 1;
    const porNo = new Map<string, number>();
    for (const p of itens) if (p.taxonomia_no_id) porNo.set(p.taxonomia_no_id, (porNo.get(p.taxonomia_no_id) ?? 0) + 1);
    return mapaDoCatalogo({
      total: itens.length, publicados: itens.filter((p) => p.publicado).length, inativos: itens.filter((p) => p.situacao !== "A").length,
      semCategoria: itens.filter((p) => semCategoria(p, ids)).length, semLugarNaTaxonomia: itens.filter((p) => p.taxonomia_no_id == null).length,
      incompletos: itens.filter((p) => camposFaltando(p).length > 0).length, faltando,
      porNo: [...nos.values()].map((n) => ({ id: n.id, pai_id: n.pai_id, nome: n.nome, slug: n.slug ?? null, produtos: porNo.get(n.id) ?? 0 })),
    });
  }, [itens, categorias, nos, totalBanco, buscaAplicada]);
  useEffect(() => { if (mapa) publicar("/catalogo", "Catálogo", mapa); return () => despublicar("/catalogo"); }, [mapa]);
  const totais = contagens(itens ?? [], idsListados);
  const visiveis = filtrar(itens ?? [], filtro, idsListados);
  const faltamProdutos = itens !== null && existemMaisProdutos(itens.length, totalBanco, ultimoLote);
  const pesquisaPendente = busca.trim() !== buscaAplicada;
  const resumo = resumoDoLote(itens ?? []);
  const ficha = itens?.find((p) => p.id === fichaId) ?? null;
  async function criarPropostaCorrecao() {
    if (!ficha?.sku) { setMsgCorrecao({ ok: false, texto: "Este produto não tem SKU cadastrado." }); return; }
    const pedido = montarPedidoCorrecaoCadastro(form);
    if (!pedido.ok) { setMsgCorrecao({ ok: false, texto: pedido.erro }); return; }
    setCorrigindo(true); setMsgCorrecao(null);
    try {
      const { data, error } = await supabase.functions.invoke("assistente", { body: { loja_id: loja.id, acao: "chat_corrigir_produto", sku: ficha.sku, campos: pedido.campos, fonte: pedido.fonte } });
      if (error) { let m = "Não foi possível criar a proposta."; try { const j = await (error as { context?: Response }).context?.json(); if (typeof j?.erro === "string") m = j.erro; if (Array.isArray(j?.detalhes) && j.detalhes.length) m += " " + j.detalhes.join("; "); } catch { /* mensagem segura */ } setMsgCorrecao({ ok: false, texto: m }); return; }
      setMsgCorrecao({ ok: true, texto: String(data?.resposta ?? "Proposta criada. Aprove na fila.") });
    } finally { setCorrigindo(false); }
  }
  const pedidoDaFicha = (p: Produto, sugerido = "") => ({ taxonomiaSugerida: sugerido ? nomeNo(sugerido) : undefined, sku: p.sku, nome: p.nome, marca: p.marca, gtin: p.gtin, peso_kg: p.peso_kg, imagens: p.imagens, categoria: categorias.get(p.categoria_bling_id ?? "") ?? null, taxonomia: p.taxonomia_no_id ? nomeNo(p.taxonomia_no_id) : null, descricaoVazia: camposFaltando(p).includes("descrição") });
  const idsVisiveis = visiveis.map((p) => p.id);
  const nomeNo = (id: string | null) => {
    const n = id ? nos.get(id) : undefined;
    if (!n) return "—";
    const pai = n.pai_id ? nos.get(n.pai_id) : undefined;
    return pai ? `${pai.nome} › ${n.nome}` : n.nome;
  };

  return (
    <div className={ficha ? "catalogo-workspace catalogo-workspace--com-ficha" : "catalogo-workspace"}>
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
        <label className="catalogo-pesquisa"><span>Buscar por SKU, nome, marca ou GTIN em todo o espelho</span>
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
      <p className="catalogo-informacao" role="note"><Icone nome="escudo" tamanho={18} /><span>A pesquisa é feita no espelho da <strong>sua loja</strong> em lotes de 100. Os indicadores e filtros técnicos mostram apenas os produtos <strong>já carregados</strong>; use "Carregar mais" para continuar. Custos e fornecedores não são exibidos. Publicação e pausa continuam sob aprovação do lojista.</span></p>
      <div className="catalogo-resultados" role="status">{itens === null ? "Consultando o espelho…" : `${visiveis.length} filtrado(s) entre ${itens.length} carregado(s)${totalBanco !== null ? ` · ${totalBanco.toLocaleString("pt-BR")} encontrado(s) na busca do servidor` : ""}`}{pesquisaPendente ? " · atualizando pesquisa…" : ""}</div>
      {erroConsulta && <div className="msg-erro" role="alert">{erroConsulta} <button type="button" className="sec" onClick={() => void carregar(0)}>Tentar novamente</button></div>}
      {msg && <p className={msg.ok ? "msg-ok" : "msg-erro"} role="status">{msg.texto}</p>}
      <label className="linha marcar-linha"><input type="checkbox" checked={compartilhar} onChange={(e) => { setCompartilhar(e.target.checked); setAvisoContexto(""); setStatusContexto(""); }} /><span>Compartilhando a seleção com o Nano (ligado por padrão; some em 30 min). Assim ele sabe qual produto você selecionou, sem digitar o SKU. Só id do produto; nada é gravado no Bling.</span></label>
      {avisoContexto && <p className="msg-erro" role="alert">{avisoContexto}</p>}
      {compartilhar && !avisoContexto && statusContexto && <p className="msg-ok" role="status">{statusContexto}</p>}
      {selecionados.size > 0 && (
        <div className="linha" role="group" aria-label="Ações para os produtos selecionados">
          <strong>{textoLote(selecionados.size)} selecionado(s)</strong>
          <button className="sec" disabled={ocupado === "lote"} onClick={() => void automacao(true)}>Parar cadastro automático</button>
          <button className="sec" disabled={ocupado === "lote"} onClick={() => void automacao(false)}>Retomar cadastro automático</button>
        </div>
      )}
      {itens === null ? <p className="suave">Carregando…</p> : itens.length === 0 ? <p className="suave">Nenhum produto encontrado nesta pesquisa. Confira a busca ou a conexão com o Bling.</p> : visiveis.length === 0 ? <p className="suave">Nenhum produto corresponde à busca e ao filtro selecionados.</p> : vista === "tabela" ? (
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
              <nav className="catalogo-produto-trilha" aria-label={"Vínculos de " + (p.nome ?? p.sku ?? "produto")}>
                <a href="#/bling">Bling · origem</a>
                <button type="button" onClick={() => setFichaId(p.id)}>Conecta.IA · aplicações</button>
                {p.publicado && p.sku
                  ? <a href={`#/p/${encodeURIComponent(loja.slug)}/${encodeURIComponent(p.sku)}`}>Loja · cliente</a>
                  : <span title="Requer aprovação e publicação">Loja não liberada</span>}
              </nav>
            </article>
          ))}
        </div>
      )}
      {faltamProdutos && (
        <div className="catalogo-paginacao" role="group" aria-label="Paginação do Catálogo">
          <span>Exibindo ${itens?.length ?? 0}${totalBanco !== null ? ` de ${totalBanco.toLocaleString("pt-BR")}` : ""} produtos retornados pela busca.</span>
          <button type="button" className="sec" disabled={carregando || pesquisaPendente} onClick={() => void carregar(proximoOffset)}>
            {carregando ? "Carregando…" : "Carregar mais 100"}
          </button>
        </div>
      )}
      {ficha && (
        <div className="catalogo-ficha-fundo" role="presentation">
          <section role="dialog" aria-modal="false" aria-labelledby="catalogo-ficha-titulo" className="catalogo-ficha">
            <div className="catalogo-ficha-topo"><span>FICHA ADMINISTRATIVA · ESPELHO BLING</span><button type="button" className="sec" onClick={() => setFichaId(null)} aria-label="Fechar ficha técnica"><Icone nome="fechar" tamanho={20}/></button></div>
            <h2 id="catalogo-ficha-titulo">{ficha.nome ?? "Produto sem nome"}</h2>
            <p className="catalogo-ficha-sku">SKU: <strong>{ficha.sku ?? "não cadastrado"}</strong> · {situacaoTexto(ficha.situacao)}</p>
            <section className="catalogo-trilha" aria-label="Três camadas vinculadas deste produto">
              <h3>Vínculos do produto: Bling → Conecta.IA → Loja</h3>
              <p>Um único cadastro físico. As aplicações por veículo são filhas técnicas verificadas;
                os anúncios públicos não criam cópias de estoque.</p>
              <div className="catalogo-trilha-etapas">
                <div><strong>01 · Bling — produto pai físico/fiscal</strong>
                  <small>Referência ERP: {ficha.bling_id ?? "não identificada"}</small>
                  <small>Registro pai no Bling: {ficha.pai_bling_id ?? "sem vínculo pai legado"}</small>
                  <a className="sec" href="#/bling">Abrir vínculo ERP</a>
                </div>
                <div><strong>02 · Conecta.IA — aplicações e filhos técnicos</strong>
                  <small>Família: {ficha.familia_id ? "vinculada" : "não definida"}</small>
                  <small>Categoria: {nomeNo(ficha.taxonomia_no_id)}</small>
                  <small>Aplicações aprovadas: {aplicacoesFicha ? aplicacoesFicha.aprovadas : "a consultar"}</small>
                  <small>Outras aplicações em revisão: {aplicacoesFicha ? aplicacoesFicha.total - aplicacoesFicha.aprovadas : "a consultar"}</small>
                  <a className="sec" href="#/taxonomia">Revisar taxonomia e aplicações</a>
                </div>
                <div><strong>03 · Loja — oferta vinculada ao mesmo SKU</strong>
                  <small>Status: {ficha.publicado ? "publicado" : "não publicado"}</small>
                  <small>Disponibilidade e preço são confirmados pelo atendimento, sem baixa de estoque por esta tela.</small>
                  {ficha.publicado && ficha.sku
                    ? <a className="sec" href={`#/p/${encodeURIComponent(loja.slug)}/${encodeURIComponent(ficha.sku)}`}>Visualizar ficha do cliente</a>
                    : <span className="catalogo-trilha-bloqueio">Ficha pública indisponível até aprovação e publicação.</span>}
                </div>
              </div>
              <a className="catalogo-trilha-revisar" href="#/fila">Abrir fila de revisão antes de publicar</a>
            </section>
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
            <div className="catalogo-ficha-tax">
              <strong>Posição na taxonomia</strong>
              <p className="catalogo-ficha-caminho"><IconePeca nome={iconeDaCategoria(nos.get(ficha.taxonomia_no_id ?? "")?.slug, nos.get(ficha.taxonomia_no_id ?? "")?.nome)} tamanho={24} /> <span>{nomeNo(ficha.taxonomia_no_id)}</span></p>
              <label>Propor outra posição
                <select value={noSugerido} onChange={(e) => setNoSugerido(e.target.value)}>
                  <option value="">Manter a atual</option>
                  {[...nos.values()].filter((n) => !n.pai_id).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")).map((raiz) => (
                    <optgroup key={raiz.id} label={raiz.nome}>
                      {[...nos.values()].filter((n) => n.pai_id === raiz.id).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")).map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
                    </optgroup>
                  ))}
                </select>
              </label>
              <small>Isto não grava nada: a posição escolhida vai no pedido ao Nano, que propõe com fonte e você aprova na fila.</small>
            </div>
            <GaleriaProduto key={ficha.id} loja={loja} produtoId={ficha.id} sku={ficha.sku} aoFechar={() => setFichaId(null)} />
            <div className="catalogo-ficha-pendencias">
              <strong>Campos faltando no espelho</strong>
              <p>{camposFaltando(ficha).length ? camposFaltando(ficha).join(" · ") : "Nenhuma das lacunas básicas detectadas. Aplicações e equivalências exigem comprovação independente."}</p>
            </div>
            <p className="catalogo-ficha-ressalva">As informações acima vêm do espelho interno; não provam compatibilidade com outros modelos, referências OEM ou procedência. Preço de custo, fornecedor e dados fiscais não são exibidos.</p>
            <div className="catalogo-ficha-correcao">
              <strong>Corrigir este produto com o Nano.IA</strong>
              <p>{pendenciasDaFicha(pedidoDaFicha(ficha)).length ? `${pendenciasDaFicha(pedidoDaFicha(ficha)).length} pendência(s) vão no pedido. O Nano pesquisa, propõe com fonte e data, e você aprova na fila; ele não grava no Bling.` : "Sem pendências básicas; você ainda pode pedir uma conferência."}</p>
              <label>O que você sabe sobre ele (opcional; entra como hipótese, sem fonte)
                <textarea value={obsFicha} maxLength={600} rows={2} onChange={(e) => setObsFicha(e.target.value)} placeholder="Ex.: acho que o fabricante é…" />
              </label>
              <button type="button" onClick={() => { pedirAoNanoNaConversa(montarPedidoCorrecao({ ...pedidoDaFicha(ficha, noSugerido), observacaoLojista: obsFicha })); setFichaId(null); }}><Icone nome="agentes" tamanho={18}/> Pedir correção ao Nano.IA</button>
            </div>
            <div className="catalogo-ficha-corrigir">
              <strong>Corrigir o cadastro agora (sem IA)</strong>
              <p>Preencha só o que você sabe e a fonte. Isto cria uma <b>proposta</b>: nada é gravado no Bling até você aprovar na fila.</p>
              <div className="catalogo-ficha-corrigir-campos">
                <label>Marca (fabricante real)<input value={form.marca} maxLength={80} onChange={(e) => setForm({ ...form, marca: e.target.value })} placeholder="Não use IMPORTADO ou NACIONAL" /></label>
                <label>GTIN/EAN<input value={form.gtin} inputMode="numeric" maxLength={14} onChange={(e) => setForm({ ...form, gtin: e.target.value })} /></label>
                <label>Peso líquido (kg)<input value={form.pesoKg} inputMode="decimal" maxLength={10} onChange={(e) => setForm({ ...form, pesoKg: e.target.value })} /></label>
                <label>Descrição curta (só texto)<textarea value={form.descricaoCurta} rows={3} maxLength={500} onChange={(e) => setForm({ ...form, descricaoCurta: e.target.value })} /></label>
                <label>Fonte (URL do fabricante ou documento) *<input value={form.fonte} maxLength={500} onChange={(e) => setForm({ ...form, fonte: e.target.value })} placeholder="https://…" /></label>
              </div>
              <button type="button" disabled={corrigindo} onClick={() => void criarPropostaCorrecao()}>{corrigindo ? "Criando…" : "Criar proposta de correção"}</button>
              {msgCorrecao && <p role="status" className={msgCorrecao.ok ? "correcao-ok" : "correcao-erro"}>{msgCorrecao.texto}{msgCorrecao.ok && <> <a href="#/fila" onClick={() => setFichaId(null)}>Abrir aprovações</a></>}</p>}
            </div>
            <div className="catalogo-ficha-links"><a href="#/assistente" onClick={() => setFichaId(null)}><Icone nome="agentes" tamanho={18}/> Consultar Nano.IA</a><a href="#/fila" onClick={() => setFichaId(null)}>Abrir aprovações</a></div>
          </section>
        </div>
      )}
    </div>
  );
}
