import { useCallback, useEffect, useState } from "react";
import { supabase } from "../supabase.ts";
import type { Loja } from "../lib/dados.ts";
import "./midias-pendentes-mcp.css";

type MidiaPendente = {
  id: string; loja_id: string; produto_id: string; sku: string;
  finalidade: "foto_produto" | "banner"; status: "a_confirmar" | "aprovada" | "rejeitada";
  titulo: string | null; aplicacao_id: string | null; origem: string | null;
  direitos_declarados: string; nome_arquivo: string | null;
  storage_bucket: string; storage_path: string; mime: string; tamanho_bytes: number;
  largura_px: number; altura_px: number; sha256: string; criado_em: string;
};

const CAMPOS = "id,loja_id,produto_id,sku,finalidade,status,titulo,aplicacao_id,origem,direitos_declarados,nome_arquivo,storage_bucket,storage_path,mime,tamanho_bytes,largura_px,altura_px,sha256,criado_em";

/** Fila privada do plugin MCP: visualização assinada, confirmação de identidade/direitos e decisão do lojista. */
export function MidiasPendentesMcp({ loja }: { loja: Loja }) {
  const [linhas, setLinhas] = useState<MidiaPendente[] | null>(null);
  const [selecionada, setSelecionada] = useState<string>("");
  const [urlTemporaria, setUrlTemporaria] = useState("");
  const [pagina, setPagina] = useState("");
  const [identidadeConferida, setIdentidadeConferida] = useState(false);
  const [direitosConferidos, setDireitosConferidos] = useState(false);
  const [observacao, setObservacao] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [podeAprovar, setPodeAprovar] = useState<boolean | null>(null);

  const carregar = useCallback(async () => {
    const r = await supabase.from("conecta_midia_pendentes")
      .select(CAMPOS).eq("loja_id", loja.id).eq("status", "a_confirmar")
      .order("criado_em", { ascending: false }).limit(100);
    if (r.error) {
      setErro("Não foi possível carregar os anexos MCP. Confira as permissões da loja.");
      setLinhas([]);
      return;
    }
    setLinhas((r.data ?? []) as unknown as MidiaPendente[]);
  }, [loja.id]);
  useEffect(() => {
    void carregar();
    void supabase.rpc("pode_administrar_loja", { p_loja_id: loja.id })
      .then(({ data }) => setPodeAprovar(data === true));
  }, [carregar, loja.id]);

  const atual = linhas?.find((i) => i.id === selecionada) ?? null;
  useEffect(() => {
    setUrlTemporaria(""); setPagina(""); setIdentidadeConferida(false);
    setDireitosConferidos(false); setObservacao(""); setErro(""); setSucesso("");
    if (!atual?.aplicacao_id) return;
    let vivo = true;
    void supabase.from("produto_aplicacoes")
      .select("pagina_titulo,pagina_slug,modelo")
      .eq("id", atual.aplicacao_id).eq("loja_id", loja.id)
      .eq("produto_id", atual.produto_id).eq("status", "aprovado").maybeSingle()
      .then(({ data }) => {
        if (vivo) setPagina(data ? `${data.pagina_titulo || data.modelo || "Veículo"} · #/a/${data.pagina_slug}` : "Aplicação não comprovada. Não aprove.");
      });
    return () => { vivo = false; };
  }, [atual?.id, atual?.aplicacao_id, atual?.produto_id, loja.id]);

  async function mostrarOriginal() {
    if (!atual || ocupado) return;
    setOcupado(true); setErro(""); setUrlTemporaria("");
    const { data, error } = await supabase.storage.from("agente-anexos").createSignedUrl(atual.storage_path, 120);
    setOcupado(false);
    if (error || !data?.signedUrl) { setErro("Não foi possível abrir a imagem privada. Confira a permissão de lojista e tente novamente."); return; }
    setUrlTemporaria(data.signedUrl);
  }
  async function decidir(acao: "aprovar" | "rejeitar") {
    if (!atual || ocupado || podeAprovar !== true) return;
    if (acao === "aprovar" && (!urlTemporaria || !identidadeConferida || !direitosConferidos)) {
      setErro("Abra a imagem e confirme a identidade da peça/arte e os direitos antes de aprovar.");
      return;
    }
    setOcupado(true); setErro(""); setSucesso("");
    const { data, error } = await supabase.rpc("conecta_midia_decidir", {
      p_loja: loja.id, p_midia: atual.id, p_acao: acao,
      p_criado_em: atual.criado_em, p_confirmou_direitos: acao === "aprovar" && direitosConferidos,
      p_observacao: observacao.slice(0, 500) || null,
    });
    setOcupado(false);
    if (error || !(data as { ok?: boolean } | null)?.ok) {
      setErro("A decisão não foi gravada. A mídia pode ter mudado ou sua conta não tem permissão de lojista.");
      return;
    }
    setSelecionada(""); setUrlTemporaria("");
    setSucesso(acao === "aprovar" ? "Mídia aprovada SOMENTE para uso interno. Não foi publicada." : "Mídia rejeitada. Nenhum arquivo foi publicado.");
    void carregar();
  }

  return <section className="cartao mcp-midias" aria-labelledby="mcp-midias-titulo">
    <h2 id="mcp-midias-titulo">Anexos MCP · fotos e banners</h2>
    <p className="suave">Arquivos enviados por agentes ficam em armazenamento privado. A decisão é individual e <strong>não publica no site nem altera o Bling</strong>.</p>
    {podeAprovar === false && <p className="msg-erro">Somente o lojista autorizado pode visualizar e decidir sobre os anexos privados.</p>}
    {erro && <p className="msg-erro" role="alert">{erro}</p>}
    {sucesso && <p role="status" className="selo ok">{sucesso}</p>}
    {linhas === null ? <p className="suave">Consultando a fila privada…</p> : linhas.length === 0 ?
      <p className="suave">Nenhum anexo MCP aguardando aprovação.</p> :
      <div className="mcp-midias-lista" role="group" aria-label="Mídias aguardando revisão">
        {linhas.map(i => <button key={i.id} type="button" className="sec mcp-midia-item"
          aria-pressed={selecionada === i.id} disabled={podeAprovar !== true || ocupado}
          onClick={() => setSelecionada(i.id)}>
          <strong>{i.sku} · {i.finalidade === "foto_produto" ? "Foto real do produto" : "Banner"}</strong>
          <span>{i.titulo ?? i.nome_arquivo ?? "Imagem sem título"} · {new Date(i.criado_em).toLocaleString("pt-BR")}</span>
        </button>)}
      </div>}
    {atual && podeAprovar && <div className="mcp-midia-revisao">
      <h3>Revisar {atual.finalidade === "foto_produto" ? "foto técnica" : "arte comercial"} · {atual.sku}</h3>
      <p className="suave">Origem declarada: {atual.origem || "não informada"} · Direitos declarados: {atual.direitos_declarados.replaceAll("_", " ")}</p>
      {atual.aplicacao_id ? <p><strong>Aplicação vinculada:</strong> {pagina || "Conferindo a página aprovada…"}</p> : atual.finalidade === "banner" ?
        <p>Banner institucional (sem aplicação específica de veículo).</p> : null}
      <p className="suave">{atual.largura_px} × {atual.altura_px} px · {(atual.tamanho_bytes/1024).toFixed(0)} KB · SHA-256 <span className="mono">{atual.sha256}</span></p>
      <div className="linha"><button className="sec" type="button" disabled={ocupado} onClick={() => void mostrarOriginal()}>
        {urlTemporaria ? "Recarregar original (2 min)" : "Abrir original para conferência"}
      </button></div>
      {urlTemporaria && <figure className="mcp-midia-previa">
        <img alt={`Arquivo original ${atual.finalidade} para SKU ${atual.sku}; confira a identidade física antes de aprovar`}
          src={urlTemporaria} referrerPolicy="no-referrer"
          onError={() => setErro("Não foi possível mostrar a imagem. Reabra o original para gerar outro link temporário.")}/>
        <figcaption>Arquivo ORIGINAL privado. Nenhuma edição, recorte ou publicação foi realizada.</figcaption>
      </figure>}
      <fieldset className="mcp-midia-verificacoes">
        <legend>Confirmação humana obrigatória</legend>
        <label><input type="checkbox" disabled={!urlTemporaria || ocupado} checked={identidadeConferida}
          onChange={e => setIdentidadeConferida(e.target.checked)}/> Conferi a imagem e o SKU: é exatamente a peça/arte correta, não um item similar.</label>
        <label><input type="checkbox" disabled={!urlTemporaria || ocupado} checked={direitosConferidos}
          onChange={e => setDireitosConferidos(e.target.checked)}/> Confirmo que a Mobis possui autorização para usar esta imagem ou banner.</label>
        <label>Observação da decisão (opcional)
          <textarea maxLength={500} rows={2} value={observacao} disabled={ocupado}
            onChange={e => setObservacao(e.target.value)} placeholder="Ex.: conferi etiqueta do fornecedor, marca e composição"/></label>
      </fieldset>
      <div className="linha">
        <button type="button" disabled={ocupado || !urlTemporaria || !identidadeConferida || !direitosConferidos || (atual.aplicacao_id !== null && !pagina.includes("#/a/"))}
          onClick={() => void decidir("aprovar")}>Aprovar apenas para uso interno</button>
        <button type="button" className="perigo" disabled={ocupado} onClick={() => void decidir("rejeitar")}>Rejeitar</button>
        <button type="button" className="sec" disabled={ocupado} onClick={() => setSelecionada("")}>Fechar</button>
      </div>
      <p className="suave">Aprovada aqui ≠ publicada. A publicação de foto, banner, campanha ou produto exige outra ação específica do proprietário.</p>
    </div>}
  </section>;
}
