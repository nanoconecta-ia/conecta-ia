import { useEffect, useState } from "react";
import { supabase } from "../supabase.ts";
import { IconePeca } from "./IconePeca.tsx";
import { iconeDaCategoria } from "../lib/icones.ts";
import type { Loja } from "../lib/dados.ts";
import type { NoComTotais } from "../lib/arvore.ts";
import { fotoAprovada, fonteAprovada, resumirOem, seoCandidato, type MidiaCadastro, type CodigoTecnico, type AplicacaoTecnica } from "../lib/atlasTecnico.ts";
import "./atlas-tecnico.css";

type Produto = {id:string;nome:string;sku:string;marca:string|null;taxonomia_no_id:string|null};
type Foto = MidiaCadastro & {produto_id:string;id:string};
type Codigo = CodigoTecnico & {produto_id:string};
type Aplicacao = AplicacaoTecnica & {produto_id:string};
type Dados = {produtos:Produto[];fotos:Foto[];codigos:Codigo[];aplicacoes:Aplicacao[];montadoras:Map<string,string>;parcial:boolean};
function idsDosNos(n:NoComTotais):string[]{return [n.id,...n.filhos.flatMap(idsDosNos)];}
const ano = (v:number|null|undefined) => v == null ? "?" : String(v);
const selo = (s:string)=>s.length>48?s.slice(0,45)+"…":s;
/** Somente leitura, escopada à loja e à categoria. Qualquer informação sem prova aparece pendente. */
export function AtlasTecnico({loja,no}:{loja:Loja;no:NoComTotais}) {
  const [dados,setDados]=useState<Dados|null>(null);
  const [erro,setErro]=useState("");
  const [selecionado,setSelecionado]=useState<string|null>(null);
  const [copiado,setCopiado]=useState(false);
  useEffect(()=>{
    let ativo=true;setDados(null);setErro("");setSelecionado(null);setCopiado(false);
    const ids=idsDosNos(no);
    void (async()=>{
      try {
        const resultado=await supabase.from("produtos").select("id,nome,sku,marca,taxonomia_no_id")
          .eq("loja_id",loja.id).in("taxonomia_no_id",ids).order("nome").limit(24);
        if(resultado.error) throw new Error("Falha ao ler produtos classificados nesta categoria.");
        const produtos=(resultado.data??[]) as Produto[];
        const pids=produtos.map(p=>p.id);
        if(!pids.length){if(ativo)setDados({produtos:[],fotos:[],codigos:[],aplicacoes:[],montadoras:new Map(),parcial:false});return;}
        const [f,c,a]=await Promise.all([
          supabase.from("produto_imagens").select("id,produto_id,url,url_tratada,alt_texto,tipo,origem,direitos,licenca_tipo,direitos_confirmados_em,aprovada,removida_em").eq("loja_id",loja.id).in("produto_id",pids).eq("aprovada",true).is("removida_em",null).limit(96),
          supabase.from("produto_codigos").select("produto_id,tipo,valor,fonte,coletado_em,status").eq("loja_id",loja.id).in("produto_id",pids).eq("status","aprovado").limit(200),
          supabase.from("produto_aplicacoes").select("produto_id,modelo,motorizacao,ano_inicial,ano_final,fonte,coletado_em,status,marca_veiculo_id").eq("loja_id",loja.id).in("produto_id",pids).eq("status","aprovado").limit(200),
        ]);
        if(f.error||c.error||a.error) throw new Error("Não foi possível confirmar imagens, OEM ou aplicações; nada foi tratado como aprovado.");
        const fotos=(f.data??[]) as Foto[],codigos=(c.data??[]) as Codigo[],aplicacoes=(a.data??[]) as Aplicacao[];
        const marcaIds=[...new Set(aplicacoes.filter(fonteAprovada).map(x=>x.marca_veiculo_id).filter((x):x is string=>!!x))];
        const marcas=marcaIds.length ? await supabase.from("marcas").select("id,nome").eq("loja_id",loja.id).eq("tipo","veiculo").eq("status","aprovado").in("id",marcaIds) : {data:[],error:null};
        if(marcas.error) throw new Error("Montadoras aprovadas indisponíveis no momento.");
        if(ativo)setDados({produtos,fotos,codigos,aplicacoes,montadoras:new Map((marcas.data??[]).map(m=>[m.id as string,m.nome as string])),parcial:produtos.length===24});
      }catch(e){if(ativo)setErro(e instanceof Error?e.message:"Falha na consulta técnica.");}
    })();
    return()=>{ativo=false;};
  },[loja.id,no.id]);
  const p=dados?.produtos.find(x=>x.id===selecionado)??dados?.produtos[0];
  const fotos=(dados?.fotos??[]).filter(x=>x.produto_id===p?.id);
  const imagensReais=fotos.filter(x=>fotoAprovada(x));
  const diagramas=imagensReais.filter(x=>/explod|diagrama|desenho|tecnic/i.test(x.tipo??""));
  const codigos=(dados?.codigos??[]).filter(x=>x.produto_id===p?.id);
  const aplicacoes=(dados?.aplicacoes??[]).filter(x=>x.produto_id===p?.id && fonteAprovada(x));
  const oems=resumirOem(codigos);
  const seo=p?seoCandidato(p,codigos,aplicacoes):null;
  async function copiarSeo(){
    if(!seo)return;
    try{await navigator.clipboard.writeText(seo.titulo+"\n"+seo.descricao);setCopiado(true);}catch{setErro("Não foi possível copiar. Selecione o texto manualmente.");}
  }
  return <section className="atlas" aria-label={"Ficha técnica visual de "+no.nome}>
    <div className="atlas-intro">
      <div className="atlas-intro-icon"><IconePeca nome={iconeDaCategoria(no.slug,no.nome)} tamanho={66}/></div>
      <div><p className="atlas-eyebrow">ATLAS TÉCNICO · CATÁLOGO DA LOJA</p><h3>{no.nome}</h3>
        <p>Categoria / subcategoria · {no.produtos} produto(s) classificado(s)</p></div>
    </div>
    <div className="atlas-etapas" aria-label="Requisitos de homologação">
      <span>1. SKU</span><span>2. OEM</span><span>3. Veículo / motor</span><span>4. Foto e licença</span><span>5. SEO</span>
    </div>
    {erro&&<p className="atlas-erro" role="alert">{erro}</p>}
    {!dados&&!erro&&<p className="atlas-vazio" role="status">Conferindo registros e evidências da loja…</p>}
    {dados?.produtos.length===0&&<div className="atlas-sem-registro">
      <IconePeca nome={iconeDaCategoria(no.slug,no.nome)} tamanho={90}/>
      <strong>Nenhum SKU vinculado a esta categoria.</strong>
      <p>Não há foto real, montagem, OEM, cv ou SEO homologado para exibir aqui. Classifique primeiro o SKU existente e confira os dados com o catálogo do fabricante.</p>
      <a href="#/catalogo">Ver catálogo e produtos sem classificação ↗</a>
    </div>}
    {!!dados?.produtos.length&&<>
      <label className="atlas-escolher">Produto vinculado
        <select value={p?.id??""} onChange={e=>{setSelecionado(e.target.value);setCopiado(false);}}>
          {dados.produtos.map(prod=><option key={prod.id} value={prod.id}>{prod.sku} · {prod.nome}</option>)}
        </select>
      </label>
      {dados.parcial&&<p className="atlas-nota">Exibindo até 24 itens. Use o catálogo para consultar os demais produtos.</p>}
      {p&&<><div className="atlas-conteudo">
        <figure className="atlas-foto">
          {imagensReais[0]&&fotoAprovada(imagensReais[0]) ?
            <img src={fotoAprovada(imagensReais[0])!} loading="lazy" alt={imagensReais[0].alt_texto||"Fotografia real homologada da peça "+p.sku}/> :
            <div className="atlas-sem-foto"><IconePeca nome={iconeDaCategoria(no.slug,no.nome)} tamanho={110}/><strong>Fotografia real pendente</strong><small>Somente imagens com autorização e direitos verificados</small></div>}
          <figcaption>{imagensReais[0]? "Foto licenciada · "+selo(imagensReais[0].origem||"origem registrada") : "Ícone vetorial do sistema — não é fotografia da peça"}</figcaption>
        </figure>
        <div className="atlas-dados">
          <p className="atlas-eyebrow">FICHA DE APLICAÇÃO / REVISÃO</p><h4>{p.nome}</h4>
          <dl><dt>SKU Bling</dt><dd>{p.sku}</dd><dt>Marca da peça</dt><dd>{p.marca||"A confirmar"}</dd>
            <dt>Código OEM aprovado</dt><dd>{oems.length?oems.join(" · "):"Sem comprovação OEM"}</dd>
            <dt>Montadora</dt><dd>{aplicacoes.length? [...new Set(aplicacoes.map(a=>a.marca_veiculo_id?dados.montadoras.get(a.marca_veiculo_id):null).filter(Boolean))].join(", ")||"Montadora a confirmar":"A confirmar"}</dd>
            <dt>Motor / aplicação</dt><dd>{aplicacoes.length?aplicacoes.map(a=>a.modelo+(a.motorizacao?" · "+a.motorizacao:"")+" ("+ano(a.ano_inicial)+"–"+ano(a.ano_final)+")").join(" · "):"Nenhuma aplicação aprovada"}</dd>
            <dt>Potência em cv</dt><dd>Não homologada</dd>
            <dt>Imagem OEM explodida</dt><dd>{diagramas.length?"Fonte autorizada disponível":"Aguardando autorização de uso"}</dd></dl>
          <div className="atlas-badges"><span>{oems.length?"OEM documentado":"OEM pendente"}</span><span>{imagensReais.length?"Mídia aprovada":"Sem mídia aprovada"}</span><span>{aplicacoes.length?"Aplicação documentada":"Aplicação pendente"}</span></div>
        </div>
      </div>
      {diagramas.length>0&&<section className="atlas-diagramas"><h4>Diagramas técnicos autorizados</h4>{diagramas.map(f=><figure key={f.id}><img src={fotoAprovada(f)!} loading="lazy" alt={f.alt_texto||"Diagrama técnico homologado"}/><figcaption>Origem: {f.origem}; licença: {f.licenca_tipo}</figcaption></figure>)}</section>}
      <section className="atlas-seo"><div><p className="atlas-eyebrow">SEO · RASCUNHO NÃO PUBLICADO</p><h4>Prévia para busca de peças</h4></div>
        <p className="atlas-seo-title">{seo?.titulo}</p><p>{seo?.descricao}</p>
        <button type="button" className="sec" onClick={()=>void copiarSeo()}>{copiado?"Copiado para revisão":"Copiar prévia SEO"}</button>
        <small>Não publica automaticamente. Antes de aprovar, conferir fabricante, motor, medidas, aplicação e direitos de imagem.</small>
      </section></>}
    </>}
    <div className="atlas-fontes">
      <h4>Fontes técnicas e imagens legítimas</h4><p>Consulte o catálogo da montadora ou do fabricante. Imagens públicas encontradas na web não são automaticamente licenciadas para a loja.</p>
      <div><a href="https://partsouq.com/" target="_blank" rel="noopener noreferrer">Catálogos OEM / diagramas ↗</a>
        <a href="https://www.tecalliance.net/products/cards/tecdoc-web-service" target="_blank" rel="noopener noreferrer">TecDoc Web Service ↗</a>
        <a href="#/pesquisa">Pesquisar referência técnica ↗</a></div>
    </div>
  </section>;
}
