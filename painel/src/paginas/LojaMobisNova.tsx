import { useEffect, useMemo, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { EmpresaMobis } from "../componentes/EmpresaMobis.tsx";
import { SUPABASE_URL, SUPABASE_CHAVE_PUBLICAVEL } from "../config.ts";
import { IconePeca } from "../componentes/IconePeca.tsx";
import { RodapeMobisEnxuto } from "../componentes/RodapeMobisEnxuto.tsx";
import type { PoliticasLojaPublicas } from "../componentes/RodapeLoja.tsx";
import { linkWhatsAppPublico } from "../lib/publicoLoja.ts";
import { GlassyCarouselMobisV3 } from "../componentes/GlassyCarouselMobisV3.tsx";
import {CabecalhoMobisV3,AplicacoesMobisV3,SETORES_MOBIS_V3} from "../componentes/LojaMobisInstitucionalV3.tsx";
import {intervaloPublico} from "../lib/layoutMobis.ts";
import {paletaPublicada,variaveisPaletaMobis} from "../lib/paletaMobis.ts";
import fotoHR from "../assets/veiculos-mobis/hyundai-hr.webp";
import fotoBongo from "../assets/veiculos-mobis/kia-bongo-k2500.webp";
import fotoL200 from "../assets/veiculos-mobis/mitsubishi-l200.webp";
import logoMobis from "../assets/marcas/mobis-mstyle-v3-sem-slogan.svg";
import "./loja-mobis-nova.css";
import "./loja-mobis-branco.css";
import "./loja-mobis-clara.css";
import "./mobis-paleta-dinamica.css";
import "./mobis-premium-v3.css";
import "./mobis-ma-identidade.css";
import "./mobis-vitrine-completa-v3.css";
import "./mobis-v3-limpo.css";

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
  const [abaBusca,setAbaBusca]=useState<"descricao"|"referencia">("descricao");
  const [departamentoAtivo,setDepartamentoAtivo]=useState<string|null>(null);
  const [departamentoPendente,setDepartamentoPendente]=useState<{chave:string;nome:string}|null>(null);
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
    // Sem bloco de atendimento duplicado: consulta contextual abre diretamente o canal oficial.
    const url=linkWhatsAppPublico(dados?.loja.whatsapp,
      "Olá! Vim pela loja Mobis para consultar peças da linha/sistema "+nome.slice(0,100)+
      ". Pode confirmar aplicação, preço e disponibilidade?");
    if(url)window.open(url,"_blank","noopener,noreferrer");
    else window.location.hash="#/loja/mobis/empresa";
  }
  /** Departamento sem catálogo publicado continua sendo um filtro — jamais um atalho ao WhatsApp. */
  function selecionarDepartamento(chave:string,nome:string){
    const setor=SETORES_MOBIS_V3.find(s=>s.chave===chave);
    if(!setor)return;
    const categorias=dados?.categorias??[];
    const normalizar=(v:string)=>v.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
    const no=categorias.find(c=>normalizar(c.slug)===chave)
      ??categorias.find(c=>setor.termos.test(c.nome)||setor.termos.test(c.slug));
    const categoriaEscolhida=no?.slug??chave;
    setDepartamentoAtivo(chave);
    setDepartamentoPendente(no?null:{chave,nome});
    setModelo("");setMotor("");setAno("");setCategoria(categoriaEscolhida);
    setBusca("");setAbaBusca("descricao");
    setF({...VAZIO,categoria:categoriaEscolhida});
    window.requestAnimationFrame(()=>para("ms-aplicacoes"));
  }
  const whatsapp=linkWhatsAppPublico(dados?.loja.whatsapp,
    "Olá! Vim pelo site da MOBIS AUTOPEÇAS e gostaria de consultar uma peça. Pode confirmar aplicação, preço e disponibilidade?");
  const irVitrine=(id:string)=>contexto?.tipo==="empresa"?(window.location.hash="#/loja/mobis"):para(id);
  const paginas=Math.max(1,Math.ceil((dados?.total??0)/(dados?.por_pagina||24)));

  // A MOBIS V3 exibe somente banner e catálogo. Blocos legados do layout no banco
  // ficam preservados para auditoria, mas não são montados na vitrine pública.
  const ordemVitrine=["banner","catalogo"] as const;
  const coresPublicas=paletaPublicada(dados?.paleta);
  // V3 visual somente quando a paleta oficial foi aprovada/publicada pela rotina da loja.
  // A logo e o favicon V3 já são os arquivos originais; cores antigas publicadas não são sobrepostas.
  const v3Publicada=!!coresPublicas &&
    coresPublicas.cor_fundo==="#eaf2f6" &&
    coresPublicas.cor_botao==="#e2181a" &&
    coresPublicas.cor_acento==="#e2181a";
  const blocosSite:Record<(typeof ordemVitrine)[number],ReactNode>={
    banner: <div data-bloco="banner"><GlassyCarouselMobisV3
      banners={banners} veiculos={VEICULOS}
      intervalo={intervaloPublico(dados?.layout?.intervalo_segundos)}/></div>,
    catalogo: <>
      <section className="m2-wrap m2-secao m2-catalogo" data-bloco="produtos" id="m2-catalogo" aria-live="polite">
        <div className="m2-cab-secao"><div><span className="m2-kicker">PEÇAS E COMPONENTES</span><h2>Produtos no catálogo</h2><small>{estado==="carregando"?"Consultando…":estado==="ok"?(dados?.total??0)>0?String(dados?.total??0)+" produtos para consulta":"Novos itens em preparação":""}</small></div></div>
        {estado==="carregando"&&<div className="m2-vazio">Consultando catálogo público autorizado…</div>}
        {(estado==="erro"||estado==="limite")&&<div className="m2-vazio"><strong>Não foi possível carregar o catálogo.</strong><p>{estado==="limite"?"Limite de consultas atingido.":"Tente novamente."}</p><button onClick={()=>setTentativa(x=>x+1)}>Tentar novamente</button></div>}
        {estado==="naoachada"&&<div className="m2-vazio">Loja não encontrada.</div>}
        {estado==="ok"&&dados?.produtos.length===0&&<p className="m2-catalogo-discreto" role="status">
          {Object.entries(f).some(([k,v])=>k!=="pagina"&&Boolean(v))
            ?"Ainda não há peças liberadas para esses filtros."
            :"Itens em organização por aplicação aprovada."}
        </p>}
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
                        style={{display:"inline-block",padding:"8px 11px",border:"1px solid #E2181A",borderRadius:6,color:"#b50009",fontWeight:700,fontSize:13,textDecoration:"none"}}>
                        {ap.modelo} · ver ficha ↗
                      </a>)}
                  </div>
                </div>
              : p.descricao&&<p>{p.descricao.slice(0,105)}</p>}
            <strong>Preço sob consulta</strong>
            <p>Confirme aplicação e disponibilidade.</p>
            <div>{p.whatsapp&&<a href={p.whatsapp} target="_blank" rel="noopener noreferrer">Consultar no WhatsApp ↗</a>}
              {!p.consulta_previa&&<a href={"#/p/mobis/"+encodeURIComponent(p.sku)} target="_blank" rel="noopener noreferrer">Abrir ficha em nova aba ↗</a>}
            </div>
          </div>
        </article>)}</div>}
        {dados&&paginas>1&&<nav className="m2-paginas" aria-label="Páginas de produtos"><button disabled={f.pagina<=1} onClick={()=>setF({...f,pagina:f.pagina-1})}>Anterior</button><span>{f.pagina} / {paginas}</span><button disabled={f.pagina>=paginas} onClick={()=>setF({...f,pagina:f.pagina+1})}>Próxima</button></nav>}
      </section>
    </>,
  };
  return <div className="mobis-v2 m4" id="m2-topo" data-mobis-layout="aprovado-v2" data-mobis-site="v3" data-layout-versionado="true" data-mobis-palette="branco-gelo" data-mobis-visual="claro-v4" data-paleta-publicada={coresPublicas?"sim":"nao"} data-mobis-v3-publicada={v3Publicada?"sim":"nao"} style={coresPublicas?variaveisPaletaMobis(coresPublicas) as CSSProperties:undefined}>
    <CabecalhoMobisV3
       busca={busca} onBusca={setBusca} onEnviar={aplicar} whatsapp={whatsapp} exata={abaBusca==="referencia"} onExata={v=>setAbaBusca(v?"referencia":"descricao")}
       ir={irVitrine} categorias={dados?.categorias??[]} selecionarDepartamento={selecionarDepartamento}
       departamentoAtivo={departamentoAtivo??undefined} bannersPresentes={banners.length>0}/>
    <main>
      {contexto?.tipo==="empresa" ? <EmpresaMobis whatsapp={whatsapp} politicas={dados?.politicas}/> : <>
       {blocosSite.banner}
       <AplicacoesMobisV3 categorias={dados?.categorias??[]} opcoes={opcoes} motores={motores}
         f={{modelo,motor,ano,categoria}} onModelo={v=>{setModelo(v);setMotor("");}} onMotor={setMotor}
         onAno={setAno} onCategoria={setCategoria} onAplicar={aplicar}
         departamentoPendente={departamentoPendente}
         onLimpar={()=>{setF(VAZIO);setBusca("");setModelo("");setMotor("");setAno("");setCategoria("");setAbaBusca("descricao");setDepartamentoAtivo(null);setDepartamentoPendente(null);}}/>
       {blocosSite.catalogo}
      </>}
    </main>
    <RodapeMobisEnxuto nome={dados?.loja.nome??"Mobis Autopeças"} whatsapp={dados?.loja.whatsapp} politicas={dados?.politicas}/>
  </div>;
}
