import { useEffect, useState } from "react";
import { supabase } from "../supabase.ts";
import type { Loja } from "../lib/dados.ts";
import { useFonte } from "../lib/useFonte.ts";
import "./ferramentas-catalogo.css";

type Produto = { id:string;sku:string;nome:string|null;bling_id:string|null;publicado:boolean;
  descricao_curta:string|null;descricao_complementar:string|null };
type Resultado = {ok:boolean;erro?:string;dados?:{ok?:boolean;resultado?:unknown;observacao?:string;gravados?:string[];
  passos_pendentes?:number[];receita_faltando?:boolean;erro?:string}};
const CAMPO_CONECTA = [
  ["descricao_curta","Descrição curta técnica"],["descricao_longa","Descrição técnica longa"],
  ["marca_peca","Marca do fabricante"],["tags","Tags do catálogo"],["seo_titulo","Título SEO"],
  ["seo_descricao","Resumo SEO"]
] as const;
const CAMPO_ERP = [
  ["descricao_curta","Descrição curta no Bling"],["descricao_complementar","Descrição complementar no Bling"]
] as const;
type Acao = "consultar_bling"|"propor_conecta"|"preparar_erp"|"indexar";
const imprimir=(o:unknown):string=> {
  if (o==null)return "Sem informações.";
  try{return JSON.stringify(o,null,2).slice(0,3500)}catch{return "Não foi possível apresentar o resultado."}
};

