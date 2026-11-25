import { useEffect, useState } from "react";
import { supabase } from "../supabase.ts";
import type { Loja } from "../lib/dados.ts";
import { GaleriaProduto } from "../componentes/GaleriaProduto.tsx";
import { MidiasPendentesMcp } from "../componentes/MidiasPendentesMcp.tsx";

type Item = { id: string; campo: string; valor: unknown; fonte: string | null; confianca: number | null; produtos: { sku: string | null; nome: string | null } | null };
type Imagem = { id: string; produto_id: string; url: string; origem: string | null; produtos: { sku: string | null; nome: string | null } | null };
type AplicacaoPendente = {
  id: string; produto_id: string; modelo: string; motorizacao: string | null;
  ano_inicial: number | null; ano_final: number | null; fonte: string | null;
  confianca: number | null; produtos: { sku: string | null; nome: string | null } | null;
};

const texto = (v: unknown) => (typeof v === "string" ? v : JSON.stringify(v));

/** Fila de aprovação: tudo que o agente propôs fica "a confirmar" até você decidir. */
export function Fila({ loja }: { loja: Loja }) {
  const [itens, setItens] = useState<Item[] | null>(null);
  const [imagens, setImagens] = useState<Imagem[] | null>(null);
  const [aplicacoes, setAplicacoes] = useState<AplicacaoPendente[] | null>(null);
  const [erroAplicacoes, setErroAplicacoes] = useState("");
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState("");
  const [podeDecidir, setPodeDecidir] = useState<boolean | null>(null);
  const [produtoEmRevisao, setProdutoEmRevisao] = useState<string | null>(null);
  const carregar = () => {
    supabase.from("produto_enriquecimento").select("id, campo, valor, fonte, confianca, produtos(sku, nome)")
      .eq("loja_id", loja.id).eq("status", "a_confirmar").order("criado_em", { ascending: false }).limit(200)
      .then(({ data }) => setItens((data ?? []) as unknown as Item[]));
    supabase.from("produto_aplicacoes")
      .select("id, produto_id, modelo, motorizacao, ano_inicial, ano_final, fonte, confianca, produtos(sku, nome)")
      .eq("loja_id", loja.id).eq("status", "a_confirmar")
      .order("criado_em", { ascending: false }).limit(200)
      .then(({ data, error }) => {
        setErroAplicacoes(error ? "Não foi possível carregar as aplicações em revisão." : "");
        setAplicacoes(error ? null : (data ?? []) as unknown as AplicacaoPendente[]);
      });
    supabase.from("produto_imagens").select("id, produto_id, url, origem, produtos(sku, nome)")
      .eq("loja_id", loja.id).eq("aprovada", false).is("removida_em", null).order("criado_em", { ascending: false }).limit(100)
      .then(({ data }) => setImagens((data ?? []) as unknown as Imagem[]));
  };
  useEffect(() => { void carregar(); }, [loja.id]);
  // Só o lojista decide; o editor vê a fila mas os botões ficam desligados (o servidor também recusa).
  useEffect(() => { supabase.rpc("pode_administrar_loja", { p_loja_id: loja.id }).then(({ data }) => setPodeDecidir(data === true)); }, [loja.id]);
  const negado = (error: unknown) => (error as { context?: { status?: number } } | null)?.context?.status === 403;

  async function decidir(id: string, decisao: "aprovar" | "rejeitar") {
    setOcupado(id); setErro("");
    const { error } = await supabase.functions.invoke("assistente", { body: { loja_id: loja.id, acao: "decidir", id, decisao } });
    setOcupado("");
    if (error) setErro(negado(error) ? "Só o responsável (lojista) da loja pode aprovar ou rejeitar." : "Não foi possível registrar a decisão."); else void carregar();
  }
  const grupos = new Map<string, { id: string; sku: string | null; nome: string | null; total: number }>();
  for (const imagem of imagens ?? []) {
    const atual = grupos.get(imagem.produto_id);
    if (atual) atual.total += 1;
    else grupos.set(imagem.produto_id, {
      id: imagem.produto_id,
      sku: imagem.produtos?.sku ?? null,
      nome: imagem.produtos?.nome ?? null,
      total: 1,
    });
  }
  const gruposOrdenados = [...grupos.values()];
  const selecionado = grupos.get(produtoEmRevisao ?? "");
  return (
    <div className="cartao">
      <h1>Fila de aprovação</h1>
      <p className="suave">Cada dado mostra de onde veio e com que confiança. Nada vai para o site nem para o Bling sem a sua decisão.</p>
      {podeDecidir === false && <p className="suave">Você pode acompanhar a fila, mas só o responsável (lojista) da loja aprova ou rejeita.</p>}
      {erro && <p className="msg-erro">{erro}</p>}
      {itens === null ? <p className="suave">Carregando…</p> : itens.length === 0 ? <p className="suave">Nada aguardando aprovação.</p> : (
        <div className="rolagem"><table>
          <thead><tr><th>Produto</th><th>Campo</th><th>Valor proposto</th><th>Fonte</th><th>Conf.</th><th /></tr></thead>
          <tbody>{itens.map((i) => (
            <tr key={i.id}>
              <td><span className="mono">{i.produtos?.sku ?? "sem SKU"}</span><br /><span className="suave">{i.produtos?.nome}</span></td>
              <td>{i.campo}</td><td>{texto(i.valor)}</td>
              <td className="suave mono">{i.fonte ?? "—"}</td><td>{i.confianca != null ? `${Math.round(i.confianca * 100)}%` : "—"}</td>
              <td className="linha">
                <button disabled={ocupado === i.id || !i.fonte || podeDecidir !== true} onClick={() => void decidir(i.id, "aprovar")}>Aprovar</button>
                <button className="perigo" disabled={ocupado === i.id || podeDecidir !== true} onClick={() => void decidir(i.id, "rejeitar")}>Rejeitar</button>
              </td>
            </tr>))}</tbody>
        </table></div>
      )}

      <h2>Aplicações veiculares aguardando homologação</h2>
      <p className="suave">Cada veículo e versão pertence ao mesmo SKU físico, mas exige confirmação técnica própria. Esta seção é somente para conferência: aprovação depende de evidências e de uma ação autorizada no porteiro. Nenhum botão aqui altera o cadastro ou publica compatibilidade.</p>
      {erroAplicacoes && <p className="msg-erro">{erroAplicacoes}</p>}
      {aplicacoes === null ? <p className="suave">{erroAplicacoes ? "Consulte a integração antes de decidir." : "Carregando aplicações…"}</p>
        : aplicacoes.length === 0 ? <p className="suave">Nenhuma aplicação veicular aguardando homologação.</p>
        : <div className="rolagem"><table>
            <thead><tr><th>SKU / Produto</th><th>Veículo</th><th>Motorização</th><th>Anos da proposta</th><th>Fonte da candidatura</th><th>Situação</th></tr></thead>
            <tbody>{aplicacoes.map((a) => <tr key={a.id}>
              <td><span className="mono">{a.produtos?.sku ?? "sem SKU"}</span><br/><span className="suave">{a.produtos?.nome ?? "Produto não identificado"}</span></td>
              <td>{a.modelo}</td><td>{a.motorizacao ?? "Não informada"}</td>
              <td>{a.ano_inicial ?? "?"} – {a.ano_final ?? "não comprovado"}<br/><small className="suave">Período de aplicação a conferir, não é fim de fabricação</small></td>
              <td className="suave">{a.fonte ?? "Fonte ausente — bloqueada"}{a.confianca != null ? <small> · confiança declarada {Math.round(a.confianca * 100)}%</small> : null}</td>
              <td><strong>A confirmar</strong><br/><small className="suave">Sem publicação ou homologação automática</small></td>
            </tr>)}</tbody>
          </table></div>}

      <h2>Imagens propostas · escolha até 8 por produto</h2>
      <p className="suave">Escolha a peça para abrir sua grade visual, comparar as fotos e decidir uma de cada vez. Pesquisa e preparação não aprovam direitos nem publicam imagens. As candidatas continuam relacionadas ao mesmo ID Bling.</p>
      {imagens === null ? <p className="suave">Carregando…</p> : gruposOrdenados.length === 0
        ? <p className="suave">Nenhuma imagem aguardando decisão.</p>
        : <div className="gs-fila-produtos" role="group" aria-label="Produtos com fotos pendentes">
            {gruposOrdenados.map(g => (
              <button type="button" key={g.id} className={`sec gs-fila-escolher ${produtoEmRevisao === g.id ? "gs-fila-ativo" : ""}`}
                aria-pressed={produtoEmRevisao === g.id}
                onClick={() => setProdutoEmRevisao(g.id)}>
                <strong>{g.sku ?? "sem SKU"} · {g.nome ?? "Produto sem nome"}</strong>
                <span>{g.total} foto(s) a conferir · selecionar galeria</span>
              </button>
            ))}
          </div>}
      {selecionado && (
        <div className="gs-fila-revisao">
          <h3>Revisão das fotos de {selecionado.sku ?? "produto sem SKU"}</h3>
          <GaleriaProduto loja={loja} produtoId={selecionado.id} sku={selecionado.sku} aoDecidir={carregar}/>
        </div>
      )}
      <MidiasPendentesMcp loja={loja} />
    </div>
  );
}
