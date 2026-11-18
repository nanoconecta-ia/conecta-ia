import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { SUPABASE_URL, SUPABASE_CHAVE_PUBLICAVEL } from "../config.ts";
import { IconePeca } from "./IconePeca.tsx";
import "./ficha-flutuante-mobis.css";

export type ProdutoConsultaMobis = {
  sku:string; nome:string; marca:string|null; descricao:string|null; imagem:string|null;
  preco:number|null; em_estoque:boolean|null; consulta_previa?:boolean; whatsapp?:string|null;
  categoria?:string|null; referencias_aprovadas?:{tipo:string;valor:string}[];
};
type AplicacaoAprovada = {
  modelo:string; montadora:string|null; motorizacao:string|null;
  ano_inicial:number|null; ano_final:number|null;
  pagina_slug:string|null; titulo:string|null; restricao:string|null;
};
type Detalhes = {
  descricao_cadastro:string|null; condicao:string|null; categoria:string|null;
  categoria_status:string|null; peso_kg:number|null;
  largura_cm:number|null; altura_cm:number|null; profundidade_cm:number|null;
  fotos:string[]; texto_tecnico_aprovado:string|null;
  aplicacoes:AplicacaoAprovada[];
};
type RespostaFicha = {
  loja?:{slug:string;ambiente?:string;venda_habilitada?:boolean};
  produtos?:ProdutoConsultaMobis[];
  ficha?:{detalhes?:Detalhes}|null;
};
const moeda=(v:number)=>v.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const periodo=(a:AplicacaoAprovada)=>(a.ano_inicial??"início a confirmar")+" – "+(a.ano_final??"fim a confirmar");
const validarWhatsapp=(v:string|null|undefined)=>typeof v==="string"&&/^https:\/\/wa\.me\/55\d{10,11}\?text=/.test(v)?v:null;

/**
 * Ficha matriz de UM SKU físico. As abas-filhas são páginas de aplicação aprovadas
 * e nunca constituem novos produtos, códigos SKU, preços ou saldos de estoque.
 * É montada em portal, sobre o catálogo, sem redirecionar a consulta ao WhatsApp.
 */
