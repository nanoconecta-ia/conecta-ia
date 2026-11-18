import { useEffect, useState } from "react";
import { SUPABASE_URL, SUPABASE_CHAVE_PUBLICAVEL } from "../config.ts";
import { IconePeca, IconeVeiculo } from "../componentes/IconePeca.tsx";
import logoMobis from "../assets/marcas/mobis-oficial-fundo-claro.png";
import "./loja-mobis-nova.css";

type Aplicacao = {
  slug:string; titulo:string; descricao:string; modelo:string;
  motorizacao:string|null; ano_inicial:number|null; ano_final:number|null;
  status:string; indexavel:boolean; sku_pai:string; marca:string|null;
  categoria:string|null; fotos:string[]; preco:null; estoque:null; whatsapp:string|null
};
type Resposta = {loja:{nome:string;slug:string;ambiente:string};pagina_aplicacao:Aplicacao};

/** Identificador visual de modelo, sem placa nem fotografia de terceiro. */
function identidadeVeiculo(modelo:string){
  if(/^Hyundai\b/i.test(modelo))return {montadora:"HYUNDAI",tipo:"caminhao"};
  if(/^Kia\b/i.test(modelo))return {montadora:"KIA",tipo:"caminhao"};
  if(/^Mitsubishi\b/i.test(modelo))return {montadora:"MITSUBISHI",tipo:/Pajero/i.test(modelo)?"picape":"picape"};
  return {montadora:"MONTADORA A CONFIRMAR",tipo:"picape"};
}

