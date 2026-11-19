import { useEffect, useState } from "react";
import { IconePeca } from "./IconePeca.tsx";
import "./glassy-carousel-mobis-v3.css";

type Banner = { sku:string; nome:string; preco:number|null; chamada:string|null; flash:boolean; imagem?:string|null; fim?:string|null };
type Veiculo = { nome:string; foto:string; valor:string };
type PerfilAprovado = { slug:string; titulo:string; modelo:string; status:string };
type PaginasPorSku = Readonly<Record<string,readonly PerfilAprovado[]>>;
/** A imagem diferencia a linha de veículos, nunca comprova aplicação técnica. */
function fotoDaLinha(modelo:string,veiculos:readonly Veiculo[]):string|null{
  const m=modelo.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
  if(/\bhr\b/.test(m))return veiculos.find(v=>v.valor==="HR")?.foto??null;
  if(/\bbongo\b|\bk2500\b/.test(m))return veiculos.find(v=>v.valor==="Bongo")?.foto??null;
  if(/\bl200\b/.test(m))return veiculos.find(v=>v.valor==="L200")?.foto??null;
  return null;
}
const slugValido=(s:string)=>/^[a-z0-9-]{4,110}$/.test(s);
const paginasAprovadas=(paginas:readonly PerfilAprovado[]|undefined)=>
  (paginas??[]).filter(p=>p.status==="aprovado"&&slugValido(p.slug)).sort((a,b)=>a.modelo.localeCompare(b.modelo,"pt-BR"));
type Slide = {
  id:string; tipo:"campanha"|"veiculo"|"aplicacao"; titulo:string; subtitulo:string;
  etiqueta:string; imagem:string|null; url:string; preco:number|null; sku:string|null; flash:boolean;
};

const moeda=(valor:number)=>valor.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
/** Glassy Carousel V3 — só produtos públicos vindos da API ou imagens de veículos já fornecidas.
 * Nenhum banner fictício, equivalência OEM inferida ou produto clonado.
 */
