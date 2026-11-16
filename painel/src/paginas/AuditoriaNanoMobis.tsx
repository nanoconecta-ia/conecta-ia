import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase.ts";
import { ir } from "../lib/rota.ts";
import type { Loja } from "../lib/dados.ts";
import "./auditoria-nano-mobis.css";

type Pendencia = {
  prioridade: "P0" | "P1";
  tipo: string;
  produto_id: string;
  sku: string | null;
  registro_id: string;
  motivos: string[];
};
type Resumo = {
  produtos: number;
  sem_sku: number;
  sem_categoria: number;
  sem_marca: number;
  aplicacoes_sem_oem: number;
  aplicacoes_sem_modelo: number;
  aplicacoes_aprovadas: number;
  codigos_sem_marca: number;
  enriquecimentos_conflitantes: number;
  momento: string;
};
type EvidenciaOem = {
 id:string; produto_id:string; aplicacao_id:string|null; codigo_oem:string;
 url_evidencia:string; diagrama_epc:string|null; regiao_catalogo:string;
 situacao_evidencia:string; relacao_sku:string; consultado_em:string;
};
type ProdutoLocalizado = {
  id:string;
  bling_id:string|null;
  sku:string|null;
  nome:string|null;
  marca:string|null;
  taxonomia_no_id:string|null;
};

const ROTULOS:Record<string,string>={
  produto_mestre:"Identidade e cadastro",
  aplicacao_veicular:"Compatibilidade por veículo",
  codigo_cruzado:"Referência entre fabricantes",
  ncm_documental:"NCM e nota de entrada",
  enriquecimento_incoerente:"Aprovação contraditória",
};
const contagem=(n:number|null|undefined)=>new Intl.NumberFormat("pt-BR").format(n??0);
const idCurto=(id:string)=>id.slice(0,8)+"…";
const vazioResumo:Resumo={
  produtos:0,sem_sku:0,sem_categoria:0,sem_marca:0,
  aplicacoes_sem_oem:0,aplicacoes_sem_modelo:0,aplicacoes_aprovadas:0,
  codigos_sem_marca:0,enriquecimentos_conflitantes:0,momento:"",
};

/**
 * Fila conservadora da Mobis: leitura APENAS para administradores autenticados.
 * As RPCs verificam auth.uid() e public.pode_administrar_loja(loja.id)
 * no servidor; o frontend não possui service_role nem modifica o Bling.
 */
