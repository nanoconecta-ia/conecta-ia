import { useEffect, useState } from "react";
import { SUPABASE_URL, SUPABASE_CHAVE_PUBLICAVEL } from "../config.ts";
import { IconePeca, IconeVeiculo } from "../componentes/IconePeca.tsx";
import logoMobis from "../assets/marcas/mobis-oficial-fundo-escuro.png";
import "./loja-mobis-nova.css";

type Aplicacao = {
  slug:string; titulo:string; descricao:string; modelo:string;
  motorizacao:string|null; ano_inicial:number|null; ano_final:number|null;
  status:string; indexavel:boolean; sku_pai:string; marca:string|null;
  categoria:string|null; fotos:string[]; preco:null; estoque:null; whatsapp:string|null;
  codigo_oem?:string|null; codigo_fiscal?:string|null; bula_tecnica?:string|null;
  restricao?:string|null; contraindicacao?:string|null; foto_veiculo?:string|null; logo_montadora?:string|null;
  codigos_cruzados?:Array<{marca:string;codigo:string;tipo:string}>
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
  const [fotoSelecionada,setFotoSelecionada]=useState(0);
  const [imagemAberta,setImagemAberta]=useState(false);
  const [aba,setAba]=useState<"tecnica"|"aplicacao"|"codigos">("tecnica");
  useEffect(()=>{setFotoSelecionada(0);setImagemAberta(false);setAba("tecnica");},[slug]);
  const veiculo=identidadeVeiculo(p?.modelo??"");
  const categoria=(p?.categoria??"").toLowerCase();
  const icone=/bandeja|suspens/.test(categoria)?"suspensao":/filtro/.test(categoria)?"filtros":"motor";
  const fotos=p?.fotos??[];
  const foto=fotos[fotoSelecionada]??fotos[0]??null;
  const oem=p?.status==="aprovado"&&p.codigo_oem?p.codigo_oem:null;
  const trocarFoto=(delta:number)=>setFotoSelecionada(atual=>((atual+delta+fotos.length)%fotos.length));
  useEffect(()=>{
    if(!imagemAberta)return;
    const teclas=(e:KeyboardEvent)=>{
      if(e.key==="Escape")setImagemAberta(false);
      if(e.key==="ArrowRight")setFotoSelecionada(atual=>fotos.length?(atual+1)%fotos.length:0);
      if(e.key==="ArrowLeft")setFotoSelecionada(atual=>fotos.length?(atual-1+fotos.length)%fotos.length:0);
    };
    window.addEventListener("keydown",teclas);
    return ()=>window.removeEventListener("keydown",teclas);
  },[imagemAberta,fotos.length]);
  const tituloSocial=p?("MOBIS AUTOPEÇAS | "+p.modelo+" | "+p.sku_pai):"MOBIS AUTOPEÇAS";
  const compartilhar=()=>{if(!p)return;const url=window.location.href;
    if(navigator.share){void navigator.share({title:tituloSocial,url}).catch(()=>{});}
    else if(navigator.clipboard){void navigator.clipboard.writeText(url);}
  };
  return <main className="mobis-v2 m2-ficha-real">
    <header className="m2-ficha-header">
      <a href="#/loja/mobis" aria-label="Voltar ao catálogo MOBIS"><img src={logoMobis} alt="MOBIS AUTOPEÇAS"/></a>
      <a href="#/loja/mobis">← Voltar à loja</a>
    </header>
    <div className="m2-ficha-wrap">
      {estado==="carregando"&&<p role="status">Consultando dados reais da aplicação…</p>}
      {estado==="erro"&&<div role="alert"><h1>Ficha indisponível</h1><a href="#/loja/mobis">Voltar ao catálogo</a></div>}
      {p&&<>
        <section className="m2-ficha-banner" aria-label={"Ficha do veículo "+p.modelo}>
          {p.foto_veiculo&&<img className="m2-ficha-fundo-veiculo" src={p.foto_veiculo} alt={"Fotografia licenciada do veículo "+p.modelo}/>}
          <div className="m2-ficha-banner-conteudo">
            <span className="m2-ficha-selo">MOBIS AUTOPEÇAS · PEÇAS PARA UTILITÁRIOS DIESEL</span>
            <div className="m2-ficha-identidade">
              {p.logo_montadora?<img src={p.logo_montadora} alt={"Logotipo autorizado "+veiculo.montadora} className="m2-ficha-marca-img"/>:<span className="m2-ficha-marca-texto">{veiculo.montadora}</span>}
              <span className="m2-ficha-miniatura"><IconeVeiculo tipo={veiculo.tipo} largura={98}/></span>
              <div><strong>{p.modelo}</strong><small>{p.motorizacao??"Motor a confirmar"} · {p.ano_inicial??"Início a confirmar"} – {p.ano_final??"fim a confirmar"}</small></div>
            </div>
            <h1>{p.titulo}</h1>
            <p>Fabricante da peça: <strong>{p.marca??"Não informado"}</strong> · Código: <strong>{p.sku_pai}</strong></p>
            <div className="m2-ficha-badges"><span><IconePeca nome={icone} tamanho={24}/> {p.categoria??"Sistema automotivo"}</span><span>{p.status==="aprovado"?"Aplicação tecnicamente aprovada":"Aplicação em revisão — confirme pelo chassi"}</span></div>
          </div>
        </section>
        <div className="m2-ficha-grid">
          <section className="m2-ficha-painel" aria-label="Fotografias reais do produto">
            <h2>Fotografias do produto físico</h2>
            {foto?<div className="m2-galeria">
              <div className="m2-galeria-palco">
                {fotos.length>1&&<button type="button" className="m2-galeria-seta" aria-label="Fotografia anterior" onClick={()=>trocarFoto(-1)}>‹</button>}
                <button type="button" className="m2-galeria-zoom" onClick={()=>setImagemAberta(true)} aria-label="Ampliar fotografia sem sair da página"><img src={foto} alt={"Fotografia real da peça "+p.sku_pai+", imagem "+(fotoSelecionada+1)}/><span>⌕ Ampliar</span></button>
                {fotos.length>1&&<button type="button" className="m2-galeria-seta" aria-label="Próxima fotografia" onClick={()=>trocarFoto(1)}>›</button>}
              </div>
              <p className="m2-galeria-contador" aria-live="polite">{fotoSelecionada+1} de {fotos.length} fotografias</p>
            </div>
              :<div className="m2-ficha-sem-foto"><IconePeca nome={icone} tamanho={90}/><strong>Foto real aguardando autorização</strong><small>Nenhuma imagem ilustrativa de motor substitui a peça verdadeira.</small></div>}
            {fotos.length>1&&<div className="m2-ficha-miniaturas" aria-label="Selecionar foto real">{fotos.map((src,idx)=><button type="button" key={src} onClick={()=>setFotoSelecionada(idx)} aria-pressed={fotoSelecionada===idx} aria-label={"Mostrar fotografia "+(idx+1)}><img src={src} alt=""/></button>)}</div>}
            <p className="m2-ficha-nota">As imagens deste espaço devem ser do produto comercializado, com autorização de uso. Confirme composição e versão antes da compra.</p>
          </section>
          <section className="m2-ficha-painel">
            <h2>Identificação e referências</h2>
            <dl className="m2-ficha-dados">
              <dt>Montadora</dt><dd>{veiculo.montadora}</dd>
              <dt>Veículo</dt><dd>{p.modelo}</dd>
              <dt>Motor</dt><dd>{p.motorizacao??"A confirmar"}</dd>
              <dt>Período</dt><dd>{p.ano_inicial??"Ano inicial pendente"} – {p.ano_final??"ano final pendente"}</dd>
              <dt>Marca da peça</dt><dd>{p.marca??"A confirmar"}</dd>
              <dt>SKU da peça</dt><dd>{p.sku_pai}</dd>
              <dt>OEM original</dt><dd>{oem??"Não homologado — conferir pelo chassi"}</dd>
              <dt>Código fiscal / NCM</dt><dd>{p.codigo_fiscal??"Consultar documentação fiscal da peça"}</dd>
              <dt>Código de barras</dt><dd>Exibir somente quando GTIN verdadeiro e validado</dd>
            </dl>
            <p className="m2-ficha-consulta">Preço e disponibilidade sob consulta</p>
            <div className="m2-ficha-acoes">
              {p.whatsapp&&<a className="m2-ficha-whatsapp" href={p.whatsapp} target="_blank" rel="noopener noreferrer">Consultar no WhatsApp ↗</a>}
              <button type="button" onClick={compartilhar}>Compartilhar ficha ↗</button>
            </div>
            <p className="m2-ficha-nota">Uma vitrine por veículo, um único cadastro físico e saldo. Esta ficha não reserva nem movimenta estoque.</p>
          </section>
        </div>
        <section className="m2-ficha-painel m2-ficha-conteudo" aria-label="Informações completas">
          <h2>Conheça o produto</h2>
          <div className="m2-ficha-abas" role="tablist" aria-label="Detalhes do produto">
            <button type="button" role="tab" aria-selected={aba==="tecnica"} onClick={()=>setAba("tecnica")}><IconePeca nome={icone} tamanho={21}/> Ficha técnica</button>
            <button type="button" role="tab" aria-selected={aba==="aplicacao"} onClick={()=>setAba("aplicacao")}>▣ Aplicação</button>
            <button type="button" role="tab" aria-selected={aba==="codigos"} onClick={()=>setAba("codigos")}># Códigos e marcas</button>
          </div>
          <div className="m2-ficha-aba-corpo" role="tabpanel">
            {aba==="tecnica"&&<>
              <h3>Descrição e composição</h3><p>{p.descricao||"Aguardando descrição técnica da aplicação."}</p>
              <details><summary>▤ Abrir bula técnica e itens incluídos</summary><p>{p.bula_tecnica??"Aguardando bula técnica documentada e conferência dos componentes."}</p></details>
              <details><summary>⚠ Contraindicações e cuidados de instalação</summary><p>{p.contraindicacao??p.restricao??"Verificar OEM, chassi, versão, sensores, suportes e periféricos antes de instalar."}</p></details>
            </>}
            {aba==="aplicacao"&&<>
              <h3>Veículo de referência</h3>
              <p><strong>{veiculo.montadora} · {p.modelo}</strong> — {p.motorizacao??"Motor não informado"}. Início: {p.ano_inicial??"pendente"}; fim: {p.ano_final??"pendente"}.</p>
              <p>{p.status==="aprovado"?"Confirme a disponibilidade e a versão do produto.":"Aplicação ainda em revisão. É obrigatório confirmar a compatibilidade técnica por chassi e OEM."}</p>
              <details><summary>▣ O que conferir antes de comprar?</summary><p>{p.restricao??"Código original, chassi, geração, tipo de motor, ano, sensores, suportes e periféricos."}</p></details>
            </>}
            {aba==="codigos"&&<>
              <h3>Referências e cruzamentos</h3>
              <dl className="m2-ficha-dados"><dt>Marca da peça</dt><dd>{p.marca??"Não informada"}</dd><dt>SKU interno</dt><dd>{p.sku_pai}</dd><dt>OEM da aplicação</dt><dd>{oem??"Pendente de homologação"}</dd></dl>
              {(p.codigos_cruzados??[]).length>0?<div className="m2-ficha-codigos">{p.codigos_cruzados?.map((c,i)=><div key={i}><span aria-hidden="true">▦</span><strong>{c.marca}</strong><code>{c.codigo}</code><small>{c.tipo}</small></div>)}</div>:<p>Não há referências cruzadas homologadas para exibição. Não presumimos equivalência por nomes parecidos.</p>}
            </>}
          </div>
          <details className="m2-ficha-termos"><summary>ⓘ Garantia, atendimento e direitos do consumidor</summary><p>Consulte condições de garantia e instalação com a equipe MOBIS. Direitos legais preservados; dados de chassi devem ser enviados por canal apropriado. A MOBIS é revendedora independente das montadoras.</p></details>
        </section>
        {imagemAberta&&foto&&<div className="m2-galeria-overlay" role="presentation" onMouseDown={(e)=>{if(e.target===e.currentTarget)setImagemAberta(false);}}>
          <div className="m2-galeria-dialogo" role="dialog" aria-modal="true" aria-label={"Fotografia ampliada do produto "+p.sku_pai}>
            <div className="m2-galeria-dialogo-topo"><strong>{p.marca??"Peça"} · {p.sku_pai}</strong><button type="button" onClick={()=>setImagemAberta(false)} aria-label="Fechar fotografia ampliada">✕ Fechar</button></div>
            <div className="m2-galeria-dialogo-imagem">
              {fotos.length>1&&<button type="button" aria-label="Foto anterior" onClick={()=>trocarFoto(-1)}>‹</button>}
              <img src={foto} alt={"Fotografia real ampliada do produto "+p.sku_pai}/>
              {fotos.length>1&&<button type="button" aria-label="Foto seguinte" onClick={()=>trocarFoto(1)}>›</button>}
            </div>
            <small>{fotoSelecionada+1} / {fotos.length} · Use ← → e Esc no teclado</small>
          </div>
        </div>}
        <p className="m2-ficha-disclaimer">{p.status==="aprovado"?"Confirme disponibilidade e condições com nossa equipe.":"Aplicação em revisão técnica. A presença do veículo na página não comprova compatibilidade."}</p>
      </>}
    </div>
  </main>;
}
