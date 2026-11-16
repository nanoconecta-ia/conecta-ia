import { useCallback, useEffect, useState } from "react";
import { supabase } from "../supabase.ts";
import type { Loja } from "../lib/dados.ts";
import { galeriaDaFicha, LIMITE_GALERIA, pedidoDeImagensComPerfil, type LinhaImagem, type PerfilFotoNano } from "../lib/galeriaProduto.ts";
import { alterarSelecao, avaliarPreviaPrincipal, selecaoAtual } from "../lib/seletorImagensNano.ts";
import { pedirAoNanoNaConversa } from "../lib/contextoPagina.ts";
import { Visualizador } from "./Visualizador.tsx";
import { PreviaBranca } from "./PreviaBranca.tsx";
import { CarrosselVidroNano } from "./CarrosselVidroNano.tsx";
import "./galeria-seletor-nano.css";

const CAMPOS = "id, url, tipo, origem, url_original, licenca_tipo, cruzamento_tipo, cruzamento_valor, largura_px, altura_px, aprovada, principal, direitos_confirmados_em, removida_em, ordem";
const negado = (e: unknown) => (e as { context?: { status?: number } } | null)?.context?.status === 403;
type Filtro = "todas" | "pendentes" | "aprovadas" | "publicaveis" | "sem_direitos";