export function AuditoriaNanoMobis({loja}:{loja:Loja}){
  const [itens,setItens]=useState<Pendencia[]>([]);
  const [resumo,setResumo]=useState<Resumo|null>(null);
  const [carregando,setCarregando]=useState(true);
  const [erro,setErro]=useState("");
  const [tipo,setTipo]=useState("todos");
  const [filtro,setFiltro]=useState("");
  const [referencia,setReferencia]=useState("");
  const [produto,setProduto]=useState<ProdutoLocalizado|null>(null);
  const [erroBusca,setErroBusca]=useState("");
  const [buscando,setBuscando]=useState(false);
  const [evidencias,setEvidencias]=useState<EvidenciaOem[]>([]);
  const [codigoEpc,setCodigoEpc]=useState("");
  const [urlEpc,setUrlEpc]=useState("");
  const [diagramaEpc,setDiagramaEpc]=useState("");
  const [regiaoEpc,setRegiaoEpc]=useState("a_confirmar");
  const [observacaoEpc,setObservacaoEpc]=useState("");
  const [gravandoEpc,setGravandoEpc]=useState(false);
  const [msgEpc,setMsgEpc]=useState("");
  const [erroEpc,setErroEpc]=useState("");


  const carregar=useCallback(async()=>{
    setCarregando(true);setErro("");
    const [q,res,oem]=await Promise.all([
      supabase.rpc("mobis_fila_admin",{p_loja:loja.id,p_limite:200}),
      supabase.rpc("mobis_fila_resumo_admin",{p_loja:loja.id}),
      supabase.rpc("mobis_evidencias_oem_admin",{p_loja:loja.id,p_limite:150}),
    ]);
    setEvidencias(oem.error?[]:(oem.data??[]) as EvidenciaOem[]);
    if(q.error||res.error){
      setItens([]);setResumo(null);
      setErro(q.error?.code==="42501"||res.error?.code==="42501"
        ?"A auditoria é restrita ao responsável administrador desta loja."
        :"Não foi possível carregar a auditoria. Confira a migração e suas permissões.");
    } else {
      setItens((q.data??[]) as Pendencia[]);
      setResumo((res.data??vazioResumo) as Resumo);
    }
    setCarregando(false);
  },[loja.id]);

  useEffect(()=>{void carregar();},[carregar]);

  const filtrados=useMemo(()=>itens.filter(p=>{
    const matchTipo=tipo==="todos"||p.tipo===tipo;
    const texto=[p.sku,p.produto_id,p.registro_id,...p.motivos].filter(Boolean).join(" ").toLowerCase();
    return matchTipo&&texto.includes(filtro.trim().toLowerCase());
  }),[itens,tipo,filtro]);

  async function localizarProduto(){
    const valor=referencia.trim();
    setProduto(null);setErroBusca("");
    if(!/^[A-Za-z0-9._-]{2,80}$/.test(valor)){
      setErroBusca("Informe um SKU ou ID do Bling válido, sem caracteres especiais.");
      return;
    }
    setBuscando(true);
    let q=supabase.from("produtos")
      .select("id,bling_id,sku,nome,marca,taxonomia_no_id")
      .eq("loja_id",loja.id);
    q=/^\d+$/.test(valor)?q.eq("bling_id",valor):q.eq("sku",valor);
    const {data,error}=await q.limit(2);
    setBuscando(false);
    if(error){setErroBusca("Não foi possível pesquisar o espelho do ERP.");return;}
    if(!data?.length){setErroBusca("Cadastro não encontrado. O código do nome não substitui o SKU do Bling.");return;}
    if(data.length>1){setErroBusca("Mais de um produto encontrado: solicite auditoria antes de editar.");return;}
    setProduto(data[0] as ProdutoLocalizado);
  }

  async function registrarEpc(){
    if(!produto){setErroEpc("Localize um produto pelo SKU ou ID do Bling.");return;}
    if(!/^[A-Za-z0-9][A-Za-z0-9 ./_-]{3,79}$/.test(codigoEpc.trim())){
      setErroEpc("Informe um número OEM válido de 4 a 80 caracteres.");return;
    }
    if(!/^https:\/\/(www\.|meta\.)?partsouq\.com\//i.test(urlEpc.trim())){
      setErroEpc("Utilize uma URL direta HTTPS do PartSouq.");return;
    }
    setGravandoEpc(true);setErroEpc("");setMsgEpc("");
    const {data,error}=await supabase.rpc("mobis_registrar_oem_partsouq",{
      p_loja:loja.id,p_produto:produto.id,p_codigo:codigoEpc.trim(),
      p_url:urlEpc.trim(),p_aplicacao:null,
      p_diagrama:diagramaEpc.trim()||null,p_item:null,
      p_regiao:regiaoEpc.trim()||"a_confirmar",
      p_vin_consultado:false,p_observacoes:observacaoEpc.trim()||null,
    });
    setGravandoEpc(false);
    if(error){setErroEpc("Não foi possível registrar: confira código, URL, cadastro e autorização.");return;}
    setMsgEpc("Evidência registrada como CANDIDATA ("+String(data).slice(0,8)+"…). Nenhuma aplicação ou equivalência foi aprovada.");
    const q=await supabase.rpc("mobis_evidencias_oem_admin",{p_loja:loja.id,p_limite:150});
    if(!q.error)setEvidencias((q.data??[]) as EvidenciaOem[]);
  }

  if(loja.slug!=="mobis")return <section className="cartao"><h1>Auditoria Nano</h1><p>Este piloto está disponível apenas para a MOBIS AUTOPEÇAS.</p></section>;
  return <section className="cartao mobis-auditoria" aria-label="Auditoria técnica do Nano">
    <header className="mobis-auditoria-header">
      <div>
        <p className="mobis-auditoria-kicker">MOBIS · CONECTA.IA · BLING</p>
        <h1>Fila técnica do Nano</h1>
        <p className="suave">Diagnóstico somente leitura. A fila não cria OEM, não aprova marcas, não modifica NCM, preço, nota fiscal ou estoque.</p>
      </div>
      <button type="button" disabled={carregando} onClick={()=>void carregar()}>Atualizar auditoria</button>
    </header>

    {carregando&&<p role="status">Conferindo dados e permissões…</p>}
    {erro&&<p role="alert" className="mobis-auditoria-erro">{erro}</p>}
    {resumo&&!erro&&<div className="mobis-auditoria-resumo">
      {[
        ["Produtos físicos",resumo.produtos],
        ["Sem SKU",resumo.sem_sku],
        ["Sem nó técnico",resumo.sem_categoria],
        ["Sem marca",resumo.sem_marca],
        ["Aplicações sem OEM",resumo.aplicacoes_sem_oem],
        ["Aplicações sem modelo",resumo.aplicacoes_sem_modelo],
        ["Aprovações contraditórias",resumo.enriquecimentos_conflitantes],
        ["Códigos cruzados sem marca",resumo.codigos_sem_marca]
      ].map(([titulo,n])=><div className="mobis-auditoria-metrica" key={String(titulo)}>
        <strong>{contagem(Number(n))}</strong><span>{titulo}</span>
      </div>)}
    </div>}

    {!erro&&resumo&&<>
      <div className="mobis-auditoria-sec">
        <div>
          <h2>Pesquisar no espelho do Bling</h2>
          <p className="suave">Use o ID do Bling ou SKU. Não tente deduzir um SKU pelo título da peça.</p>
        </div>
        <form onSubmit={e=>{e.preventDefault();void localizarProduto();}} className="mobis-auditoria-busca">
          <label htmlFor="mobis-auditoria-codigo">SKU ou ID do Bling</label>
          <div><input id="mobis-auditoria-codigo" value={referencia} onChange={e=>setReferencia(e.target.value)} placeholder="Ex.: 16275882008"/>
            <button disabled={buscando} type="submit">{buscando?"Consultando…":"Localizar"}</button></div>
        </form>
        {erroBusca&&<p className="mobis-auditoria-alerta" role="status">{erroBusca}</p>}
        {produto&&<div className="mobis-auditoria-produto" aria-live="polite">
          <strong>{produto.nome??"Produto sem descrição"}</strong>
          <dl><div><dt>ID Bling</dt><dd>{produto.bling_id??"Ausente"}</dd></div>
            <div><dt>SKU</dt><dd>{produto.sku??"Vazio no espelho"}</dd></div>
            <div><dt>Marca</dt><dd>{produto.marca??"Não homologada"}</dd></div>
            <div><dt>Nó técnico</dt><dd>{produto.taxonomia_no_id?"Vinculado":"Pendente"}</dd></div></dl>
          <p className="suave">Revisar o cadastro de origem no ERP. Este painel não permite preencher automaticamente campos desconhecidos.</p>
          <button type="button" onClick={()=>ir("/fila")}>Abrir propostas na fila de aprovação</button>
        </div>}
      </div>

      <div className="mobis-auditoria-sec mobis-auditoria-epc" aria-label="Evidências PartSouq EPC">
        <h2>PartSouq — Evidências OEM / EPC</h2>
        <p className="suave">O catálogo eletrônico identifica números OEM e diagramas por veículo. A ligação com a peça física da MOBIS continua independente e exige prova. Não digite VIN completo, dados de clientes ou números de chassi nesta ficha.</p>
        <p><a href="https://partsouq.com/catalogs/" target="_blank" rel="noopener noreferrer">Pesquisar no PartSouq (catálogo original)</a></p>
        {!produto?<p className="mobis-auditoria-alerta">Localize acima o produto mestre pelo ID do Bling ou SKU para registrar a referência OEM.</p>:
          <form onSubmit={e=>{e.preventDefault();void registrarEpc();}} className="mobis-auditoria-epc-form">
            <p className="mobis-auditoria-epc-vinculo">Peça selecionada: <strong>{produto.nome??produto.bling_id}</strong> · ID Bling {produto.bling_id}. A inclusão não aprova compatibilidade.</p>
            <label>Número OEM candidato
              <input required value={codigoEpc} onChange={e=>setCodigoEpc(e.target.value)} maxLength={80} placeholder="Ex.: 2630042040"/></label>
            <label>URL exata da consulta no PartSouq
              <input required type="url" value={urlEpc} onChange={e=>setUrlEpc(e.target.value)} maxLength={1200} placeholder="https://partsouq.com/en/search/all?q=..."/></label>
            <label>Diagrama / grupo EPC
              <input value={diagramaEpc} onChange={e=>setDiagramaEpc(e.target.value)} maxLength={180} placeholder="Ex.: ENGINE / FRONT CASE & OIL FILTER"/></label>
            <label>Mercado / região do catálogo
              <input value={regiaoEpc} onChange={e=>setRegiaoEpc(e.target.value)} maxLength={120} placeholder="Ex.: EUR; confirmar Brasil"/></label>
            <label className="mobis-auditoria-epc-observacao">Ressalvas técnicas (sem VIN)
              <textarea rows={3} maxLength={1200} value={observacaoEpc} onChange={e=>setObservacaoEpc(e.target.value)} placeholder="Motor, ano e critérios a conferir; não presuma equivalência pelo nome."/></label>
            <button type="submit" disabled={gravandoEpc}>{gravandoEpc?"Registrando…":"Registrar como candidato — sem aprovar"}</button>
          </form>}
        {erroEpc&&<p role="alert" className="mobis-auditoria-erro">{erroEpc}</p>}
        {msgEpc&&<p role="status" className="mobis-auditoria-epc-ok">{msgEpc}</p>}
        <h3>Referências EPC em revisão</h3>
        {evidencias.filter(x=>!produto||x.produto_id===produto.id).length===0
          ?<p className="suave">Nenhuma evidência cadastrada para esta seleção.</p>
          :<div className="mobis-auditoria-epc-lista">{evidencias
            .filter(x=>!produto||x.produto_id===produto.id).map(e=><article key={e.id}>
              <div><strong>OEM {e.codigo_oem}</strong> <small>{e.situacao_evidencia} · SKU: {e.relacao_sku.replace(/_/g," ")}</small></div>
              <p>{e.diagrama_epc??"Diagrama não identificado"} · {e.regiao_catalogo}</p>
              <a href={e.url_evidencia} target="_blank" rel="noopener noreferrer">Abrir evidência PartSouq</a>
            </article>)}</div>}
        <p className="suave">Não são copiadas imagens ou diagramas do PartSouq. Não há importação em lote e nenhuma informação é escrita na aba fiscal ou nas aplicações aprovadas do Bling.</p>
      </div>
      <div className="mobis-auditoria-sec">
        <h2>Pendências verificadas</h2>
        <p className="suave">Exibindo uma amostra de até 200 registros prioritários. Os indicadores acima refletem o catálogo completo; a lista não é uma contagem total.</p>
        <div className="mobis-auditoria-filtros">
          <label>Tipo <select value={tipo} onChange={e=>setTipo(e.target.value)}>
            <option value="todos">Todos os tipos</option>
            {Object.entries(ROTULOS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
          </select></label>
          <label>Filtrar amostra <input value={filtro} onChange={e=>setFiltro(e.target.value)} placeholder="SKU, motivo ou UUID"/></label>
        </div>
        <div className="mobis-auditoria-tabela" role="region" aria-label="Pendências do Nano" tabIndex={0}>
          <table><thead><tr><th>Prioridade</th><th>Tipo</th><th>Identidade</th><th>Verificações necessárias</th></tr></thead>
          <tbody>{filtrados.map(item=><tr key={item.tipo+item.registro_id}>
            <td><strong className={item.prioridade==="P0"?"mobis-auditoria-p0":"mobis-auditoria-p1"}>{item.prioridade}</strong></td>
            <td>{ROTULOS[item.tipo]??item.tipo}</td>
            <td><code>{item.sku??"SKU não preenchido"}</code><small title={item.produto_id}> {idCurto(item.produto_id)}</small></td>
            <td>{item.motivos.map((m,i)=><div key={i}>{m}</div>)}</td>
          </tr>)}
          {!filtrados.length&&<tr><td colSpan={4}>Nenhum registro encontrado nesta amostra para o filtro selecionado.</td></tr>}
          </tbody></table>
        </div>
      </div>
      <p className="mobis-auditoria-rodape">Próximos passos: conferir documentação do fabricante, código OEM e nota de entrada; propor alterações com evidência; aprovar antes de escrever no Bling. Nenhuma ação desta página altera o ERP.</p>
    </>}
  </section>;
}
