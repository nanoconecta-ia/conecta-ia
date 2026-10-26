import { useCallback, useEffect, useState } from "react";
import { supabase } from "../supabase.ts";
import type { Loja } from "../lib/dados.ts";
import { mensagemVisibilidade, type RespostaVisibilidade } from "../lib/visibilidade.ts";
import { alternar, alternarTodos, erroAutomacao, mensagemAutomacao, textoLote } from "../lib/automacao.ts";
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
  const totais = contagens(itens ?? [], idsListados);
  const visiveis = filtrar(itens ?? [], filtro, idsListados);
  const idsVisiveis = visiveis.map((p) => p.id);
  const nomeNo = (id: string | null) => {
    const n = id ? nos.get(id) : undefined;
    if (!n) return "—";
    const pai = n.pai_id ? nos.get(n.pai_id) : undefined;
    return pai ? `${pai.nome} › ${n.nome}` : n.nome;
  };

  return (
    <div className="cartao">
      <h1>Catálogo</h1>
      <p className="suave">Espelho somente leitura do Bling, como uma planilha: cada linha é um produto do seu Bling e as colunas mostram o que já veio de lá. A coluna <strong>Falta</strong> mostra o que está vazio no cadastro, para a IA propor e você aprovar. O produto só aparece na loja quando você clica em <strong>Mostrar no site</strong>. Produto incompleto não pode ser mostrado.</p>
      <div className="linha" role="group" aria-label="Filtrar produtos">
        {FILTROS.map((f) => (
          <button key={f} className={filtro === f ? "" : "sec"} aria-pressed={filtro === f} onClick={() => { setFiltro(f); setSelecionados(new Set()); }}>
            {ROTULO_FILTRO[f]} ({totais[f]})
          </button>
        ))}
      </div>
      <p className="suave">Para reforçar a qualidade do cadastro, marque um produto ou vários e use <strong>Parar cadastro automático</strong>: nenhum agente propõe dados neles até você retomar. O Bling continua sendo a fonte e nada é apagado.</p>
      {msg && <p className={msg.ok ? "msg-ok" : "msg-erro"} role="status">{msg.texto}</p>}
      {selecionados.size > 0 && (
        <div className="linha" role="group" aria-label="Ações para os produtos selecionados">
          <strong>{textoLote(selecionados.size)} selecionado(s)</strong>
          <button className="sec" disabled={ocupado === "lote"} onClick={() => void automacao(true)}>Parar cadastro automático</button>
          <button className="sec" disabled={ocupado === "lote"} onClick={() => void automacao(false)}>Retomar cadastro automático</button>
        </div>
      )}
      {itens === null ? <p className="suave">Carregando…</p> : itens.length === 0 ? <p className="suave">Nenhum produto sincronizado ainda. Conecte o Bling.</p> : visiveis.length === 0 ? <p className="suave">Nenhum produto neste filtro.</p> : (
        <div className="rolagem">
          <table>
            <thead><tr><th><input type="checkbox" aria-label="Selecionar todos" checked={idsVisiveis.length > 0 && idsVisiveis.every((i) => selecionados.has(i))} onChange={() => setSelecionados(alternarTodos(selecionados, idsVisiveis))} style={{ width: 20, minHeight: 20 }} /></th><th>SKU</th><th>Nome</th><th>Marca</th><th>Categoria no Bling</th><th>Lugar na taxonomia</th><th>Preço</th><th>Estoque</th><th>Falta</th><th>Site</th></tr></thead>
            <tbody>{visiveis.map((p) => (
              <tr key={p.id}><td><input type="checkbox" aria-label={`Selecionar ${p.sku ?? p.nome ?? "produto"}`} checked={selecionados.has(p.id)} onChange={() => setSelecionados(alternar(selecionados, p.id))} style={{ width: 20, minHeight: 20 }} /></td><td className="mono">{p.sku ?? "—"}</td><td>{p.nome ?? "—"}{p.situacao !== "A" && <>{" "}<span className="selo atencao">{situacaoTexto(p.situacao)}</span></>}{pausados.has(p.id) && <>{" "}<span className="selo atencao">automação parada</span></>}</td><td>{p.marca ?? "—"}</td>
                <td>{semCategoria(p, idsListados) ? <span className="selo atencao">sem categoria</span> : categorias.get(p.categoria_bling_id ?? "") ?? "—"}</td><td>{p.taxonomia_no_id ? nomeNo(p.taxonomia_no_id) : <span className="selo atencao">sem lugar</span>}</td><td>{brl(p.preco)}</td><td>{p.estoque ?? "—"}</td>
                <td>{camposFaltando(p).length === 0 ? <span className="selo ok">completo</span> : camposFaltando(p).join(", ")}</td>
                <td>
                  <span className={`selo ${p.publicado ? "ok" : "atencao"}`}>{p.publicado ? "visível" : "oculto"}</span>{" "}
                  {p.publicado
                    ? <button className="sec" disabled={ocupado === p.id} onClick={() => void alterar(p, false)}>Ocultar do site</button>
                    : <button disabled={ocupado === p.id} onClick={() => void alterar(p, true)}>Mostrar no site</button>}
                </td></tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