export function PaginaAplicacaoMobis({slug}:{slug:string}){
  const [dados,setDados]=useState<Resposta|null>(null);
  const [estado,setEstado]=useState<"carregando"|"erro"|"ok">("carregando");
  useEffect(()=>{
    let montado=true;
    document.title="MOBIS AUTOPEÇAS — Aplicação de peça";
    setEstado("carregando");
    fetch(SUPABASE_URL+"/functions/v1/loja-publica",{
      method:"POST",headers:{"content-type":"application/json",apikey:SUPABASE_CHAVE_PUBLICAVEL},
      body:JSON.stringify({slug:"mobis",aplicacao_slug:slug})
    }).then(async r=>{
      if(!r.ok)throw Error("pagina indisponivel");
      const x=(await r.json()) as Resposta;
      if(!x.pagina_aplicacao||x.loja?.slug!=="mobis")throw Error("resposta invalida");
      if(montado){setDados(x);setEstado("ok");document.title=x.pagina_aplicacao.titulo+" | MOBIS AUTOPEÇAS";}
    }).catch(()=>{if(montado)setEstado("erro")});
    return ()=>{montado=false;document.title="MOBIS AUTOPEÇAS"};
  },[slug]);
  const p=dados?.pagina_aplicacao;
  const foto=p?.fotos?.[0]??null;
  const veiculo=identidadeVeiculo(p?.modelo??"");
  const categoria=(p?.categoria??"").toLowerCase();
  const icone=/bandeja|suspens/.test(categoria)?"suspensao":/filtro/.test(categoria)?"filtros":"motor";
  return <main className="mobis-v2" style={{minHeight:"100vh",background:"#f7f8fa",color:"#1f2327",paddingBottom:45}}>
    <header style={{background:"#fff",borderBottom:"1px solid #dfe4e8",padding:"14px max(16px, calc((100vw - 1200px)/2))",display:"flex",alignItems:"center",flexWrap:"wrap",gap:20,justifyContent:"space-between"}}>
      <img src={logoMobis} alt="MOBIS AUTOPEÇAS" style={{height:58,maxWidth:"min(260px, 70vw)",objectFit:"contain"}} />
      <a href="#/loja/mobis" style={{color:"#4a5159",fontWeight:700,textDecoration:"none"}}>← Voltar ao catálogo</a>
    </header>
    <div style={{maxWidth:1120,margin:"30px auto",padding:"0 18px"}}>
      {estado==="carregando"&&<p role="status">Buscando a ficha da aplicação…</p>}
      {estado==="erro"&&<div role="alert"><h1>Aplicação indisponível</h1><p>Confira a peça com nossa equipe.</p><a href="#/loja/mobis">Voltar ao catálogo</a></div>}
      {p&&<>
        <p style={{color:"#914a27",fontWeight:800,letterSpacing:"0.06em"}}>MOBIS AUTOPEÇAS · CONSULTA POR VEÍCULO</p>
        <div className="m2-aplicacao-identidade" aria-label={"Veículo de referência: "+p.modelo+". Ilustração sem placa."}>
          <div className="m2-aplicacao-veiculo"><IconeVeiculo tipo={veiculo.tipo} largura={105}/></div>
          <div className="m2-aplicacao-identidade-texto">
            <span className="m2-aplicacao-montadora">{veiculo.montadora}</span>
            <strong>{p.modelo}</strong>
            <small>{p.motorizacao??"Motorização a confirmar"} · {p.ano_inicial??"Ano inicial a confirmar"} – {p.ano_final??"ano final a confirmar"}</small>
            <small>Ilustração da categoria do veículo, não fotografia da versão exata.</small>
          </div>
        </div>
        <h1 style={{fontSize:"clamp(1.6rem, 4vw, 2.3rem)",lineHeight:1.25,margin:"8px 0 16px"}}>{p.titulo}</h1>
        <p role="status" style={{padding:"12px 15px",background:"#fff3dd",borderLeft:"5px solid #c25a1b",fontWeight:600}}>
          {p.status==="aprovado"?"Consulte preço e disponibilidade com nossa equipe.":"Prévia de aplicação em validação técnica. Não é confirmação de compatibilidade. Confirme os dados com a equipe antes da compra."}
        </p>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,310px),1fr))",gap:26,alignItems:"start"}}>
          <section style={{background:"#fff",border:"1px solid #dfd8ca",borderRadius:12,padding:16}}>
            {foto?<a href={foto} target="_blank" rel="noopener noreferrer" aria-label="Abrir foto real da peça" style={{display:"block"}}>
                <img src={foto} alt={"Fotografia da peça física SKU "+p.sku_pai} style={{width:"100%",height:"auto",maxHeight:430,objectFit:"contain"}} />
              </a>:<div style={{minHeight:245,display:"grid",placeItems:"center",gap:6}}>
                <IconePeca nome={icone} tamanho={120}/>
                <p style={{color:"#6b645b",fontSize:14}}>Ícone de categoria. Foto da peça aguardando autorização.</p>
              </div>}
            {p.fotos.length>1&&<div style={{display:"flex",flexWrap:"wrap",gap:8,marginTop:12}}>{p.fotos.slice(1,5).map(src=><a href={src} target="_blank" rel="noopener noreferrer" key={src}><img src={src} alt="Outra foto da mesma peça física" loading="lazy" style={{width:74,height:74,objectFit:"contain",border:"1px solid #ddd",borderRadius:4}}/></a>)}</div>}
            <p style={{fontSize:13,color:"#595959"}}>{foto?"Fotos do mesmo SKU físico Mobis; aparência e conteúdo devem ser conferidos.":"Nenhuma foto comercial autorizada para esse SKU."}</p>
          </section>
          <section style={{background:"#fff",border:"1px solid #dfd8ca",borderRadius:12,padding:22}}>
            <p style={{fontSize:13,letterSpacing:"0.05em",color:"#914a27",fontWeight:800,display:"flex",alignItems:"center",gap:10}}>
              <IconePeca nome={icone} tamanho={37}/> {p.categoria??"Sistema automotivo"}
            </p>
            <dl style={{display:"grid",gridTemplateColumns:"120px minmax(0,1fr)",gap:"9px 14px",fontSize:15,lineHeight:1.5}}>
              <dt>Veículo</dt><dd style={{margin:0,fontWeight:700}}>{p.modelo}</dd>
              <dt>Motorização</dt><dd style={{margin:0}}>{p.motorizacao??"Confirmar com a equipe"}</dd>
              <dt>Anos</dt><dd style={{margin:0}}>{p.ano_inicial??"A confirmar"} {p.ano_final?"– "+p.ano_final:"(ano final a confirmar)"}</dd>
              <dt>Código da peça</dt><dd style={{margin:0,fontWeight:700}}>{p.sku_pai}</dd>
              <dt>Marca da peça</dt><dd style={{margin:0}}>{p.marca??"Confirmar fabricante"}</dd>
            </dl>
            <h2 style={{fontSize:"1.1rem",marginTop:28}}>Informações desta aplicação</h2>
            <p style={{fontSize:15,lineHeight:1.65}}>{p.descricao}</p>
            <p style={{fontSize:21,fontWeight:800}}>Preço sob consulta</p>
            <a href={"#/p/mobis/"+encodeURIComponent(p.sku_pai)}
              style={{display:"block",textAlign:"center",background:"#fff",border:"1px solid #4a5159",padding:"13px",borderRadius:9,
                fontWeight:800,color:"#38414a",textDecoration:"none",marginBottom:10}}>
              Ver página do produto físico · SKU {p.sku_pai} →
            </a>
            {p.whatsapp&&<a href={p.whatsapp} target="_blank" rel="noopener noreferrer"
              style={{display:"block",textAlign:"center",background:"#4a5159",padding:"15px",borderRadius:8,fontWeight:800,color:"#fff",textDecoration:"none"}}>
              Consultar aplicação no WhatsApp ↗
            </a>}
            <p style={{fontSize:13,color:"#565656",lineHeight:1.55}}>Um único produto físico com saldo compartilhado entre as aplicações. As páginas por veículo não representam peças ou estoques diferentes. A MOBIS AUTOPEÇAS é revendedora independente, sem vínculo oficial com as montadoras.</p>
          </section>
        </div>
      </>}
    </div>
  </main>;
}
