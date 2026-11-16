import { useEffect, useMemo, useState, type FormEvent } from "react";
import { EmpresaMobis } from "../componentes/EmpresaMobis.tsx";
import { SUPABASE_URL, SUPABASE_CHAVE_PUBLICAVEL } from "../config.ts";
import { IconePeca, IconeVeiculo } from "../componentes/IconePeca.tsx";
import { RodapeLoja, type PoliticasLojaPublicas } from "../componentes/RodapeLoja.tsx";
import { ChatClienteLoja } from "../componentes/ChatClienteLoja.tsx";
import { linkWhatsAppPublico } from "../lib/publicoLoja.ts";
import { modeloDoAtalho, podeExibirProdutoTeste } from "../lib/mobisVitrine.ts";
import { ProdutoTesteMobis } from "../componentes/ProdutoTesteMobis.tsx";
import { CarrosselVidroMobis } from "../componentes/CarrosselVidroMobis.tsx";
import { BannersInstitucionaisMobis } from "../componentes/BannersInstitucionaisMobis.tsx";
import { VitrineFotograficaMobis, FOTOS_VEICULOS_MOBIS } from "../componentes/VitrineFotograficaMobis.tsx";
import logoMobis from "../assets/marcas/mobis-oficial-fundo-claro.png";
import "./loja-mobis-nova.css";
import "./loja-mobis-branco.css";
import "./loja-mobis-layout-vermelho.css";

/** Vitrine Mobis aprovada: exclusiva da loja pública, sem controles Conecta.IA.
 * Todo dado comercial e aplicação vem da Edge Function loja-publica, que filtra
 * publicado=true e aprovação. Nada é inferido de snapshots do Bling.
 */
type Produto = {sku:string;nome:string;preco:number|null;marca:string|null;descricao:string|null;imagem:string|null;whatsapp:string|null;em_estoque:boolean|null;atualizado_em:string|null;consulta_previa?:boolean;categoria?:string|null;referencias_aprovadas?:{tipo:string;valor:string}[]};
type Veiculo = {modelo:string;motor:string|null;de:number|null;ate:number|null};
type Banner = {sku:string;nome:string;preco:number|null;chamada:string|null;flash:boolean;whatsapp:string|null};
type PaginaAplicacao = {slug:string;titulo:string;modelo:string;status:string};
type Resposta = {
  paginas_aplicacao?:Record<string,PaginaAplicacao[]>;
  loja:{nome:string;slug:string;ambiente?:"teste"|"producao";whatsapp?:string|null;venda_habilitada?:boolean};
  produtos:Produto[];banners?:Banner[];veiculos:Veiculo[];
  categorias:{nome:string;slug:string;total:number}[];
  politicas?:PoliticasLojaPublicas|null;
  total:number;pagina:number;por_pagina:number
};
type Filtros={q:string;modelo:string;motor:string;ano:string;categoria:string;pagina:number};
const VAZIO:Filtros={q:"",modelo:"",motor:"",ano:"",categoria:"",pagina:1};
const VEICULOS=[
  {nome:"Hyundai HR",valor:"HR",icone:"caminhao",nota:"Peças para o utilitário do dia a dia"},
  {nome:"Kia Bongo K2500",valor:"Bongo",icone:"caminhao",nota:"Encontre componentes para seu Bongo"},
  {nome:"Mitsubishi L200",valor:"L200",icone:"picape",nota:"Peças para sua picape; confirme a versão"},
  {nome:"Outro veículo",valor:"",icone:"furgao",nota:"Consulte nossa equipe com os dados do modelo"},
];
const SISTEMAS=[
  {nome:"Motor",id:"motor",busca:"motor"},
  {nome:"Arrefecimento",id:"arrefecimento",busca:"arrefecimento"},
  {nome:"Freios",id:"freios",busca:"freios"},
  {nome:"Suspensão",id:"suspensao",busca:"suspensao"},
  {nome:"Transmissão",id:"transmissao",busca:"transmissao"},
  {nome:"Elétrica",id:"eletrica",busca:"eletrica"},
  {nome:"Injeção e turbo",id:"alimentacao",busca:"injecao"},
  {nome:"Distribuição",id:"motor",busca:"correias"},
];
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

