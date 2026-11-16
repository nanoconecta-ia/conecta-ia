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

  const carregar=useCallback(async()=>{
    setCarregando(true);setErro("");
    const [q,res]=await Promise.all([
      supabase.rpc("mobis_fila_admin",{p_loja:loja.id,p_limite:200}),
      supabase.rpc("mobis_fila_resumo_admin",{p_loja:loja.id}),
    ]);
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