export function GlassyCarouselMobisV3({
  banners,veiculos,paginasPorSku={},intervalo=6,
}:{
  banners:readonly Banner[];veiculos:readonly Veiculo[];
  paginasPorSku?:PaginasPorSku;
  intervalo?:number;
}){
  const [atual,setAtual]=useState(0);
  const [pausado,setPausado]=useState(false);
  // Somente campanhas da API e aplicações aprovadas podem criar banners comerciais.
  // Um SKU físico pode ter banners por veículo, cada um com rota distinta de aplicação.
  // Em preparação, a linha continua apontando à busca do veículo; nunca a uma página 404.
  const campanhas:Slide[]=banners.flatMap((b,i)=>{
    const perfis=paginasAprovadas(paginasPorSku[b.sku]);
    if(!perfis.length)return [{
      id:"banner-"+b.sku+"-"+i,tipo:"campanha" as const,titulo:b.chamada||b.nome,
      subtitulo:b.nome,etiqueta:b.flash?"FLASH · OFERTA":"DESTAQUE MOBIS",
      imagem:b.imagem||null,url:"#/p/mobis/"+encodeURIComponent(b.sku),
      preco:b.preco,sku:b.sku,flash:b.flash,
    }];
    return perfis.map(a=>({
      id:"banner-"+b.sku+"-"+a.slug,tipo:"aplicacao" as const,
      titulo:a.titulo||a.modelo+" · "+b.nome,
      subtitulo:"Perfil individual de aplicação: "+a.modelo,
      etiqueta:"MOBIS · "+a.modelo.toUpperCase(),
      imagem:fotoDaLinha(a.modelo,veiculos)??b.imagem??null,
      url:"#/a/"+a.slug,preco:null,sku:b.sku,flash:false,
    }));
  });
  // Os banners institucionais por modelo já são individuais (HR / Bongo / L200).
  // A página de um motor só substitui o destino do modelo quando a API a liberou.
  const perfilCI003696=paginasAprovadas(paginasPorSku["CI003696"]);
  const slides:Slide[]=campanhas.length>0?campanhas:veiculos.map(v=>{
    const aplicacao=perfilCI003696.find(a=>fotoDaLinha(a.modelo,[v])===v.foto);
    return {
      id:"veiculo-"+v.valor,tipo:aplicacao?"aplicacao":"veiculo",
      titulo:aplicacao?(aplicacao.titulo||v.nome):v.nome,
      subtitulo:aplicacao
        ?"Perfil de aplicação para "+v.nome+" · SKU CI003696"
        :"Veja modelos e consulte peças por aplicação tecnicamente aprovada",
      etiqueta:aplicacao?"PERFIL "+v.nome.toUpperCase():"LINHA "+v.nome.toUpperCase(),
      imagem:v.foto,url:aplicacao?"#/a/"+aplicacao.slug:"#/loja/mobis/veiculo/"+encodeURIComponent(v.valor),
      preco:null,sku:aplicacao?"CI003696":null,flash:false,
    };
  });
  const indice=Math.min(atual,Math.max(0,slides.length-1));
  const slide=slides[indice];
  const intervaloSeguro=Number.isFinite(intervalo)?Math.min(15,Math.max(4,intervalo)):6;
  useEffect(()=>setAtual(0),[banners[0]?.sku,veiculos[0]?.valor,paginasPorSku["CI003696"]?.[0]?.slug]);
  useEffect(()=>{
    if(slides.length<2||pausado||window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;
    const timer=window.setInterval(()=>{if(!document.hidden)setAtual(n=>(n+1)%slides.length);},intervaloSeguro*1000);
    return()=>window.clearInterval(timer);
  },[slides.length,pausado,intervaloSeguro]);
  if(!slide)return null;
  const mover=(passo:number)=>setAtual(n=>(n+passo+slides.length)%slides.length);
  return <section id="m2-destaques" className="gcv3" data-glassy-carousel="v3" aria-label="Banners MOBIS por veículo e produto"
    onMouseEnter={()=>setPausado(true)} onMouseLeave={()=>setPausado(false)}
    onFocusCapture={()=>setPausado(true)} onBlurCapture={()=>setPausado(false)}>
    <div className="m2-wrap">
      <div className="gcv3-topo"><span>Mobis Autopeças <b aria-hidden="true">/</b> Vitrine comercial</span>
        <span>{String(indice+1).padStart(2,"0")} / {String(slides.length).padStart(2,"0")}</span>
      </div>
      <div className="gcv3-painel" role="region" aria-roledescription="carrossel"
        onKeyDown={e=>{if(e.key==="ArrowRight"){e.preventDefault();mover(1);}if(e.key==="ArrowLeft"){e.preventDefault();mover(-1);}}}>
        <div className="gcv3-copy" key={"copy-"+slide.id}>
          <span className={"gcv3-etiqueta"+(slide.flash?" gcv3-etiqueta-flash":"")}>{slide.etiqueta}</span>
          <h1><a className="gcv3-titulo-link" href={slide.url}>{slide.titulo}</a></h1>
          {slide.subtitulo!==slide.titulo&&<p>{slide.subtitulo}</p>}
          {slide.sku&&<small className="gcv3-sku">SKU {slide.sku}</small>}
          {slide.preco!=null&&slide.preco>0&&<strong className="gcv3-preco">{moeda(slide.preco)}</strong>}
          <a className="gcv3-cta" href={slide.url}>{slide.tipo==="veiculo"?"Ver peças desta linha":slide.tipo==="aplicacao"?"Ver página desta aplicação":"Ver ficha e aplicações"} <span aria-hidden="true">→</span></a>
          {slide.tipo!=="veiculo"&&<small className="gcv3-nota">Compatibilidade, preço e disponibilidade sujeitos à confirmação no atendimento.</small>}
        </div>
        <a key={"foto-"+slide.id} className={"gcv3-midia"+(slide.imagem?"":" gcv3-sem-foto")} href={slide.url}
          aria-label={"Abrir "+slide.titulo}>
          {slide.imagem?<img src={slide.imagem} alt={slide.tipo==="veiculo"||slide.tipo==="aplicacao"?"Imagem de referência da linha "+slide.titulo:"Foto aprovada do produto "+slide.sku} loading={indice===0?"eager":"lazy"} decoding="async"/>:
            <div className="gcv3-placeholder"><IconePeca nome="motor" tamanho={98}/><span>Imagem do produto em preparação</span></div>}
        </a>
        {slides.length>1&&<div className="gcv3-navegacao" aria-label="Navegar pelos destaques">
          <button type="button" onClick={()=>mover(-1)} aria-label="Destaque anterior">‹</button>
          <button type="button" onClick={()=>mover(1)} aria-label="Próximo destaque">›</button>
        </div>}
      </div>
      {slides.length>1&&<div className="gcv3-paginacao" role="group" aria-label="Selecionar destaque">
        {slides.map((s,i)=><button type="button" key={s.id} onClick={()=>setAtual(i)}
          aria-label={"Destaque "+(i+1)+": "+s.titulo} aria-current={i===indice?"true":undefined}
          className={i===indice?"gcv3-ponto ativo":"gcv3-ponto"}/>)}
        <button type="button" className="gcv3-pausa" onClick={()=>setPausado(a=>!a)} aria-pressed={pausado}>
          {pausado?"Reiniciar rotação":"Pausar rotação"}
        </button>
      </div>}
    </div>
  </section>;
}