export function FerramentasCatalogo({loja,query}:{loja:Loja;query:URLSearchParams}) {
  const fonte=useFonte();
  const [sku,setSku]=useState((query.get("sku")??"").slice(0,80));
  const [produto,setProduto]=useState<Produto|null>(null);
  const [erroProduto,setErroProduto]=useState("");
  const [lendo,setLendo]=useState(false);
  const [campoConecta,setCampoConecta]=useState<string>("descricao_longa");
  const [campoErp,setCampoErp]=useState<string>("descricao_curta");
  const [valor,setValor]=useState("");
  const [fonteDocumento,setFonteDocumento]=useState("");
  const [acao,setAcao]=useState<Acao|null>(null);
  const [erro,setErro]=useState("");
  const [mensagem,setMensagem]=useState("");
  const [dados,setDados]=useState<unknown>(null);
  const [propostaId,setPropostaId]=useState<string|null>(null);
  const [indexado,setIndexado]=useState<string[]>([]);

  useEffect(()=>{const x=query.get("sku");if(x)setSku(x.slice(0,80))},[query]);
  useEffect(()=>{
    setProduto(null);setErroProduto("");
    const codigo=sku.trim();
    if(!codigo){return}
    let ativo=true;
    const t=window.setTimeout(async ()=>{
      setLendo(true);
      try{
        const {data,error}=await supabase.from("produtos").select(
          "id,sku,nome,bling_id,publicado,descricao_curta,descricao_complementar"
        ).eq("loja_id",loja.id).eq("sku",codigo).maybeSingle();
        if(!ativo)return;
        if(error){setErroProduto("Não foi possível consultar o espelho desta loja.");return}
        if(!data){setErroProduto("SKU não encontrado no Conecta.IA. Sincronize o Bling antes de propor alteração.");return}
        setProduto(data as Produto);
      }catch{if(ativo)setErroProduto("Consulta ao espelho indisponível.")}
      finally{if(ativo)setLendo(false)}
    },300);
    return()=>{ativo=false;window.clearTimeout(t)};
  },[sku,loja.id]);
  const pronto=!!fonte&&!acao;
  const tecnicoValido=valor.trim().length>=2&&fonteDocumento.trim().length>=6;
  async function executar(tipo:Acao){
    if(!fonte||acao)return;
    setErro("");setMensagem("");setDados(null);setPropostaId(null);setIndexado([]);
    if(!produto){setErro("Escolha um SKU do espelho antes de executar a ferramenta.");return}
    if(tipo!=="consultar_bling" && tipo!=="indexar"&&!tecnicoValido){
      setErro("Informe o texto e uma fonte verificável antes de propor enriquecimento.");return;
    }
    setAcao(tipo);
    try{
      const corpo=tipo==="consultar_bling"
        ? {loja_id:loja.id,acao:tipo,sku:produto.sku}
        : tipo==="propor_conecta"
          ? {loja_id:loja.id,acao:tipo,sku:produto.sku,campo:campoConecta,valor,fonte:fonteDocumento}
          : {loja_id:loja.id,acao:tipo,sku:produto.sku,campo:campoErp,valor,fonte:fonteDocumento};
      const resposta=tipo==="indexar"
        ? await fonte.chamar<{gravados?:string[];passos_pendentes?:number[];receita_faltando?:boolean}>(
          "agente",{produto_id:produto.id,idempotency_key:crypto.randomUUID()})
        : await fonte.chamar<{resultado?:unknown;observacao?:string}>("conector-ferramentas",corpo);
      if(!resposta.ok) {
        setErro(resposta.erro??"Ferramenta não executada. Revise as permissões e o histórico.");
        return;
      }
      const resultado=(resposta.dados as Record<string,unknown> | undefined)?.resultado;
      const rd=(resposta.dados??{}) as Record<string,unknown>;
      const rp=(resultado??rd) as Record<string,unknown>;
      if(rp?.erro){setErro(String(rp.erro));return}
      if(tipo==="indexar"){
        const gravados=Array.isArray(rd.gravados)?rd.gravados.filter(x=>typeof x==="string") as string[]:[];
        setIndexado(gravados);
        setMensagem(gravados.length
          ?"Indexação executada. Campos extraídos do dado nativo entraram como 'a confirmar' no Conecta.IA."
          :"Receita executada sem novos campos. Confira se já foram propostos ou se faltam fontes técnicas.");
      }else if(tipo==="consultar_bling"){
        setMensagem("Consulta nativa realizada pelo conector. Nenhum campo foi gravado.");
        setDados(resultado??rd);
      }else if(tipo==="propor_conecta"){
        setMensagem("Proposta técnica registrada no Conecta.IA. Aguarda homologação humana.");
        setDados(resultado??rd);
      }else{
        const id=rp?.proposta_id;
        setPropostaId(typeof id==="string"?id:null);
        setMensagem("Proposta de escrita preparada. O Bling NÃO foi alterado. Revise antes/depois e aprove a versão exata na Central de Inteligência.");
        setDados(resultado??rd);
      }
    }catch{
      setErro("A comunicação falhou. Confira o histórico antes de repetir para evitar duplicar propostas.");
    }finally{setAcao(null)}
  }
  return <section className="fc-raiz" aria-label="Ferramentas do catálogo Conecta.IA">
    <header className="cartao fc-cabecalho">
      <p className="fc-etapa">NANO.IA · CONECTA.IA · BLING</p>
      <h1>Indexar e enriquecer</h1>
      <p>Ferramentas reais de consulta, cadastro técnico e preparação de escrita no ERP. As aplicações e dados enriquecidos só podem ser homologados por revisão. A loja permanece em teste e não é publicada por estas operações.</p>
      <nav className="fc-atalhos" aria-label="Etapas da governança">
        <a href="#/catalogo-espelho">Espelho ERP</a>
        <a href="#/conector">Trabalhar com Nano.IA</a>
        <a href="#/central">Central de aprovação</a>
        <a href="#/studio">Studio técnico</a>
      </nav>
    </header>
    <section className="cartao">
      <h2>01 · Localizar produto físico no Bling</h2>
      <label htmlFor="fc-sku">SKU do fabricante ou cadastro ERP</label>
      <input id="fc-sku" type="search" maxLength={80} autoComplete="off" placeholder="Ex.: CI003696" value={sku}
        onChange={e=>{setSku(e.target.value);setMensagem("");setDados(null);setPropostaId(null);}} />
      {lendo&&<p className="suave">Consultando o espelho autorizado…</p>}
      {erroProduto&&<p className="msg-erro" role="status">{erroProduto}</p>}
      {produto&&<div className="fc-produto">
        <strong>{produto.nome}</strong>
        <span>SKU: <b>{produto.sku}</b> · vínculo Bling: {produto.bling_id?"identificado":"ausente"}</span>
        <span>Loja: {produto.publicado?"Produto já publicado":"Não publicado (teste)"}</span>
        <span>Descrição curta nativa: {produto.descricao_curta||"não cadastrada"}</span>
        <span>Complementar nativa: {produto.descricao_complementar||"não cadastrada"}</span>
      </div>}
      <button type="button" className="sec" disabled={!pronto||!produto} onClick={()=>void executar("consultar_bling")}>
        {acao==="consultar_bling"?"Consultando…":"Consultar produto diretamente no Bling (somente leitura)"}
      </button>
    </section>
    <section className="cartao">
      <h2>02 · Indexar dados nativos no Conecta.IA</h2>
      <p className="suave">Executa a receita técnica existente por produto e registra campos novos como pendentes. Não inventa OEM, compatibilidade ou medidas.</p>
      <button type="button" disabled={!pronto||!produto||!produto.bling_id} onClick={()=>void executar("indexar")}>
        {acao==="indexar"?"Indexando…":"Indexar este SKU"}
      </button>
    </section>
    <section className="cartao">
      <h2>03 · Propor enriquecimento com fonte</h2>
      <p>O Nano ou o lojista pode propor uma descrição, marca ou metadado com evidência. O agente não aprova a própria proposta.</p>
      <div className="fc-form">
        <label>Campo no Conecta.IA
          <select value={campoConecta} onChange={e=>setCampoConecta(e.target.value)}>
            {CAMPO_CONECTA.map(([value,label])=><option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>Campo para futura escrita no Bling
          <select value={campoErp} onChange={e=>setCampoErp(e.target.value)}>
            {CAMPO_ERP.map(([value,label])=><option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="fc-span">Conteúdo técnico proposto
          <textarea value={valor} maxLength={4000} rows={5} placeholder="Descreva somente dados técnicos sustentados por evidências."
            onChange={e=>setValor(e.target.value)} />
        </label>
        <label className="fc-span">Fonte ou documento da informação
          <input value={fonteDocumento} maxLength={500} placeholder="URL HTTPS de catálogo / identificação do manual ou documento"
            onChange={e=>setFonteDocumento(e.target.value)} />
        </label>
      </div>
      <div className="fc-botoes">
        <button type="button" disabled={!pronto||!produto||!tecnicoValido} onClick={()=>void executar("propor_conecta")}>
          {acao==="propor_conecta"?"Registrando…":"Propor no Conecta.IA"}
        </button>
        <button type="button" className="sec" disabled={!pronto||!produto||!produto.bling_id||!tecnicoValido} onClick={()=>void executar("preparar_erp")}>
          {acao==="preparar_erp"?"Preparando…":"Preparar atualização no Bling · sem gravar"}
        </button>
      </div>
      <p className="suave">A gravação final exige a Central de Inteligência: proposta versionada → simulação → aprovação humana → executor autorizado → conferência no Bling. Campos fiscais, NCM, CFOP, custo, preço, estoque, clientes e NF não são alterados aqui.</p>
    </section>
    {erro&&<p className="msg-erro" role="alert">{erro}</p>}
    {mensagem&&<section className="cartao" aria-live="polite"><h2>Resultado da ferramenta</h2>
      <p className="msg-ok">{mensagem}</p>
      {indexado.length>0&&<p>Campos indexados: {indexado.join(", ")}</p>}
      {propostaId&&<a className="botao" href={"#/central?proposta="+encodeURIComponent(propostaId)}>Abrir proposta para aprovação</a>}
      {dados&&<details><summary>Dados técnicos / relatório</summary><pre className="fc-resposta">{imprimir(dados)}</pre></details>}
    </section>}
  </section>;
}