export function GaleriaProduto({
  loja, produtoId, sku, aoFechar, aoDecidir,
}: {
  loja: Loja; produtoId: string; sku: string | null;
  aoFechar?: () => void; aoDecidir?: () => void;
}) {
  const [linhas, setLinhas] = useState<LinhaImagem[] | null>(null);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [ocupado, setOcupado] = useState("");
  const [podeDecidir, setPodeDecidir] = useState<boolean | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [selecionadas, setSelecionadas] = useState<string[]>([]);
  const [principalPrevia, setPrincipalPrevia] = useState<string | null>(null);
  const [ampliada, setAmpliada] = useState<{url:string;legenda:string}|null>(null);
  const [preverBranco, setPreverBranco] = useState(true);
  const [arquivoLocal, setArquivoLocal] = useState<File | null>(null);

  const carregar = useCallback(async () => {
    const { data, error } = await supabase.from("produto_imagens")
      .select(CAMPOS).eq("loja_id", loja.id).eq("produto_id", produtoId)
      .is("removida_em", null).order("ordem").limit(LIMITE_GALERIA);
    if (error) {
      setErro("Não foi possível consultar a galeria desta peça.");
      setLinhas([]);
    } else {
      setErro("");
      setLinhas((data ?? []) as unknown as LinhaImagem[]);
    }
  }, [loja.id, produtoId]);

  useEffect(() => {
    setLinhas(null); setSelecionadas([]); setPrincipalPrevia(null);
    setArquivoLocal(null); setMensagem(""); setFiltro("todas");
    void carregar();
  }, [carregar]);
  useEffect(() => {
    let ativo = true;
    void supabase.rpc("pode_administrar_loja", { p_loja_id: loja.id })
      .then(({ data }) => { if (ativo) setPodeDecidir(data === true); },
        () => { if (ativo) setPodeDecidir(false); });
    return () => { ativo = false; };
  }, [loja.id]);

  async function decidir(id: string, decisao: "aprovar" | "rejeitar") {
    if (podeDecidir !== true) return;
    setOcupado(id); setErro(""); setMensagem("");
    try {
      const { data, error } = await supabase.functions.invoke("assistente", {
        body: { loja_id: loja.id, acao: "decidir_imagem", id, decisao },
      });
      if (error || data?.erro) {
        setErro(negado(error) ? "Só o administrador da loja pode decidir."
          : "A imagem não foi decidida. Confira identidade, permissão e direitos antes de tentar novamente.");
      } else {
        setMensagem(decisao === "aprovar"
          ? "Identidade aprovada para revisão do catálogo. A publicação ainda depende dos direitos e das demais exigências."
          : "Candidata rejeitada; a vaga poderá receber nova pesquisa.");
        if (decisao === "rejeitar") {
          setSelecionadas(atual => atual.filter(x => x !== id));
          setPrincipalPrevia(v => v === id ? null : v);
        }
        await carregar();
        aoDecidir?.();
      }
    } catch {
      setErro("Falha ao registrar a decisão. Nenhuma aprovação foi presumida.");
    } finally { setOcupado(""); }
  }

  async function pesquisarComPerfil() {
    if (ocupado) return;
    setOcupado("pesquisa");setErro("");setMensagem("");
    try {
      const { data: p,error: ep } = await supabase.from("produtos")
        .select("id,bling_id,sku,nome,marca,gtin,taxonomia_no_id")
        .eq("loja_id",loja.id).eq("id",produtoId).maybeSingle();
      if(ep || !p) {setErro("Produto físico não encontrado no espelho. Confira o ID Bling antes de pesquisar.");return;}
      // NUNCA utilizar códigos/aplicações 'a_confirmar' como prova para fotos.
      const [{data:codigos,error:ec},{data:apps,error:ea}] = await Promise.all([
        supabase.from("produto_codigos").select("tipo,valor")
          .eq("loja_id",loja.id).eq("produto_id",produtoId).eq("status","aprovado")
          .in("tipo",["oem","fabricante"]).limit(12),
        supabase.from("produto_aplicacoes").select("modelo,motorizacao,ano_inicial,ano_final,codigo_oem")
          .eq("loja_id",loja.id).eq("produto_id",produtoId).eq("status","aprovado")
          .limit(12),
      ]);
      if(ec || ea) {setErro("Não foi possível conferir referências e aplicações aprovadas; pesquisa de imagens suspensa.");return;}
      let nomeNo:string|null=null;
      if(p.taxonomia_no_id){
        const {data:n,error:en}=await supabase.from("taxonomia_nos")
          .select("nome").eq("id",p.taxonomia_no_id).maybeSingle();
        if(en){setErro("Taxonomia do produto indisponível. Confira antes de pesquisar fotografias.");return;}
        nomeNo=n?.nome??null;
      }
      const perfil:PerfilFotoNano={
        produtoId:p.id,blingId:p.bling_id??null,sku:p.sku??null,
        nome:p.nome??null,marca:p.marca??null,gtin:p.gtin??null,
        noTaxonomia:nomeNo,
        codigosAprovados:(codigos??[]) as PerfilFotoNano["codigosAprovados"],
        aplicacoesAprovadas:(apps??[]) as PerfilFotoNano["aplicacoesAprovadas"],
      };
      pedirAoNanoNaConversa(pedidoDeImagensComPerfil(perfil));
      aoFechar?.();
    }catch{
      setErro("Falha na leitura do perfil técnico. Não foi solicitado nenhum cruzamento de imagens.");
    }finally{setOcupado("");}
  }

  const g = linhas ? galeriaDaFicha(linhas) : null;
  const ids = g?.itens.map(i => i.id) ?? [];
  const selecionadasAtuais = selecaoAtual(selecionadas, ids);
  const escolhidas = (g?.itens ?? []).filter(i => selecionadasAtuais.includes(i.id));
  const candidataPrincipal = g?.itens.find(i => i.id === principalPrevia) ?? null;
  const avaliacaoPrincipal = avaliarPreviaPrincipal(candidataPrincipal
    ? { id:candidataPrincipal.id,
        tipo:linhas?.find(l=>l.id === candidataPrincipal.id)?.tipo ?? "real",
        aprovada:candidataPrincipal.estado === "aprovada",
        direitos:candidataPrincipal.direitos,
        publicavel:candidataPrincipal.publicavel }
    : null);
  const visiveis = (g?.itens ?? []).filter(i =>
    filtro === "todas" ||
    (filtro === "pendentes" && i.estado === "pendente") ||
    (filtro === "aprovadas" && i.estado === "aprovada") ||
    (filtro === "publicaveis" && i.publicavel) ||
    (filtro === "sem_direitos" && !i.direitos)
  );

  function alternar(id: string) {
    const r = alterarSelecao(selecionadasAtuais, id, ids);
    if (r.erro) setErro(r.erro);
    else { setErro(""); setSelecionadas(r.selecionadas); }
  }

  return (
    <section className="galeria-produto gs-nano" aria-label="Seleção de até oito imagens da peça">
      <header className="gs-cabecalho">
        <div>
          <h3>Escolher fotografias <span className="gs-contador">{g ? `${g.itens.length}/${LIMITE_GALERIA}` : "…"}</span></h3>
          <p>Compare até oito imagens reais da mesma peça. O Nano sugere; você decide. Os dados originais do Bling permanecem intactos.</p>
        </div>
        <button type="button" className="sec" disabled={ocupado!==""}
          onClick={() => void pesquisarComPerfil()}>
          {ocupado==="pesquisa"?"Validando ficha técnica…":"Pesquisar imagens com base na ficha"}
        </button>
      </header>

      <div className="gs-controles">
        <label>Exibir
          <select value={filtro} onChange={e => setFiltro(e.target.value as Filtro)}>
            <option value="todas">Todas as imagens</option>
            <option value="pendentes">Aguardando decisão</option>
            <option value="aprovadas">Aprovadas</option>
            <option value="publicaveis">Aptas para publicação</option>
            <option value="sem_direitos">Direitos não comprovados</option>
          </select>
        </label>
        <label className="gs-branco-controle">
          <input type="checkbox" checked={preverBranco} onChange={e => setPreverBranco(e.target.checked)}/>
          Prévia em fundo branco
        </label>
        <span className="gs-contagem" aria-live="polite">{selecionadasAtuais.length} selecionadas para comparar</span>
      </div>
      <p className="gs-ressalva">A prévia branca altera só a superfície da tela; não remove fundos de JPG e não transforma o arquivo. Para uma cópia JPG normalizada, utilize a foto própria no Estúdio branco abaixo. Nenhuma imagem vira principal automaticamente.</p>
      {podeDecidir === false && <p className="suave">Somente o administrador da loja aprova ou rejeita fotografias.</p>}
      {erro && <p className="msg-erro" role="alert">{erro}</p>}
      {mensagem && <p className="msg-ok" role="status">{mensagem}</p>}
      {visiveis.length > 0 && (
        <CarrosselVidroNano
          itens={visiveis}
          branco={preverBranco}
          selecionadas={selecionadasAtuais}
          onComparar={alternar}
          onAmpliar={(item) => setAmpliada({url:item.url,legenda:`Imagem · ${item.origem}`})}
          onPreviaPrincipal={setPrincipalPrevia}
        />
      )}
      {g === null ? <p className="suave" role="status">Carregando candidatas…</p>
        : g.itens.length === 0 ? <p className="suave">Nenhuma candidata na galeria. Pesquise pelo código original/fabricante ou utilize uma foto própria.</p>
        : <div className="gs-grade">
          {visiveis.map((i, pos) => (
            <article key={i.id} className={`gs-card ${selecionadasAtuais.includes(i.id) ? "gs-card-selecionado" : ""}`}>
              <div className="gs-card-topo">
                <label className="gs-marcar">
                  <input type="checkbox" checked={selecionadasAtuais.includes(i.id)}
                    onChange={() => alternar(i.id)} />
                  Foto {ids.indexOf(i.id)+1}
                </label>
                <span className={`gs-etiqueta ${i.estado === "aprovada" ? "gs-ok" : ""}`}>
                  {i.estado === "aprovada" ? "Aprovada" : "A confirmar"}
                </span>
              </div>
              <button type="button" className={`gs-imagem ${preverBranco ? "gs-imagem-branca" : "gs-imagem-neutra"}`}
                onClick={() => setAmpliada({ url:i.url,legenda:`Imagem ${pos+1} · ${i.origem}` })}
                aria-label={`Ampliar fotografia ${ids.indexOf(i.id)+1} da peça`}>
                <img src={i.url} alt={`Fotografia candidata ${ids.indexOf(i.id)+1}, origem ${i.origem}`}
                  loading="lazy" referrerPolicy="no-referrer"/>
              </button>
              <div className="gs-selos">
                {i.principal && <span className="gs-etiqueta gs-ok">Principal atual</span>}
                {i.publicavel && <span className="gs-etiqueta gs-ok">Direitos e aprovação OK</span>}
                {!i.direitos && <span className="gs-etiqueta">Direitos pendentes</span>}
                {i.rotulo && <span className="gs-etiqueta">{i.rotulo}</span>}
              </div>
              <dl className="gs-meta">
                <div><dt>Fonte</dt><dd>{i.origem}</dd></div>
                <div><dt>Resolução</dt><dd>{i.resolucao}</dd></div>
                <div><dt>Licença</dt><dd>{i.licenca}</dd></div>
                <div><dt>Identidade</dt><dd>{i.identidade === "confere" ? "Código citado (conferir peça)" : "Não comprovada"}</dd></div>
              </dl>
              {i.avisos.length>0 && <details className="gs-alertas"><summary>{i.avisos.length} observação(ões)</summary>
                <ul>{i.avisos.map(v=><li key={v}>{v}</li>)}</ul></details>}
              <div className="gs-acoes">
                <button type="button" className="sec" aria-pressed={principalPrevia === i.id}
                  onClick={() => setPrincipalPrevia(i.id)}>
                  {principalPrevia === i.id ? "Na prévia principal" : "Pré-selecionar principal"}
                </button>
                {i.estado === "pendente" && <>
                  <button type="button" disabled={ocupado !== "" || podeDecidir !== true}
                    onClick={() => void decidir(i.id, "aprovar")}>Aprovar foto</button>
                  <button type="button" className="perigo" disabled={ocupado !== "" || podeDecidir !== true}
                    onClick={() => void decidir(i.id, "rejeitar")}>Rejeitar</button>
                </>}
              </div>
            </article>
          ))}
          {visiveis.length === 0 && <p className="suave">Nenhuma foto corresponde a este filtro.</p>}
        </div>}
      {g?.cheia && <p className="gs-ressalva">Galeria completa: 8 de 8 vagas. Pesquise novas fotos somente depois de retirar candidatas inadequadas.</p>}

      {escolhidas.length > 0 && <section className="gs-comparacao" aria-label="Comparação das imagens escolhidas">
        <h4>Comparar imagens selecionadas ({escolhidas.length})</h4>
        <div className="gs-comparacao-grade">
          {escolhidas.map(i=><figure key={i.id}>
            <div className={preverBranco ? "gs-imagem-branca" : "gs-imagem-neutra"}>
              <img src={i.url} loading="lazy" referrerPolicy="no-referrer" alt={`Comparar candidata ${i.origem}`}/>
            </div>
            <figcaption>{i.origem} · {i.resolucao}</figcaption>
          </figure>)}
        </div>
        <button className="sec" type="button" onClick={()=>setSelecionadas([])}>Limpar comparação</button>
      </section>}

      {candidataPrincipal && <section className="gs-preprincipal" aria-live="polite">
        <strong>Prévia de principal (não gravada)</strong>
        <p>{avaliacaoPrincipal.mensagem}</p>
        <p>Para mudar a foto principal cadastrada, será necessária uma ação administrativa específica, com auditoria e aprovação. Esta escolha de comparação não altera o site.</p>
      </section>}

      <section className="gs-preparar" aria-label="Padronização local da imagem para fundo branco">
        <h4>Estúdio branco · cópia local da fotografia própria</h4>
        <p>Envie aqui a foto original que você possui ou tem autorização para usar. O sistema cria uma cópia 1.200 × 1.200 em JPG, com margens brancas, sem alterar contornos, etiquetas ou inscrições. O fundo opaco da foto permanece; removê-lo requer processo específico com conferência visual.</p>
        <label className="gs-arquivo">Escolher arquivo local (JPG, PNG ou WebP; até 15 MB)
          <input type="file" accept="image/jpeg,image/png,image/webp"
            onChange={e=>{setArquivoLocal(e.target.files?.[0]??null); e.currentTarget.value="";}} />
        </label>
        {arquivoLocal && <PreviaBranca key={arquivoLocal.name + ":" + arquivoLocal.size + ":" + arquivoLocal.lastModified} arquivo={arquivoLocal} />}
      </section>
      <Visualizador url={ampliada?.url ?? null} legenda={ampliada?.legenda ?? "Imagem da peça"}
        aoFechar={()=>setAmpliada(null)} />
    </section>
  );
}
