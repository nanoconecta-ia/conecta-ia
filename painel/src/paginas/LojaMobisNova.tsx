import { Fragment, useEffect, useMemo, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { EmpresaMobis } from "../componentes/EmpresaMobis.tsx";
import { SUPABASE_URL, SUPABASE_CHAVE_PUBLICAVEL } from "../config.ts";
import { IconePeca } from "../componentes/IconePeca.tsx";
import { RodapeMobisEnxuto } from "../componentes/RodapeMobisEnxuto.tsx";
import type { PoliticasLojaPublicas } from "../componentes/RodapeLoja.tsx";
import { linkWhatsAppPublico } from "../lib/publicoLoja.ts";
import { BlocoMontadorasMobis, BlocoTaxonomiaMobis } from "../componentes/BlocosCatalogoMobis.tsx";
import { GlassyCarouselMobisV3 } from "../componentes/GlassyCarouselMobisV3.tsx";
import {intervaloPublico,ordemPublica,type BlocoComercial} from "../lib/layoutMobis.ts";
import {paletaPublicada,variaveisPaletaMobis} from "../lib/paletaMobis.ts";
import fotoHR from "../assets/veiculos-mobis/hyundai-hr.webp";
import fotoBongo from "../assets/veiculos-mobis/kia-bongo-k2500.webp";
import fotoL200 from "../assets/veiculos-mobis/mitsubishi-l200.webp";

import "./loja-mobis-nova.css";
import "./loja-mobis-branco.css";
import "./loja-mobis-clara.css";
import "./blocos-catalogo-mobis.css";
import "./mobis-paleta-dinamica.css";
import "./mobis-premium-v3.css";
import "./mobis-identidade-2026.css";
const logoMobis = "/marcas/mobis-logo-metalico-2026.webp";

/** Vitrine Mobis aprovada: exclusiva da loja pública, sem controles Conecta.IA.
 * Todo dado comercial e aplicação vem da Edge Function loja-publica, que filtra
 * publicado=true e aprovação. Nada é inferido de snapshots do Bling.
 */
type Produto = {sku:string;nome:string;preco:number|null;marca:string|null;descricao:string|null;imagem:string|null;whatsapp:string|null;em_estoque:boolean|null;atualizado_em:string|null;consulta_previa?:boolean;categoria?:string|null;referencias_aprovadas?:{tipo:string;valor:string}[]};
type Veiculo = {modelo:string;motor:string|null;de:number|null;ate:number|null};
type Banner = {sku:string;nome:string;preco:number|null;chamada:string|null;flash:boolean;whatsapp:string|null;imagem?:string|null;fim?:string|null};
type PaginaAplicacao = {slug:string;titulo:string;modelo:string;status:string};
type Resposta = {
  paginas_aplicacao?:Record<string,PaginaAplicacao[]>;
  loja:{nome:string;slug:string;ambiente?:"teste"|"producao";whatsapp?:string|null;venda_habilitada?:boolean};
  produtos:Produto[];banners?:Banner[];veiculos:Veiculo[];
  categorias:{nome:string;slug:string;total:number}[];
  politicas?:PoliticasLojaPublicas|null;
  total:number;pagina:number;por_pagina:number;
  layout?:{blocos:string[];intervalo_segundos:number};
  paleta?:unknown;
  logos_montadoras?:Record<string,string>
};
type Filtros={q:string;modelo:string;motor:string;ano:string;categoria:string;pagina:number};
const VAZIO:Filtros={q:"",modelo:"",motor:"",ano:"",categoria:"",pagina:1};
/** Atalhos por veículo. Cada modelo usa a imagem do veículo correto, enviada pelo proprietário;
 * a imagem identifica o modelo, não o ano, a versão nem a aplicação. Modelo sem imagem própria
 * não entra aqui (fica em "Outros modelos"): nunca repetir a imagem de um veículo em outro. */
const VEICULOS=[
  {nome:"Hyundai HR",valor:"HR",foto:fotoHR},
  {nome:"Kia Bongo K2500",valor:"Bongo",foto:fotoBongo},
  {nome:"Mitsubishi L200",valor:"L200",foto:fotoL200},
];
const MODELOS_FILTRO=["HR","Bongo","L200"];
const brl=(n:number)=>n.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
/** Ícone de sistema aprovado, nunca representa foto ou compatibilidade do item. */
function iconeDaCategoria(categoria:string|null|undefined):string {
  const c=(categoria??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
  if(/bandeja|suspens|amortec/.test(c))return "suspensao";
  if(/freio|pastilha|disco de freio/.test(c))return "freios";
  if(/embreagem|transmiss|cambio/.test(c))return "transmissao";
  if(/eletric|sensor|alternador/.test(c))return "eletrica";
  if(/radiador|arrefecimento|bomba.*agua|termostat/.test(c))return "arrefecimento";
  return "motor";
}
const para=(id:string)=>document.getElementById(id)?.scrollIntoView({behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth",block:"start"});
/** Links por veículo somente para aplicações tecnicamente aprovadas. */
const aplicacoesPublicas = (paginas: PaginaAplicacao[] | undefined) =>
  (paginas ?? []).filter(p => p.status === "aprovado");

export function LojaMobisNova({slug,contexto}:{slug:string;contexto?:{tipo:"veiculo"|"sistema"|"empresa";valor:string}}) {
  const [dados,setDados]=useState<Resposta|null>(null);
  const [estado,setEstado]=useState<"carregando"|"ok"|"erro"|"limite"|"naoachada">("carregando");
  const [f,setF]=useState<Filtros>(()=>contexto?.tipo==="veiculo"?{...VAZIO,modelo:contexto.valor}:contexto?.tipo==="sistema"?{...VAZIO,categoria:contexto.valor}:VAZIO);
  const [busca,setBusca]=useState("");
  const [modelo,setModelo]=useState(contexto?.tipo==="veiculo"?contexto.valor:"");
  const [motor,setMotor]=useState("");
  const [ano,setAno]=useState("");
  const [categoria,setCategoria]=useState(contexto?.tipo==="sistema"?contexto.valor:"");
  const [tentativa,setTentativa]=useState(0);
  const [lista,setLista]=useState<{sku:string;nome:string}[]>([]);
  const [aviso,setAviso]=useState("");
  const [abaBusca,setAbaBusca]=useState<"descricao"|"referencia">("descricao");
  const [consultaModelo,setConsultaModelo]=useState<string|null>(null);
  useEffect(()=>{
    let ativo=true;setDados(null);setEstado("carregando");
    fetch(SUPABASE_URL+"/functions/v1/loja-publica",{
      method:"POST",headers:{"content-type":"application/json",apikey:SUPABASE_CHAVE_PUBLICAVEL},
      body:JSON.stringify({slug,q:f.q||undefined,referencia_exata:abaBusca==="referencia" && !!f.q,modelo:f.modelo||undefined,motor:f.motor||undefined,
        ano:f.ano?Number(f.ano):undefined,categoria:f.categoria||undefined,pagina:f.pagina})
    }).then(async r=>{
      if(!ativo)return;
      if(r.status===404){setEstado("naoachada");return;}
      if(r.status===429){setEstado("limite");return;}
      if(!r.ok){setEstado("erro");return;}
      const j=(await r.json()) as Resposta;
      if(!ativo)return;
      if(j?.loja?.slug!=="mobis"||!Array.isArray(j.produtos)){setEstado("erro");return;}
      setDados(j);setEstado("ok");
    }).catch(()=>ativo&&setEstado("erro"));
    return ()=>{ativo=false};
  },[slug,f,abaBusca,tentativa]);
  useEffect(()=>{
    try {
      const raw=sessionStorage.getItem("mobis:loja:lista");
      const x:unknown=raw?JSON.parse(raw):[];
      if(Array.isArray(x))setLista(x.filter(v=>v&&typeof v.sku==="string"&&typeof v.nome==="string")
        .slice(0,10).map(v=>({sku:v.sku.slice(0,80),nome:v.nome.slice(0,140)})));
    } catch {setLista([])}
  },[]);
  useEffect(()=>{try{sessionStorage.setItem("mobis:loja:lista",JSON.stringify(lista));}catch{}},[lista]);
  useEffect(()=>{
    if(!dados)return;
    document.title="MOBIS AUTOPEÇAS | Picapes, vans e utilitários";
    let tag=document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    const anterior=tag?.content??null,criada=!tag;
    if(!tag){tag=document.createElement("meta");tag.name="robots";document.head.appendChild(tag);}
    tag.content=dados.loja.ambiente==="teste"?"noindex,nofollow":(anterior??"index,follow");
    return()=>{if(criada)tag?.remove();else if(tag&&anterior!==null)tag.content=anterior;};
  },[dados?.loja.ambiente]);
  const banners=dados?.banners??[];
  const opcoes=useMemo(()=>[...new Set((dados?.veiculos??[]).map(x=>x.modelo))].sort(),[dados?.veiculos]);
  const motores=useMemo(()=>[...new Set((dados?.veiculos??[]).filter(x=>!modelo||x.modelo===modelo)
    .map(x=>x.motor).filter((x):x is string=>!!x))].sort(),[dados?.veiculos,modelo]);
  useEffect(()=>{
    const t=busca.trim();
    if(t.length<3&&!(t.length===0&&f.q))return;
    const id=window.setTimeout(()=>setF(a=>a.q===t?a:{...a,q:t,pagina:1}),600);
    return()=>window.clearTimeout(id);
  },[busca]);
  function aplicar(e?:FormEvent){
    e?.preventDefault();
    setF({q:busca.trim(),modelo,motor,ano,categoria,pagina:1});
    para("m2-catalogo");
  }
  function consultarLinha(nome:string){
    setConsultaModelo(nome);
    para("m2-atendimento");
  }
  function escolherVeiculoAprovado(valor:string){
    // O rótulo vem dos modelos de aplicações aprovadas entregues pela API.
    setAbaBusca("descricao");setModelo(valor);setMotor("");setAno("");setCategoria("");setBusca("");
    setF({...VAZIO,modelo:valor});window.location.hash="#/loja/mobis/veiculo/"+encodeURIComponent(valor);
  }
  function escolherNoTaxonomia(slugNo:string){
    if(!dados?.categorias.some(c=>c.slug===slugNo&&c.total>0))return;
    setAbaBusca("descricao");setModelo("");setMotor("");setAno("");setCategoria(slugNo);setBusca("");
    setF({...VAZIO,categoria:slugNo});window.location.hash="#/loja/mobis/sistema/"+encodeURIComponent(slugNo);
  }
  function adicionar(p:Produto){
    if(lista.some(x=>x.sku===p.sku)){setAviso("Essa peça já consta na lista.");return;}
    if(lista.length>=10){setAviso("A lista permite até dez peças.");return;}
    setLista(a=>[...a,{sku:p.sku,nome:p.nome}]);
    setAviso("Peça adicionada à lista para consulta.");
  }
  const msg="Olá! Vim pela loja Mobis e gostaria de consultar: "+(lista.length?
    lista.map((x,i)=>String(i+1)+". "+x.nome.slice(0,90)+" SKU "+x.sku).join("; "):
    (consultaModelo?"peças para "+consultaModelo:"peças para meu veículo"))+". Favor confirmar aplicação, preço e disponibilidade. Esta é uma consulta, não um pedido.";
  const whatsapp=linkWhatsAppPublico(dados?.loja.whatsapp,msg);
  const paginas=Math.max(1,Math.ceil((dados?.total??0)/(dados?.por_pagina||24)));

  // O DOM segue a ordem publicada, inclusive para navegação por teclado e leitores de tela.
  // Header e privacidade ficam fora do editor; nenhum bloco recebe HTML arbitrário.
  const ordemLayout=ordemPublica(dados?.layout?.blocos);
  const ordemVitrine:BlocoComercial[]=["banner","catalogo",...ordemLayout.filter(id=>id!=="banner"&&id!=="catalogo"&&id!=="empresa")];
  const coresPublicas=paletaPublicada(dados?.paleta);
  const blocosSite:Record<BlocoComercial,ReactNode>={
    banner: <div data-bloco="banner"><GlassyCarouselMobisV3
      banners={banners} produtos={dados?.produtos??[]} veiculos={VEICULOS} sistemas={dados?.categorias??[]}
      intervalo={intervaloPublico(dados?.layout?.intervalo_segundos)}
      emTeste={dados?.loja.ambiente!=="producao"}/></div>,
    montadoras: <>
      <BlocoMontadorasMobis modelos={opcoes} logos={dados?.logos_montadoras} aoSelecionarModelo={escolherVeiculoAprovado} aoConsultar={consultarLinha}/>
    </>,
    taxonomia: <>
      <BlocoTaxonomiaMobis categorias={dados?.categorias??[]} aoSelecionarCategoria={escolherNoTaxonomia} aoConsultar={consultarLinha}/>
    </>,
    catalogo: <>
      <section id="m2-busca" data-bloco="filtros" className="m2-band m2-busca"><div className="m2-wrap m2-secao">
        <div className="m2-titulo"><div><span className="m2-kicker">CATÁLOGO ONLINE</span><h2>Encontre sua peça automotiva.</h2><p>Pesquise pelo veículo, sistema ou referência. Mostramos somente anúncios aprovados.</p></div></div>
        <div className="m2-modos-busca" role="tablist" aria-label="Escolher modalidade de pesquisa">
          <button role="tab" aria-selected={abaBusca==="descricao"} type="button" onClick={()=>setAbaBusca("descricao")}>Nome, peça ou sistema</button>
          <button role="tab" aria-selected={abaBusca==="referencia"} type="button" onClick={()=>setAbaBusca("referencia")}>SKU, fabricante ou OEM</button>
        </div>
        <p className="m2-ajuda-referencias">{abaBusca==="referencia"?"Localize o SKU físico ou uma referência exata aprovada de fabricante/OEM. Códigos pendentes não aparecem como equivalências.":"Pesquise por nome ou peça e refine pelos filtros. Códigos aprovados também são localizados."}</p>
        <form className="m2-search" onSubmit={aplicar} role="search" aria-label="Busca detalhada de peças"><label className="sr" htmlFor="m2-pesquisar">Buscar peça, referência ou código SKU</label><span aria-hidden="true">⌕</span>
          <input id="m2-pesquisar" maxLength={60} value={busca} onChange={e=>setBusca(e.target.value)} placeholder={abaBusca==="referencia"?"Ex.: 5074, CI000120 ou OEM homologado":"Buscar peça, referência ou código SKU"}/>
          <button type="submit">Buscar peças →</button></form>
        <form className="m2-filtros" onSubmit={aplicar}><div className="m2-filtros-topo"><div><strong>Filtre pelo seu veículo</strong><small>Use os dados do veículo para refinar a busca</small></div><button type="button" onClick={()=>{setF(VAZIO);setBusca("");setModelo("");setMotor("");setAno("");setCategoria("")}}>Limpar filtros ×</button></div>
          <div className="m2-filtros-grid">
            <label>Modelo<select aria-label="Modelo" value={modelo} onChange={e=>{setModelo(e.target.value);setMotor("")}}>
              <option value="">Todos os modelos</option>{[...new Set([...MODELOS_FILTRO,...opcoes])].map(x=><option value={x} key={x}>{x}</option>)}</select></label>
            <label>Motorização<select aria-label="Motorização" value={motor} onChange={e=>setMotor(e.target.value)}><option value="">Todos os motores</option>{motores.map(x=><option key={x}>{x}</option>)}</select></label>
            <label>Ano<input type="number" min={1980} max={new Date().getFullYear()+1} value={ano} inputMode="numeric" placeholder="Ex.: 2019" onChange={e=>setAno(e.target.value.slice(0,4))}/></label>
            <label>Sistema / categoria<select aria-label="Sistema / categoria" value={categoria} onChange={e=>setCategoria(e.target.value)}><option value="">Todas as categorias</option>{dados?.categorias.map(x=><option key={x.slug} value={x.slug}>{x.nome}</option>)}</select></label>
          </div><div className="m2-filtros-rodape"><p>Não encontrou a peça? Nossa equipe confirma a compatibilidade por modelo e versão.</p><button type="submit">Aplicar filtros</button></div>
        </form>
      </div></section>
      <section className="m2-wrap m2-secao m2-catalogo" data-bloco="produtos" id="m2-catalogo" aria-live="polite">
        <div className="m2-cab-secao"><div><span className="m2-kicker">PEÇAS E COMPONENTES</span><h2>Produtos no catálogo</h2><small>{estado==="carregando"?"Consultando…":String(dados?.total??0)+" produto(s) encontrado(s)"}</small></div><button onClick={()=>para("m2-lista")}>Minha lista <b>{lista.length}</b></button></div>
        {estado==="carregando"&&<div className="m2-vazio">Consultando catálogo público autorizado…</div>}
        {(estado==="erro"||estado==="limite")&&<div className="m2-vazio"><strong>Não foi possível carregar o catálogo.</strong><p>{estado==="limite"?"Limite de consultas atingido.":"Tente novamente."}</p><button onClick={()=>setTentativa(x=>x+1)}>Tentar novamente</button></div>}
        {estado==="naoachada"&&<div className="m2-vazio">Loja não encontrada.</div>}
        {estado==="ok"&&dados?.produtos.length===0&&<div className="m2-vazio"><div><span className="m2-kicker">ATENDIMENTO MOBIS</span><h3>{Object.entries(f).some(([k,v])=>k!=="pagina"&&Boolean(v))?"Nenhuma peça encontrada com esses filtros.":"Catálogo de peças em preparação."}</h3><p>Nenhum anúncio aprovado foi encontrado. Consulte a equipe com o veículo e a referência; isso não significa falta de estoque na loja física.</p><button onClick={()=>para("m2-atendimento")}>Consultar a equipe ↗</button></div></div>}
        {dados&&dados.produtos.length>0&&<div className="m2-produto-grade">{dados.produtos.map(p=><article key={p.sku} data-sku-fisico={p.sku} className="m2-produto">
          <div className="m2-foto-produto">
            <a href={p.consulta_previa?(p.whatsapp||"#/loja/mobis"):"#/p/mobis/"+encodeURIComponent(p.sku)} target={p.consulta_previa?undefined:"_blank"} rel={p.consulta_previa?undefined:"noopener noreferrer"} aria-label={(p.consulta_previa?"Consultar peça ":"Abrir ficha em nova aba ")+p.sku} style={{display:"block",width:"100%"}}>
              {p.imagem?<img src={p.imagem} alt={"Fotografia autorizada do produto físico "+p.sku} loading="lazy"/>:
                <div aria-label="Ilustração de categoria, não é foto da peça"><IconePeca nome={iconeDaCategoria(p.categoria)} tamanho={72}/></div>}
            </a>
          </div>
          <div><small>SKU {p.sku}{p.marca?" · "+p.marca:""}</small>
            {p.referencias_aprovadas?.length ? <div className="m2-ref-aprovadas" aria-label={"Referências aprovadas do SKU "+p.sku}>
              {p.referencias_aprovadas.map((r,i)=><span key={r.tipo+":"+r.valor+":"+i}>
                <b>{r.tipo==="fabricante"?"FABRICANTE":r.tipo==="oem"?"OEM":r.tipo.toUpperCase()}</b> {r.valor}
              </span>)}
            </div>:null}<h3>{aplicacoesPublicas(dados.paginas_aplicacao?.[p.sku]).length
                ? p.nome
                : p.nome}</h3>
            {aplicacoesPublicas(dados.paginas_aplicacao?.[p.sku]).length
              ? <div style={{margin:"12px 0",borderTop:"1px solid #e0d9ce",paddingTop:12}}>
                  <p style={{fontWeight:700}}>Páginas por veículo — aplicações aprovadas</p>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                    {aplicacoesPublicas(dados.paginas_aplicacao?.[p.sku]).map(ap=>
                      <a key={ap.slug} href={"#/a/"+ap.slug}
                        style={{display:"inline-block",padding:"8px 11px",border:"1px solid #E2181A",borderRadius:6,color:"#B01218",fontWeight:700,fontSize:13,textDecoration:"none"}}>
                        {ap.modelo} · ver ficha ↗
                      </a>)}
                  </div>
                </div>
              : p.descricao&&<p>{p.descricao.slice(0,105)}</p>}
            <strong>Preço sob consulta</strong>
            <p>Confirme aplicação e disponibilidade.</p>
            <div>{p.whatsapp&&<a href={p.whatsapp} target="_blank" rel="noopener noreferrer">Consultar no WhatsApp ↗</a>}
              {!p.consulta_previa&&<a href={"#/p/mobis/"+encodeURIComponent(p.sku)} target="_blank" rel="noopener noreferrer">Abrir ficha em nova aba ↗</a>}
              <button disabled={lista.some(x=>x.sku===p.sku)} onClick={()=>adicionar(p)}>{lista.some(x=>x.sku===p.sku)?"Na lista":"Adicionar à lista +"}</button></div>
          </div>
        </article>)}</div>}
        {dados&&paginas>1&&<nav className="m2-paginas" aria-label="Páginas de produtos"><button disabled={f.pagina<=1} onClick={()=>setF({...f,pagina:f.pagina-1})}>Anterior</button><span>{f.pagina} / {paginas}</span><button disabled={f.pagina>=paginas} onClick={()=>setF({...f,pagina:f.pagina+1})}>Próxima</button></nav>}
      </section>
    </>,
    empresa: null,
  };
  return <div className="mobis-v2 m4" id="m2-topo" data-mobis-layout="aprovado-v2" data-layout-versionado="true" data-mobis-palette="branco-gelo" data-mobis-visual="claro-v4" data-paleta-publicada={coresPublicas?"sim":"nao"} style={coresPublicas?variaveisPaletaMobis(coresPublicas) as CSSProperties:undefined}>
    <div data-bloco="cabecalho">
    <header className="m2-header"><div className="m2-wrap">
      <a className="m2-brand" href="#/loja/mobis" aria-label="MOBIS Autopeças - início" onClick={()=>window.scrollTo({top:0,behavior:"smooth"})}>
        <img src={logoMobis} width={720} height={205} alt="MOBIS Autopeças"/>
      </a>
      <nav aria-label="Menu da loja"><button onClick={()=>contexto?.tipo==="empresa"?window.location.hash="#/loja/mobis":para("m2-montadoras")}>Montadoras</button>
        <button onClick={()=>contexto?.tipo==="empresa"?window.location.hash="#/loja/mobis":para("m2-taxonomia")}>Peças por sistema</button>
        <button onClick={()=>contexto?.tipo==="empresa"?window.location.hash="#/loja/mobis":para("m2-catalogo")}>Catálogo</button>
        {banners.length>0&&<button onClick={()=>para("m2-destaques")}>Destaques</button>}
        <a className="m4-menu-empresa" href="#/loja/mobis/empresa" aria-label="Sobre a Mobis e informações da empresa">Sobre a Mobis ↗</a></nav>
      <div className="m2-header-acoes"><button onClick={()=>para("m2-lista")}>Minha lista <span>{lista.length}</span></button>
        {whatsapp&&<a href={whatsapp} target="_blank" rel="noopener noreferrer">Fale com a Mobis <span>WhatsApp ↗</span></a>}
      </div>
    </div></header>
    <div className="m2-busca-rapida"><form className="m2-wrap m4-busca" role="search" aria-label="Busca rápida de peças" onSubmit={aplicar}>
      <label className="sr" htmlFor="m2-busca-rapida">Qual peça você procura?</label>
      <input id="m2-busca-rapida" maxLength={60} value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Peça, código SKU ou OEM"/>
      <button type="submit">Buscar peças <span aria-hidden="true">→</span></button>
    </form></div>
    </div>
    <main>
      {contexto?.tipo==="empresa" ? <EmpresaMobis whatsapp={whatsapp} politicas={dados?.politicas}/> : <>{ordemVitrine.map(id=><Fragment key={id}>{blocosSite[id]}</Fragment>)}
      <section id="m2-atendimento" className="m2-atendimento">
        {consultaModelo&&<div className="m2-wrap"><p className="m4-consulta-aviso" role="status">Para {consultaModelo}, ainda não há aplicação homologada nesta lista. Nossa equipe pode consultar a referência e confirmar a peça com você.</p></div>}
        <div className="m2-wrap m2-atendimento-grid">
        <div><span className="m2-kicker">ATENDIMENTO</span><h2>Vamos encontrar a sua peça.</h2><p>Um mesmo modelo pode usar peças diferentes conforme motor, ano e versão.</p><a href="#/loja/mobis/empresa">Como consultar ↗</a></div>
        <div className="m2-contato-form"><small>CONSULTA DE PEÇAS</small><h3>Conte o que você procura</h3><p>Use os filtros acima ou monte sua lista para compartilhar com o atendimento.</p><button onClick={()=>para("m2-lista")}>Minha lista de peças ({lista.length})</button>{whatsapp&&<a href={whatsapp} target="_blank" rel="noopener noreferrer">Continuar no WhatsApp ↗</a>}<small>Você poderá revisar a mensagem antes de enviá-la.</small></div>
      </div></section>
      <section className="m2-wrap m2-secao m2-lista" id="m2-lista" aria-label="Lista de consulta">
        <div className="m2-cab-secao"><div><span className="m2-kicker">CONSULTA, NÃO PEDIDO</span><h2>Minha lista de peças</h2><p>Monte até 10 peças e envie para a equipe confirmar.</p></div><span>{lista.length}/10</span></div>
        {aviso&&<p role="status">{aviso}</p>}
        {lista.length===0?<p>Nenhuma peça selecionada. Utilize os botões do catálogo.</p>:<ul>{lista.map(x=><li key={x.sku}><span>{x.nome}<small>SKU: {x.sku}</small></span><button onClick={()=>setLista(v=>v.filter(p=>p.sku!==x.sku))}>Retirar</button></li>)}</ul>}
        {lista.length>0&&<div>{whatsapp&&<a href={whatsapp} target="_blank" rel="noopener noreferrer">Consultar no WhatsApp ↗</a>}<button onClick={()=>{setLista([]);setAviso("")}}>Limpar lista</button></div>}
        <p className="m2-legenda">Não envie CPF ou dados bancários. <a href="#/loja/mobis/empresa">Como consultar</a></p>
      </section>
      </>}
    </main>
    <RodapeMobisEnxuto nome={dados?.loja.nome??"Mobis Autopeças"} whatsapp={dados?.loja.whatsapp}/>
  </div>;
}
