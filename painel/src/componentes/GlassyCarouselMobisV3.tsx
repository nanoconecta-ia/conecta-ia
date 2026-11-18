import { useEffect, useState } from "react";
import { IconePeca } from "./IconePeca.tsx";
import "./glassy-carousel-mobis-v3.css";
import iconeMotor from "../assets/icones3d/peca-motor.webp";
import iconeSuspensao from "../assets/icones3d/peca-suspensao.webp";
import iconeTransmissao from "../assets/icones3d/peca-transmissao.webp";
import iconeFreios from "../assets/icones3d/peca-freios.webp";
import iconeArrefecimento from "../assets/icones3d/peca-arrefecimento.webp";
import iconeEletrica from "../assets/icones3d/peca-eletrica.webp";

type Banner = { sku:string; nome:string; preco:number|null; chamada:string|null; flash:boolean; imagem?:string|null; fim?:string|null };
type Produto = { sku:string; nome:string; preco:number|null; imagem:string|null; marca:string|null; consulta_previa?:boolean; whatsapp?:string|null };
type Veiculo = { nome:string; foto:string; valor:string };
type Sistema = { nome:string; slug:string; total:number };
type Slide = {
  id:string; tipo:"campanha"|"produto"|"consulta"|"veiculo"|"sistema"; titulo:string; subtitulo:string;
  etiqueta:string; imagem:string|null; url:string; preco:number|null; sku:string|null; flash:boolean;
};

const moeda=(valor:number)=>valor.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
/** Ícone 3D aprovado do sistema, pela mesma regra da taxonomia (nunca é foto de produto). */
function iconeDoSistema(nome:string,slug:string):string{
  const x=(nome+" "+slug).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
  if(/suspens|bandeja|amortec|direc/.test(x))return iconeSuspensao;
  if(/freio|abs/.test(x))return iconeFreios;
  if(/transmiss|embreagem|cambio/.test(x))return iconeTransmissao;
  if(/arrefec|radiador/.test(x))return iconeArrefecimento;
  if(/eletric|alternador|sensor/.test(x))return iconeEletrica;
  return iconeMotor;
}
/** Glassy Carousel V3 — só produtos públicos vindos da API ou imagens de veículos já fornecidas.
 * Nenhum banner fictício, equivalência OEM inferida ou produto clonado.
 */
export function GlassyCarouselMobisV3({
  banners,produtos,veiculos,sistemas=[],intervalo=6,emTeste=false,
}:{
  banners:readonly Banner[];produtos:readonly Produto[];veiculos:readonly Veiculo[];
  sistemas?:readonly Sistema[];
  intervalo?:number;emTeste?:boolean;
}){
  const [atual,setAtual]=useState(0);
  const [pausado,setPausado]=useState(false);
  const slides:Slide[]=banners.length>0
    ? banners.map((b,i)=>({
      id:"banner-"+b.sku+"-"+i,tipo:"campanha",titulo:b.chamada||b.nome,
      subtitulo:b.nome,etiqueta:b.flash?"FLASH · OFERTA":"DESTAQUE MOBIS",
      imagem:b.imagem||null,url:"#/p/mobis/"+encodeURIComponent(b.sku),
      preco:b.preco,sku:b.sku,flash:b.flash,
    }))
    : sistemas.some(x=>x.total>0&&x.slug!=="sem-classificacao")
    ? sistemas.filter(x=>x.total>0&&x.slug!=="sem-classificacao").slice(0,6).map(x=>({
      id:"sistema-"+x.slug,tipo:"sistema",titulo:x.nome,
      subtitulo:x.total+(x.total===1?" peça publicada":" peças publicadas")+" · ver o sistema",
      etiqueta:"SISTEMA DO VEÍCULO",imagem:iconeDoSistema(x.nome,x.slug),
      url:"#/loja/mobis/sistema/"+encodeURIComponent(x.slug),preco:null,sku:null,flash:false,
    }))
    : produtos.length>0
    ? produtos.slice(0,6).map(p=>({
      id:"produto-"+p.sku,tipo:p.consulta_previa?"consulta":"produto",
      titulo:p.nome,subtitulo:p.consulta_previa?"Prévia de catálogo · aplicação a confirmar":p.marca||"Peça do catálogo",
      etiqueta:p.consulta_previa?"CONSULTA PRÉVIA · SEM VENDA":"PRODUTO DO CATÁLOGO",imagem:p.imagem||null,
      url:p.consulta_previa?(p.whatsapp||"#/loja/mobis"):"#/p/mobis/"+encodeURIComponent(p.sku),
      preco:p.consulta_previa?null:p.preco,sku:p.sku,flash:false,
    }))
    : veiculos.map(v=>({
      id:"veiculo-"+v.valor,tipo:"veiculo",titulo:v.nome,
      subtitulo:"Veja modelos e consulte peças compatíveis por aplicação aprovada",
      etiqueta:"LINHA DE ATENDIMENTO",imagem:v.foto,
      url:"#/loja/mobis/veiculo/"+encodeURIComponent(v.valor),preco:null,sku:null,flash:false,
    }));
  const indice=Math.min(atual,Math.max(0,slides.length-1));
  const slide=slides[indice];
  const intervaloSeguro=Number.isFinite(intervalo)?Math.min(15,Math.max(4,intervalo)):6;
  useEffect(()=>setAtual(0),[banners[0]?.sku,sistemas[0]?.slug,produtos[0]?.sku,veiculos[0]?.valor]);
  useEffect(()=>{
    if(slides.length<2||pausado||window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;
    const timer=window.setInterval(()=>{if(!document.hidden)setAtual(n=>(n+1)%slides.length);},intervaloSeguro*1000);
    return()=>window.clearInterval(timer);
  },[slides.length,pausado,intervaloSeguro]);
  if(!slide)return null;
  const mover=(passo:number)=>setAtual(n=>(n+passo+slides.length)%slides.length);
  return <section id="m2-destaques" className="gcv3" data-glassy-carousel="v3" aria-label="Vitrine Mobis em carrossel dinâmico"
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
          <a className="gcv3-cta" href={slide.url}>{slide.tipo==="veiculo"?"Ver linha de veículos":slide.tipo==="sistema"?"Ver peças do sistema":slide.tipo==="consulta"?"Consultar peça no atendimento":"Ver ficha e aplicações"} <span aria-hidden="true">→</span></a>
          {slide.tipo!=="veiculo"&&slide.tipo!=="sistema"&&<small className="gcv3-nota">Compatibilidade, preço e disponibilidade sujeitos à confirmação no atendimento. A prévia não é um anúncio homologado.</small>}
        </div>
        <a key={"foto-"+slide.id} className={"gcv3-midia"+(slide.imagem?"":" gcv3-sem-foto")} href={slide.url}
          aria-label={"Abrir "+slide.titulo}>
          {slide.imagem?<img src={slide.imagem} alt={slide.tipo==="veiculo"?slide.titulo:slide.tipo==="sistema"?"Ícone do sistema "+slide.titulo:"Foto aprovada do produto "+slide.sku} loading={indice===0?"eager":"lazy"} decoding="async"/>:
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
