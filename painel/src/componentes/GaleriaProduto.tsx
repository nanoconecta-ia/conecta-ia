import { useCallback, useEffect, useState } from "react";
import { supabase } from "../supabase.ts";
import type { Loja } from "../lib/dados.ts";
import { galeriaDaFicha, LIMITE_GALERIA, pedidoDeImagens, type LinhaImagem } from "../lib/galeriaProduto.ts";
import { pedirAoNanoNaConversa } from "../lib/contextoPagina.ts";

const CAMPOS = "id, url, tipo, origem, url_original, licenca_tipo, cruzamento_tipo, cruzamento_valor, confianca, largura_px, altura_px, aprovada, principal, direitos_confirmados_em, removida_em, ordem";
const negado = (e: unknown) => (e as { context?: { status?: number } } | null)?.context?.status === 403;

/** Galeria de até 8 imagens do produto, na ficha do Catálogo. Mostra origem, prova do código, resolução, licença e estado de CADA imagem.
 *  Aprovar/rejeitar é decisão do lojista, imagem por imagem (ação `decidir_imagem` que já existe na Fila); aprovar não publica sem direitos confirmados. */
export function GaleriaProduto({ loja, produtoId, sku, aoFechar }: { loja: Loja; produtoId: string; sku: string | null; aoFechar?: () => void }) {
  const [linhas, setLinhas] = useState<LinhaImagem[] | null>(null);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState("");
  const [podeDecidir, setPodeDecidir] = useState<boolean | null>(null);
  const carregar = useCallback(async () => {
    const { data, error } = await supabase.from("produto_imagens").select(CAMPOS).eq("loja_id", loja.id).eq("produto_id", produtoId).is("removida_em", null).order("ordem").limit(LIMITE_GALERIA);
    if (error) { setErro("Não consegui carregar as imagens deste produto."); setLinhas([]); } else { setErro(""); setLinhas((data ?? []) as unknown as LinhaImagem[]); }
  }, [loja.id, produtoId]);
  useEffect(() => { setLinhas(null); void carregar(); }, [carregar]);
  useEffect(() => { supabase.rpc("pode_administrar_loja", { p_loja_id: loja.id }).then(({ data }) => setPodeDecidir(data === true)); }, [loja.id]);

  async function decidir(id: string, decisao: "aprovar" | "rejeitar") {
    setOcupado(id); setErro("");
    const { error } = await supabase.functions.invoke("assistente", { body: { loja_id: loja.id, acao: "decidir_imagem", id, decisao } });
    setOcupado("");
    if (error) setErro(negado(error) ? "Só o responsável (lojista) da loja aprova ou rejeita imagens." : "Não foi possível registrar a decisão."); else void carregar();
  }
  const g = linhas ? galeriaDaFicha(linhas) : null;
  return (
    <section className="galeria-produto" aria-labelledby="galeria-titulo">
      <div className="galeria-topo">
        <strong id="galeria-titulo">Galeria de imagens <span className="mono">{g ? `${g.itens.length} de ${LIMITE_GALERIA}` : "…"}</span></strong>
        <button type="button" className="sec" disabled={!sku} onClick={() => { if (sku) { pedirAoNanoNaConversa(pedidoDeImagens(sku)); aoFechar?.(); } }}>Pedir candidatas ao Nano.IA</button>
      </div>
      <p className="galeria-aviso">O Nano só traz candidata cujo código aparece escrito na página de origem. Nada fica aprovado nem publicado sem a sua decisão, imagem por imagem. Marca d'água de terceiros não é removida: a imagem fica inutilizável.</p>
      {podeDecidir === false && <p className="suave">Você acompanha as imagens, mas só o responsável (lojista) aprova ou rejeita.</p>}
      {erro && <p className="msg-erro" role="alert">{erro}</p>}
      {g === null ? <p className="suave" role="status">Carregando…</p> : g.itens.length === 0 ? <p className="suave">Nenhuma imagem registrada. Peça candidatas ao Nano.IA.</p> : (
        <ul className="galeria-grade">
          {g.itens.map((i) => (
            <li key={i.id} className={`galeria-item${i.estado === "aprovada" ? " galeria-item--aprovada" : ""}`}>
              <div className="galeria-quadro">
                <img src={i.url} alt={`Imagem candidata de ${sku ?? "produto"} (origem ${i.origem})`} loading="lazy" referrerPolicy="no-referrer" />
                {i.rotulo && <span className="galeria-rotulo">{i.rotulo}</span>}
              </div>
              <div className="galeria-selos">
                <span className={`selo ${i.estado === "aprovada" ? "ok" : "atencao"}`}>{i.estado === "aprovada" ? "aprovada" : "pendente"}</span>
                <span className={`selo ${i.identidade === "confere" ? "ok" : "atencao"}`}>{i.identidade === "confere" ? "código confere" : i.identidade === "nao_prova" ? "não prova a peça" : "sem código"}</span>
                <span className={`selo ${i.publicavel ? "ok" : "atencao"}`}>{i.publicavel ? "publicável" : "não publicável"}</span>
                {i.principal && <span className="selo ok">principal</span>}
              </div>
              <dl className="galeria-dados">
                <div><dt>Origem</dt><dd className="mono">{i.origem}</dd></div>
                <div><dt>Resolução</dt><dd className="mono">{i.resolucao}</dd></div>
                <div><dt>Licença</dt><dd>{i.licenca}</dd></div>
                <div><dt>Confiança</dt><dd className="mono">{i.confianca}</dd></div>
              </dl>
              {i.avisos.length > 0 && <ul className="galeria-avisos">{i.avisos.map((a) => <li key={a}>{a}</li>)}</ul>}
              {i.estado === "pendente" && (
                <div className="galeria-acoes">
                  <button type="button" disabled={ocupado === i.id || podeDecidir !== true} onClick={() => void decidir(i.id, "aprovar")}>Aprovar esta</button>
                  <button type="button" className="perigo" disabled={ocupado === i.id || podeDecidir !== true} onClick={() => void decidir(i.id, "rejeitar")}>Rejeitar</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {g && g.cheia && <p className="suave">Galeria cheia (8 de 8): rejeite uma candidata para abrir vaga. O banco também recusa a nona.</p>}
    </section>
  );
}