export function FichaFlutuanteMobis({ sku, inicial, aoFechar, aoAdicionar, jaNaLista }:{
  sku:string; inicial?:ProdutoConsultaMobis|null; aoFechar:()=>void;
  aoAdicionar:(produto:ProdutoConsultaMobis)=>void; jaNaLista:boolean;
}){
  const [produto,setProduto]=useState<ProdutoConsultaMobis|null>(inicial??null);
  const [detalhes,setDetalhes]=useState<Detalhes|null>(null);
  const [estado,setEstado]=useState<"carregando"|"ok"|"erro">("carregando");
  const [foto,setFoto]=useState(0);
  const [fotoFalhou,setFotoFalhou]=useState(false);
  const [filha,setFilha]=useState<number|null>(null);
  const [aviso,setAviso]=useState("");
  const fecharRef=useRef<HTMLButtonElement>(null);
  const painelRef=useRef<HTMLElement>(null);
  useEffect(()=>{
    let ativo=true;
    setProduto(inicial??null);setDetalhes(null);setEstado("carregando");
    setFoto(0);setFilha(null);setFotoFalhou(false);
    fetch(SUPABASE_URL+"/functions/v1/loja-publica",{
      method:"POST",headers:{"content-type":"application/json",apikey:SUPABASE_CHAVE_PUBLICAVEL},
      body:JSON.stringify({slug:"mobis",sku,q:sku,referencia_exata:true,pagina:1}),
    }).then(async r=>{
      if(!r.ok)throw Error("Ficha indisponível");
      const j=(await r.json()) as RespostaFicha;
      if(!ativo)return;
      const exato=j.produtos?.find(p=>p.sku===sku);
      if(!exato||j.loja?.slug!=="mobis"||!j.ficha){setEstado("erro");return;}
      // Defesa adicional do cliente: prévias nunca podem exibir valores comerciais.
      setProduto({...exato,preco:exato.consulta_previa?null:exato.preco,
        em_estoque:exato.consulta_previa?null:exato.em_estoque});
      setDetalhes(j.ficha.detalhes??null);setEstado("ok");
    }).catch(()=>{if(ativo)setEstado("erro")});
    return()=>{ativo=false};
  },[sku]);
  useEffect(()=>{
    const anterior=document.activeElement instanceof HTMLElement?document.activeElement:null;
    const overflow=document.body.style.overflow;document.body.style.overflow="hidden";
    fecharRef.current?.focus();
    const aoTeclado=(e:KeyboardEvent)=>{
      if(e.key==="Escape"){e.preventDefault();aoFechar();return;}
      if(e.key!=="Tab"||!painelRef.current)return;
      const focaveis=Array.from(painelRef.current.querySelectorAll<HTMLElement>(
        'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex="0"]'
      )).filter(x=>x.getClientRects().length>0);
      if(!focaveis.length)return;
      const primeiro=focaveis[0],ultimo=focaveis[focaveis.length-1];
      if(e.shiftKey&&document.activeElement===primeiro){e.preventDefault();ultimo.focus();}
      else if(!e.shiftKey&&document.activeElement===ultimo){e.preventDefault();primeiro.focus();}
    };
    window.addEventListener("keydown",aoTeclado);
    return()=>{window.removeEventListener("keydown",aoTeclado);document.body.style.overflow=overflow;anterior?.focus()};
  },[aoFechar]);
  const fotos=detalhes?.fotos?.filter(x=>/^https:\/\//.test(x))??[];
  if(!fotos.length&&produto?.imagem&&/^https:\/\//.test(produto.imagem))fotos.push(produto.imagem);
  const aplicacoes=detalhes?.aplicacoes??[];
  const ativa=filha===null?null:aplicacoes[filha]??null;
  const whatsapp=validarWhatsapp(produto?.whatsapp);
  const link=window.location.origin+window.location.pathname+window.location.search+"#/p/mobis/"+encodeURIComponent(sku);
  const compartilhar=async()=>{
    try{
      if(navigator.share)await navigator.share({title:produto?.nome??"Peça MOBIS",url:link});
      else if(navigator.clipboard){await navigator.clipboard.writeText(link);setAviso("Link da ficha copiado.");}
      else setAviso("Use o endereço da página para compartilhar a ficha.");
    }catch{/* O cliente cancelou o compartilhamento. */}
  };
  const copiar=async()=>{
    try{await navigator.clipboard.writeText(link);setAviso("Link da ficha copiado.");}
    catch{setAviso("Copie o endereço exibido na barra do navegador.");}
  };
  const facebook="https://www.facebook.com/sharer/sharer.php?u="+encodeURIComponent(link);
  return createPortal(<div className="mf-fundo" data-mobis-ficha-aberta={sku} onMouseDown={e=>{if(e.target===e.currentTarget)aoFechar()}}>
    <section className="mf-painel" role="dialog" aria-modal="true" aria-labelledby="mf-titulo" ref={painelRef}>
      <header className="mf-cabecalho">
        <div><span className="mf-marca">MOBIS AUTOPEÇAS · FICHA TÉCNICA</span><small>Produto físico único · SKU {sku}</small></div>
        <button ref={fecharRef} type="button" onClick={aoFechar} aria-label="Fechar a ficha e retornar ao catálogo">✕ <span>Fechar</span></button>
      </header>
      <div className="mf-conteudo">
        {estado==="carregando"&&<p className="mf-estado" role="status">Conferindo a ficha e os dados aprovados…</p>}
        {estado==="erro"&&<p className="mf-estado" role="alert">Não foi possível conferir os dados completos desta peça. Nenhuma aplicação nem preço foi assumido. Feche e tente novamente.</p>}
        {produto&&<>
          <div className="mf-corpo">
            <div className="mf-galeria" aria-label="Galeria de fotos do produto">
              <div className="mf-foto-principal">{fotos.length>0&&!fotoFalhou
                ?<img src={fotos[Math.min(foto,fotos.length-1)]} onError={()=>setFotoFalhou(true)}
                    alt={"Foto autorizada da peça "+sku+" — imagem "+(foto+1)} />
                :<div className="mf-sem-foto"><IconePeca nome="motor" tamanho={85}/><span>Imagem ilustrativa de categoria; fotografia da peça não disponível</span></div>}
              </div>
              {fotos.length>1&&<div className="mf-miniaturas">{fotos.map((url,i)=>
                <button key={url+"-"+i} type="button" aria-label={"Visualizar fotografia "+(i+1)}
                  aria-pressed={foto===i} onClick={()=>{setFoto(i);setFotoFalhou(false)}}>
                  <img src={url} alt={""} loading="lazy"/>
                </button>)}</div>}
              <p className="mf-disclaimer">Somente fotografias liberadas para exibição. Imagem ilustrativa não comprova aplicação.</p>
            </div>
            <div className="mf-dados">
              {produto.consulta_previa&&<span className="mf-selo">PRÉVIA DE CADASTRO · SEM VENDA ONLINE</span>}
              <h2 id="mf-titulo">{produto.nome}</h2>
              <div className="mf-dados-basicos"><div><small>SKU físico</small><strong>{produto.sku}</strong></div>
                <div><small>Marca da peça</small><strong>{produto.marca??"Marca a confirmar"}</strong></div>
                <div><small>Condição cadastrada</small><strong>{detalhes?.condicao??"A confirmar"}</strong></div>
                <div><small>Sistema / taxonomia</small><strong>{detalhes?.categoria??produto.categoria??"Classificação pendente"}</strong>
                  {detalhes?.categoria_status!=="aprovado"&&<small>Classificação técnica em revisão</small>}</div>
              </div>
              {produto.referencias_aprovadas?.length? <div className="mf-referencias"><h3>Referências homologadas</h3>
                <div>{produto.referencias_aprovadas.map((r,i)=><span key={r.tipo+r.valor+i}><b>{r.tipo.toUpperCase()}</b> {r.valor}</span>)}</div></div>
                :<p className="mf-disclaimer">Não há referências OEM ou fabricante homologadas para exibir nesta ficha.</p>}
              <div className="mf-preco"><strong>{produto.consulta_previa||produto.preco===null?"Preço sob consulta":moeda(produto.preco)}</strong>
                <small>Compatibilidade, preço e disponibilidade sujeitos à confirmação pela equipe.</small></div>
            </div>
          </div>
          <section className="mf-secao" aria-label="Dados e descrição do cadastro"><h3>Informações da peça</h3>
            <p>{detalhes?.descricao_cadastro??produto.descricao??"Descrição técnica completa ainda não homologada."}</p>
            {detalhes?.texto_tecnico_aprovado&&<div className="mf-tecnica"><strong>Boletim técnico aprovado</strong><p>{detalhes.texto_tecnico_aprovado}</p></div>}
            {(detalhes?.peso_kg!=null||detalhes?.largura_cm!=null||detalhes?.altura_cm!=null||detalhes?.profundidade_cm!=null)&&
              <div className="mf-medidas"><strong>Medidas cadastradas (embalagem, sujeitas a conferência)</strong>
                <p>{detalhes.peso_kg!=null?"Peso: "+detalhes.peso_kg+" kg · ":""}
                  {[detalhes.largura_cm,detalhes.altura_cm,detalhes.profundidade_cm].some(v=>v!=null)
                    ?"L × A × P: "+[detalhes.largura_cm,detalhes.altura_cm,detalhes.profundidade_cm].map(v=>v==null?"?":v+" cm").join(" × "):""}</p></div>}
          </section>
          <section className="mf-secao" aria-label="Aplicações por montadora e veículo">
            <h3>Veículos e páginas por aplicação</h3>
            <p>Uma peça física (SKU matriz) pode ter várias páginas-filhas. Cada vínculo depende de aprovação técnica e não duplica estoque.</p>
            <div className="mf-abas" role="group" aria-label="Escolher página de aplicação">
              <button type="button" aria-pressed={filha===null} onClick={()=>setFilha(null)}>Ficha matriz · {sku}</button>
              {aplicacoes.map((a,i)=><button type="button" key={a.modelo+"-"+i}
                aria-pressed={filha===i} onClick={()=>setFilha(i)}>{a.modelo}</button>)}
            </div>
            {ativa?<div className="mf-aplicacao"><strong>{ativa.titulo??ativa.modelo}</strong>
                <dl><div><dt>Montadora</dt><dd>{ativa.montadora??"Não informada"}</dd></div>
                  <div><dt>Modelo</dt><dd>{ativa.modelo}</dd></div>
                  <div><dt>Motorização</dt><dd>{ativa.motorizacao??"A confirmar"}</dd></div>
                  <div><dt>Ano inicial / final</dt><dd>{periodo(ativa)}</dd></div></dl>
                {ativa.restricao&&<p><strong>Restrição aprovada:</strong> {ativa.restricao}</p>}
                {ativa.pagina_slug&&<a href={"#/a/"+encodeURIComponent(ativa.pagina_slug)}>Abrir link individual desta aplicação ↗</a>}
              </div>
              :<p className="mf-aplicacao-vazia">{aplicacoes.length
                ?"Escolha uma página-filha para conferir o modelo, o motor e os anos aprovados."
                :"As aplicações por HR, Bongo, L200 e outras linhas estão em revisão. Ainda não existe vínculo de compatibilidade aprovado para este SKU."}</p>}
          </section>
        </>}
      </div>
      <footer className="mf-barra" aria-label="Ações e redes sociais da ficha">
        {whatsapp&&<a className="mf-whatsapp" href={whatsapp} target="_blank" rel="noopener noreferrer">WhatsApp · consultar vendedor</a>}
        <button type="button" onClick={()=>produto&&aoAdicionar(produto)} disabled={!produto||jaNaLista}>{jaNaLista?"Na minha lista":"Adicionar à lista +"}</button>
        <button type="button" onClick={()=>void compartilhar()}>Compartilhar</button>
        <a href={facebook} target="_blank" rel="noopener noreferrer">Facebook</a>
        <button type="button" onClick={()=>void copiar()}>Copiar link</button>
        {aviso&&<span role="status" className="mf-aviso">{aviso}</span>}
      </footer>
    </section>
  </div>,document.body);
}