export function LojaMobisNova({slug}:{slug:string}) {
  const [dados,setDados]=useState<Resposta|null>(null);
  const [estado,setEstado]=useState<"carregando"|"ok"|"erro"|"limite"|"naoachada">("carregando");
  const [f,setF]=useState<Filtros>(VAZIO);
  const [busca,setBusca]=useState("");
  const [modelo,setModelo]=useState("");
  const [motor,setMotor]=useState("");
  const [ano,setAno]=useState("");
  const [categoria,setCategoria]=useState("");
  const [tentativa,setTentativa]=useState(0);
  const [lista,setLista]=useState<{sku:string;nome:string}[]>([]);
  const [aviso,setAviso]=useState("");
  const [slide,setSlide]=useState(0);
  const [pausa,setPausa]=useState(false);
  const [explorar,setExplorar]=useState<"veiculo"|"sistema">("veiculo");
  const [abaBusca,setAbaBusca]=useState<"descricao"|"referencia">("descricao");
  const [consultaModelo,setConsultaModelo]=useState<string|null>(null);
  const produtoTeste=podeExibirProdutoTeste(dados?.loja);
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
  useEffect(()=>setSlide(0),[banners[0]?.sku]);
  useEffect(()=>{
    if(banners.length<2||pausa||window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;
    const t=window.setInterval(()=>{if(!document.hidden)setSlide(i=>(i+1)%banners.length);},6500);
    return()=>window.clearInterval(t);
  },[banners.length,pausa]);
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
  function escolherVeiculo(valor:string){
    setAbaBusca("descricao");
    const escolhido=modeloDoAtalho(valor,opcoes);
    setModelo(escolhido);setMotor("");setAno("");setCategoria("");setBusca("");
    setF({...VAZIO,modelo:escolhido});
    para("m2-busca");
  }
  function escolherSistema(valor:string){
    setAbaBusca("descricao");
    const cat=dados?.categorias.find(c=>c.slug===valor||c.nome.toLowerCase()===valor);
    setModelo("");setMotor("");setAno("");setCategoria(cat?.slug??"");setBusca(cat?"":valor);
    setF({...VAZIO,categoria:cat?.slug??"",q:cat?"":valor});
    para("m2-busca");
  }
  function adicionar(p:Produto){
    if(lista.some(x=>x.sku===p.sku)){setAviso("Essa peça já consta na lista.");return;}
    if(lista.length>=10){setAviso("A lista permite até dez peças.");return;}
    setLista(a=>[...a,{sku:p.sku,nome:p.nome}]);
    setAviso("Peça adicionada à lista para consulta.");
  }
  const msg="Olá! Vim pela loja Mobis e gostaria de consultar: "+(lista.length?
    lista.map((x,i)=>String(i+1)+". "+x.nome.slice(0,90)+" SKU "+x.sku).join("; "):
    "peças para meu veículo")+". Favor confirmar aplicação, preço e disponibilidade. Esta é uma consulta, não um pedido.";
  const whatsapp=linkWhatsAppPublico(dados?.loja.whatsapp,msg);
  const paginas=Math.max(1,Math.ceil((dados?.total??0)/(dados?.por_pagina||24)));
  return <div className="mobis-v2" id="m2-topo" data-mobis-layout="aprovado-v2" data-mobis-palette="branco-gelo" data-mobis-visual="fotografico-v3">
    <div className="m2-micro"><div className="m2-wrap"><span>Goiás, Brasil <b>/</b> Especialistas em picapes, vans e utilitários diesel</span><span>Aplicação conferida por veículo e chassi <em>✓</em></span></div></div>
    <header className="m2-header"><div className="m2-wrap">
      <a className="m2-brand" href="#/loja/mobis" aria-label="MOBIS Autopeças - início" onClick={()=>window.scrollTo({top:0,behavior:"smooth"})}>
        <img src={logoMobis} width={720} height={128} alt="MOBIS Autopeças"/>
      </a>
      <nav aria-label="Menu da loja"><button onClick={()=>{setExplorar("veiculo");para("m2-explorar")}}>Seu veículo</button>
        <button onClick={()=>{setExplorar("sistema");para("m2-explorar")}}>Peças por sistema</button>
        <button onClick={()=>para("m2-catalogo")}>Catálogo</button>
        <button onClick={()=>para("m2-destaques")}>Destaques</button>
        <button onClick={()=>para("m2-empresa")}>A Mobis</button></nav>
      <div className="m2-header-acoes"><button onClick={()=>para("m2-lista")}>Minha lista <span>{lista.length}</span></button>
        {whatsapp&&<a href={whatsapp} target="_blank" rel="noopener noreferrer">Fale com a Mobis <span>WhatsApp ↗</span></a>}
      </div>
    </div></header>
    <div className="m2-busca-rapida"><div className="m2-wrap m3-nav">
      <button className="m3-nav-categories" type="button" onClick={()=>para("m3-categorias")} aria-label="Ver todas as categorias">☰ <span>Todas as categorias</span></button>
      <form role="search" aria-label="Busca rápida de peças" onSubmit={aplicar}>
        <label className="sr" htmlFor="m2-busca-rapida">Qual peça você procura?</label>
        <input id="m2-busca-rapida" maxLength={60} value={busca} onChange={e=>setBusca(e.target.value)}
          placeholder="Código OEM, SKU, peça ou aplicação…"/>
        <button type="submit">Buscar peças ↗</button>
      </form>
      <button className="m3-nav-vehicles" type="button" onClick={()=>{setExplorar("veiculo");para("m2-explorar")}}>▰ Escolher meu veículo</button>
      {whatsapp&&<a className="m3-nav-wa" href={whatsapp} target="_blank" rel="noopener noreferrer">WhatsApp <small>Consultar peças</small></a>}
    </div></div>
    {dados?.loja.ambiente==="teste"&&<div className="m2-aviso-teste" role="status"><strong>LOJA TESTE</strong> · Catálogo em preparação. Consulte peças e aplicações pelo WhatsApp. Preços e disponibilidade a confirmar; não concluímos pedidos nem recebemos pagamentos neste site.</div>}
    <main>
      <VitrineFotograficaMobis
        abrirEscolha={()=>{setExplorar("veiculo");para("m2-explorar");}}
        escolherVeiculo={escolherVeiculo}
        temAplicacao={valor=>Boolean(modeloDoAtalho(valor,opcoes))}
        consultarVeiculo={valor=>{setConsultaModelo(valor);para("m2-atendimento")}}
        escolherSistema={escolherSistema}
        buscarCodigo={()=>{setAbaBusca("referencia");para("m2-busca");document.getElementById("m2-pesquisar")?.focus({preventScroll:true});}}
      />
      {produtoTeste&&<div className="m3-shortcut-teste"><button type="button" onClick={()=>para("m2-produto-teste")}>Ver produto de teste →</button></div>}
      <div className="m2-progresso"><div className="m2-wrap"><span><b>01</b> Atendimento especializado</span>
        <span><b>02</b> Aplicação conferida com você</span><span><b>03</b> Consulta direta via WhatsApp</span></div></div>
      {produtoTeste&&<ProdutoTesteMobis/>}
      <div className="m2-wrap"><BannersInstitucionaisMobis
        abrirCatalogo={()=>para("m2-catalogo")}
        destaqueMotor={dados?.produtos.find(p=>p.sku==="CI003696")??null}
        abrirDestaque={()=>{setAbaBusca("referencia");setBusca("CI003696");setModelo("");setMotor("");setAno("");setCategoria("");setF({...VAZIO,q:"CI003696"});para("m2-catalogo");}}
        abrirVeiculos={()=>{setExplorar("veiculo");para("m2-explorar")}}
        abrirBuscaCodigos={()=>{setAbaBusca("referencia");setBusca("");setModelo("");setMotor("");setAno("");setCategoria("");setF(VAZIO);para("m2-busca");window.setTimeout(()=>document.getElementById("m2-pesquisar")?.focus({preventScroll:true}),100)}}
      /></div>
      <div className="m2-wrap"><CarrosselVidroMobis aoSelecionar={escolherSistema}/></div>
      <section id="m2-destaques" className="m2-wrap m2-secao m2-destaques">
        <div className="m2-cab-secao"><div><span className="m2-kicker">LOJA ONLINE MOBIS</span><h2>Peças automotivas para a sua rotina</h2></div><button onClick={()=>para("m2-catalogo")}>Ver catálogo ↗</button></div>
        <div className="m2-trio">
          <article className="m2-bloco m2-bloco1"><small>MOTOR E INJEÇÃO DIESEL</small><h3>O desempenho do seu utilitário começa aqui.</h3><p>Encontre referências pelo veículo ou código da peça.</p><button onClick={()=>escolherSistema("motor")}>Explorar peças ↗</button></article>
          <article className="m2-bloco m2-bloco2"><small>BUSCA INTELIGENTE</small><h3>A peça certa para o veículo certo.</h3><p>Filtre por modelo, motor, ano e categoria.</p><button onClick={()=>para("m2-busca")}>Buscar por veículo ↗</button></article>
          <article className="m2-bloco m2-bloco3"><small>ATENDIMENTO MOBIS</small><h3>Precisa de ajuda para escolher?</h3><p>Nossa equipe confirma a aplicação e disponibilidade.</p><button onClick={()=>para("m2-atendimento")}>Falar com a equipe ↗</button></article>
        </div>
        {banners.length>0&&<div className="m2-flash" onMouseEnter={()=>setPausa(true)} onMouseLeave={()=>setPausa(false)} onFocusCapture={()=>setPausa(true)} onBlurCapture={()=>setPausa(false)}>
          <div><span className="m2-kicker">{dados?.loja.ambiente==="teste"?"PRÉVIA DE OFERTA · TESTE":"DESTAQUE · OFERTA"}</span>
            <h3>{banners[Math.min(slide,banners.length-1)].nome}</h3>
            <p>{banners[Math.min(slide,banners.length-1)].chamada??"Confirme a aplicação com a equipe."}</p>
            {banners[Math.min(slide,banners.length-1)].preco!=null&&<strong>{brl(banners[Math.min(slide,banners.length-1)].preco!)}</strong>}</div>
          <a href={"#/p/mobis/"+encodeURIComponent(banners[Math.min(slide,banners.length-1)].sku)}>Ver detalhes ↗</a>
          {banners.length>1&&<div className="m2-flash-controles"><button aria-label="Banner anterior" onClick={()=>setSlide((slide+banners.length-1)%banners.length)}>‹</button>
            <span>{slide+1}/{banners.length}</span><button aria-label="Próximo banner" onClick={()=>setSlide((slide+1)%banners.length)}>›</button>
            <button onClick={()=>setPausa(!pausa)}>{pausa?"Reativar":"Pausar"}</button></div>}
        </div>}
      </section>
      <section id="m2-explorar" className="m2-band m2-veiculos"><div className="m2-wrap m2-secao">
        <div className="m2-titulo"><div><span className="m2-kicker">ENCONTRE PELO CAMINHO MAIS FÁCIL</span><h2>Comece pelo veículo ou pelo sistema</h2><p>Escolha uma das opções e veja as peças disponíveis na loja.</p></div></div>
        <div className="m2-empresa-abas" role="tablist" aria-label="Como explorar o catálogo">
          <button role="tab" aria-selected={explorar==="veiculo"} onClick={()=>setExplorar("veiculo")}>Qual é o seu veículo?</button>
          <button role="tab" aria-selected={explorar==="sistema"} onClick={()=>setExplorar("sistema")}>O que ele precisa?</button>
        </div>
        {explorar==="veiculo"&&<div id="m2-veiculos" role="tabpanel"><div className="m2-veiculo-grade">
          {FOTOS_VEICULOS_MOBIS.map(v=><button className="m2-veiculo m3-veiculo-card" key={v.nome}
            onClick={()=>{if(modeloDoAtalho(v.valor,opcoes)){escolherVeiculo(v.valor)}else{setConsultaModelo(v.nome);para("m2-atendimento")}}}>
            <div><img src={v.foto} alt={v.alt} loading="lazy" decoding="async"/></div>
            <strong>{v.nome}</strong>
            <small>{modeloDoAtalho(v.valor,opcoes)?"Peças cadastradas por aplicação":"Consulte a aplicação com nossa equipe"}</small>
            <span>{modeloDoAtalho(v.valor,opcoes)?"Encontrar peças":"Consultar modelo"} <b>↗</b></span>
          </button>)}
          <button className="m2-veiculo m3-veiculo-generico" onClick={()=>{setConsultaModelo("outros modelos");para("m2-atendimento")}}>
            <div><IconeVeiculo tipo="furgao" largura={157}/></div><strong>Outros modelos</strong>
            <small>Consulte com chassi, ano e motor</small><span>Falar com a equipe <b>↗</b></span>
          </button>
        </div></div>}
        {explorar==="sistema"&&<div id="m2-sistemas" role="tabpanel"><div className="m2-sistema-grade">{SISTEMAS.map(s=><button key={s.nome} onClick={()=>escolherSistema(s.busca)}>
          <IconePeca nome={s.id} tamanho={90}/><span>{s.nome}</span><i>↗</i></button>)}</div>
        <small className="m2-legenda">Ilustrações das categorias. Consulte aplicação e disponibilidade antes de comprar.</small></div>}
      </div></section>
      <section id="m2-busca" className="m2-band m2-busca"><div className="m2-wrap m2-secao">
        <div className="m2-titulo"><div><span className="m2-kicker">CATÁLOGO ONLINE</span><h2>Encontre sua peça automotiva.</h2><p>Pesquise pelo veículo, sistema ou referência. Mostramos somente anúncios aprovados.</p></div><span>03 / 04</span></div>
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
              <option value="">Todos os modelos</option>{[...new Set([...VEICULOS.map(x=>x.valor).filter(Boolean),...opcoes])].map(x=><option value={x} key={x}>{x}</option>)}</select></label>
            <label>Motorização<select aria-label="Motorização" value={motor} onChange={e=>setMotor(e.target.value)}><option value="">Todos os motores</option>{motores.map(x=><option key={x}>{x}</option>)}</select></label>
            <label>Ano<input type="number" min={1980} max={new Date().getFullYear()+1} value={ano} inputMode="numeric" placeholder="Ex.: 2019" onChange={e=>setAno(e.target.value.slice(0,4))}/></label>
            <label>Sistema / categoria<select aria-label="Sistema / categoria" value={categoria} onChange={e=>setCategoria(e.target.value)}><option value="">Todas as categorias</option>{dados?.categorias.map(x=><option key={x.slug} value={x.slug}>{x.nome}</option>)}</select></label>
          </div><div className="m2-filtros-rodape"><p>Não encontrou a peça? Nossa equipe confirma a compatibilidade por modelo e versão.</p><button type="submit">Aplicar filtros</button></div>
        </form>
      </div></section>
      <section className="m2-wrap m2-secao m2-catalogo" id="m2-catalogo" aria-live="polite">
        <div className="m2-cab-secao"><div><span className="m2-kicker">PEÇAS E COMPONENTES</span><h2>Produtos no catálogo</h2><small>{estado==="carregando"?"Consultando…":String(dados?.total??0)+" produto(s) encontrado(s)"}</small></div><button onClick={()=>para("m2-lista")}>Minha lista <b>{lista.length}</b></button></div>
        {estado==="carregando"&&<div className="m2-vazio">Consultando catálogo público autorizado…</div>}
        {(estado==="erro"||estado==="limite")&&<div className="m2-vazio"><strong>Não foi possível carregar o catálogo.</strong><p>{estado==="limite"?"Limite de consultas atingido.":"Tente novamente."}</p><button onClick={()=>setTentativa(x=>x+1)}>Tentar novamente</button></div>}
        {estado==="naoachada"&&<div className="m2-vazio">Loja não encontrada.</div>}
        {estado==="ok"&&dados?.produtos.length===0&&<div className="m2-vazio"><div><span className="m2-kicker">ATENDIMENTO MOBIS</span><h3>{Object.entries(f).some(([k,v])=>k!=="pagina"&&Boolean(v))?"Nenhuma peça encontrada com esses filtros.":"Catálogo de peças em preparação."}</h3><p>Nenhum anúncio aprovado foi encontrado. Consulte a equipe com o veículo e a referência; isso não significa falta de estoque na loja física.</p><button onClick={()=>para("m2-atendimento")}>Consultar a equipe ↗</button></div></div>}
        {dados&&dados.produtos.length>0&&<div className="m2-produto-grade">{dados.produtos.map(p=><article key={p.sku} className="m2-produto">
          <div className="m2-foto-produto">
            {dados.paginas_aplicacao?.[p.sku]?.length
              ? <a href={"#/a/"+dados.paginas_aplicacao[p.sku][0].slug} aria-label={"Ver aplicações e fotografia do produto "+p.sku}
                  style={{display:"block",width:"100%"}}>
                  {p.imagem?<img src={p.imagem} alt={"Fotografia do produto físico "+p.sku} loading="lazy"/>:
                   <div aria-label="Ilustração de categoria, não é foto da peça"><IconePeca nome={iconeDaCategoria(p.categoria)} tamanho={72}/></div>}
                </a>
              : p.imagem?<img src={p.imagem} alt={p.nome} loading="lazy"/>:
                <div aria-label="Ilustração de categoria, não é foto da peça"><IconePeca nome={iconeDaCategoria(p.categoria)} tamanho={72}/></div>}
          </div>
          <div><small>SKU {p.sku}{p.marca?" · "+p.marca:""}</small>
            {p.referencias_aprovadas?.length ? <div className="m2-ref-aprovadas" aria-label={"Referências aprovadas do SKU "+p.sku}>
              {p.referencias_aprovadas.map((r,i)=><span key={r.tipo+":"+r.valor+":"+i}>
                <b>{r.tipo==="fabricante"?"FABRICANTE":r.tipo==="oem"?"OEM":r.tipo.toUpperCase()}</b> {r.valor}
              </span>)}
            </div>:null}<h3>{dados.paginas_aplicacao?.[p.sku]?.length
                ? (p.sku==="CI002916"?"Motor parcial Trim Go — escolha o veículo":p.nome)
                : p.nome}</h3>
            {dados.paginas_aplicacao?.[p.sku]?.length
              ? <div style={{margin:"12px 0",borderTop:"1px solid #e0d9ce",paddingTop:12}}>
                  <p style={{fontWeight:700}}>Páginas por veículo — aplicação em revisão</p>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                    {dados.paginas_aplicacao[p.sku].map(ap=>
                      <a key={ap.slug} href={"#/a/"+ap.slug}
                        style={{display:"inline-block",padding:"8px 11px",border:"1px solid #c25a1b",borderRadius:6,color:"#914a27",fontWeight:700,fontSize:13,textDecoration:"none"}}>
                        {ap.modelo} · ver ficha ↗
                      </a>)}
                  </div>
                </div>
              : p.descricao&&<p>{p.descricao.slice(0,220)}</p>}
            <strong>{p.consulta_previa?"Preço sob consulta":p.preco==null?"Consulte o preço":brl(p.preco)}</strong>
            <p>{p.consulta_previa?"Prévia de catálogo · aplicação e disponibilidade precisam ser confirmadas.":"Disponibilidade a confirmar"}</p>
            <div>{p.consulta_previa
                ? p.whatsapp&&<a href={p.whatsapp} target="_blank" rel="noopener noreferrer">Consultar no WhatsApp ↗</a>
                : <a href={"#/p/mobis/"+encodeURIComponent(p.sku)}>Ver ficha da peça</a>}
              <button disabled={lista.some(x=>x.sku===p.sku)} onClick={()=>adicionar(p)}>{lista.some(x=>x.sku===p.sku)?"Na lista":"Adicionar à lista +"}</button></div>
          </div>
        </article>)}</div>}
        {dados&&paginas>1&&<nav className="m2-paginas" aria-label="Páginas de produtos"><button disabled={f.pagina<=1} onClick={()=>setF({...f,pagina:f.pagina-1})}>Anterior</button><span>{f.pagina} / {paginas}</span><button disabled={f.pagina>=paginas} onClick={()=>setF({...f,pagina:f.pagina+1})}>Próxima</button></nav>}
        <p className="m2-legenda">Preços, aplicação e disponibilidade devem ser confirmados antes da compra. A lista não reserva estoque nem cria pedido.</p>
      </section>
      <EmpresaMobis whatsapp={whatsapp}/>
      <section id="m2-atendimento" className="m2-atendimento">
        {consultaModelo&&<div className="m2-wrap"><p className="m3-consulta-aviso" role="status">Para {consultaModelo}, ainda não há aplicação homologada nesta lista. Nossa equipe pode consultar a referência e confirmar a peça pelo chassi.</p></div>}
        <div className="m2-wrap m2-atendimento-grid">
        <div><span className="m2-kicker">CONVERSA DIGITAL · ESCOLHA COM CUIDADO</span><h2>Vamos encontrar a sua peça.</h2><p>Um mesmo modelo pode usar peças diferentes conforme motor, ano e versão. Envie essas informações para uma consulta mais precisa.</p><div className="m2-conselho">✓ A equipe confere os detalhes antes de você comprar.</div></div>
        <div className="m2-contato-form"><small>CONSULTA DE PEÇAS</small><h3>Conte o que você procura</h3><p>Use os filtros acima ou monte sua lista para compartilhar com o atendimento.</p><button onClick={()=>para("m2-lista")}>Minha lista de peças ({lista.length})</button>{whatsapp&&<a href={whatsapp} target="_blank" rel="noopener noreferrer">Continuar no WhatsApp ↗</a>}<small>Você poderá revisar a mensagem antes de enviá-la.</small></div>
      </div></section>
      <section className="m2-wrap m2-secao m2-lista" id="m2-lista" aria-label="Lista de consulta">
        <div className="m2-cab-secao"><div><span className="m2-kicker">CONSULTA, NÃO PEDIDO</span><h2>Minha lista de peças</h2></div><span>{lista.length}/10</span></div>
        {aviso&&<p role="status">{aviso}</p>}
        {lista.length===0?<p>Nenhuma peça selecionada. Utilize os botões do catálogo.</p>:<ul>{lista.map(x=><li key={x.sku}><span>{x.nome}<small>SKU: {x.sku}</small></span><button onClick={()=>setLista(v=>v.filter(p=>p.sku!==x.sku))}>Retirar</button></li>)}</ul>}
        {lista.length>0&&<div>{whatsapp&&<a href={whatsapp} target="_blank" rel="noopener noreferrer">Consultar no WhatsApp ↗</a>}<button onClick={()=>{setLista([]);setAviso("")}}>Limpar lista</button></div>}
        <p>Não informe CPF, chassi completo, senha ou dados bancários no chat. A lista é só consulta e não conclui compra.</p>
      </section>
    </main>
    <RodapeLoja nome={dados?.loja.nome??"Mobis Autopeças"} slug="mobis" whatsapp={dados?.loja.whatsapp} politicas={dados?.politicas} ultima={dados?.produtos.map(x=>x.atualizado_em).filter(Boolean).sort().at(-1)} secoes={{catalogo:"m2-catalogo",veiculo:"m2-busca",categoria:"m2-explorar",empresa:"m2-empresa"}}/>
    <ChatClienteLoja nome={dados?.loja.nome??"Mobis Autopeças"} whatsapp={dados?.loja.whatsapp}/>
  </div>;
}
