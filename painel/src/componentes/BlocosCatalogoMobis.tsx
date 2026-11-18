import { useState } from "react";
import { IconePeca } from "./IconePeca.tsx";
import { EmblemaVeiculoMobis } from "./EmblemaVeiculoMobis.tsx";
import { MONTADORAS_MOBIS, modelosAprovadosDaMontadora, nosPublicaveis, type CategoriaPublica, type CategoriaArvorePublica, type MontadoraMobis } from "../lib/blocosCatalogoMobis.ts";

/** Bloco 03: montadoras → modelos retornados pela API Conecta.IA (aplicações aprovadas).
 * Nomes de montadoras são caminhos de consulta, não homologação, vínculo ou disponibilidade.
 */
export function BlocoMontadorasMobis({
  modelos, logos, aoSelecionarModelo, aoConsultar,
}:{
  modelos:readonly string[];
  logos?:Readonly<Record<string,string>>;
  aoSelecionarModelo:(modelo:string)=>void;
  aoConsultar:(montadora:string)=>void;
}){
  const [ativa,setAtiva]=useState<MontadoraMobis|null>(null);
  const encontrados=ativa?modelosAprovadosDaMontadora(ativa,modelos):[];
  return <section id="m2-montadoras" data-bloco="montadoras" className="m2-wrap m4-bloco-nos m4-bloco-montadoras" aria-label="Escolha uma montadora">
    <div className="m4-bloco-nos-titulo">
      <div><span className="m2-kicker">01 · MONTADORAS</span><h2>Escolha a montadora</h2>
        <p>Consulte as linhas diesel atendidas. Só modelos com aplicação liberada aparecem como filtro de produtos.</p>
      </div>
    </div>
    <div className="m4-veiculos-tipos">
      <div className="m4-veiculos-tipos-cab">
        <h3>Tipos de veículo</h3>
        <p>Escolha um perfil para consultar a equipe. Confirme modelo, ano, motor e aplicação da peça.</p>
      </div>
      <div className="m4-veiculos-tipos-grade" role="group" aria-label="Tipos de veículo atendidos pela MOBIS">
        {GRUPOS_VEICULOS_MOBIS.map(grupo=><button
          type="button" key={grupo.chave} className="m4-tipo-veiculo"
          aria-label={"Consultar peças para "+grupo.consulta}
          onClick={()=>aoConsultar(grupo.consulta)}>
            <EmblemaVeiculoMobis tipo={grupo.chave} tamanho={156}/>
            <span>Consultar peças</span>
          </button>)}
      </div>
    </div>
    <div className="m4-montadoras-grade">
      {MONTADORAS_MOBIS.map(m=>{
        const total=modelosAprovadosDaMontadora(m.nome,modelos).length;
        return <button type="button" key={m.nome} aria-pressed={ativa===m.nome}
          className={"m4-montadora-item"+(ativa===m.nome?" selecionada":"")} onClick={()=>setAtiva(a=>a===m.nome?null:m.nome)}>
          {logos?.[m.nome]&&<img className="m4-logo-montadora" src={logos[m.nome]} alt={"Logotipo de "+m.nome} loading="lazy"/>}
          <strong>{m.nome}</strong><small>{total?total+" modelo(s) no catálogo":"Atendimento sob consulta"}</small>
        </button>;
      })}
    </div>
    {ativa&&<div className="m4-montadora-modelos" aria-live="polite">
      <div><strong>{ativa} · escolha o veículo</strong>
        <p>{encontrados.length?"Selecione um modelo com aplicação cadastrada:":"Ainda não há modelos desta montadora liberados para consulta por filtro."}</p>
      </div>
      <div className="m4-montadora-opcoes">
        {encontrados.map(m=><button type="button" key={m} onClick={()=>aoSelecionarModelo(m)}>{m} <span aria-hidden="true">→</span></button>)}
        <button type="button" onClick={()=>aoConsultar(ativa)}>Consultar a equipe <span aria-hidden="true">→</span></button>
      </div>
    </div>}
    <small className="m4-bloco-nos-nota">Referências de atendimento. Não representam associação oficial com as montadoras. Confirme cada aplicação por modelo, motorização e ano.</small>
  </section>;
}

/** Emblemas MOBIS aprovados em 18/11/2026, exclusivos da vitrine da MOBIS.
 * São símbolos de categoria, não fotografia de peça, marca ou prova de compatibilidade.
 * PNG originais e manifesto: Google Drive /08_ICONES_CATALOGO_APROVADOS_2026-11-18.
 */
const EMBLEMAS_MOBIS:Readonly<Record<string,string>>={
  motor:"/icones-catalogo-mobis/mobis-sistema-motor-512.webp",
  cabecote:"/icones-catalogo-mobis/mobis-sistema-cabecote-512.webp",
  suspensao:"/icones-catalogo-mobis/mobis-sistema-suspensao-512.webp",
  transmissao:"/icones-catalogo-mobis/mobis-sistema-transmissao-512.webp",
  eletrica:"/icones-catalogo-mobis/mobis-sistema-eletrica-512.webp",
  carroceria:"/icones-catalogo-mobis/mobis-sistema-carroceria-512.webp",
  acessorios:"/icones-catalogo-mobis/mobis-sistema-acessorios-512.webp",
};

/** Tipos de veículo da vitrine MOBIS, não equivalem a aplicações de SKU já homologadas.
 * Utilitário = caminhão leve de carga nesta arte; SUV continua categoria técnica separada.
 * Os botões abrem a consulta à equipe, sem fingir filtro por tipo na API.
 */
const GRUPOS_VEICULOS_MOBIS=[
  {chave:"picape",consulta:"picapes",rotulo:"Picapes"},
  {chave:"furgao",consulta:"vans",rotulo:"Vans"},
  {chave:"caminhao",consulta:"utilitários leves de carga",rotulo:"Utilitários"},
  {chave:"passeio",consulta:"veículos de passeio",rotulo:"Passeio"},
] as const;

const SISTEMAS_CONSULTA=[
  {nome:"Motor",icone:"motor"},
  {nome:"Cabeçote",icone:"cabecote"},
  {nome:"Suspensão",icone:"suspensao"},
  {nome:"Transmissão",icone:"transmissao"},
  {nome:"Elétrica",icone:"eletrica"},
  {nome:"Carroceria",icone:"carroceria"},
  {nome:"Acessórios",icone:"acessorios"},
  {nome:"Freios",icone:"freios"},
  {nome:"Arrefecimento",icone:"arrefecimento"},
] as const;
function iconeDaTaxonomia(nome:string,slug:string):string{
  const x=(nome+" "+slug).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
  if(/cabecot|culassa|cylinder.?head/.test(x))return "cabecote";
  if(/suspens|bandeja|amortec/.test(x))return "suspensao";
  if(/freio|pastilha/.test(x))return "freios";
  if(/transmiss|embreagem|cambio|caixa.?de.?marcha/.test(x))return "transmissao";
  if(/arrefec|radiador|termostat/.test(x))return "arrefecimento";
  if(/eletric|alternador|sensor|bateria/.test(x))return "eletrica";
  if(/carroceria|funilaria|lataria|parachoque|paralama/.test(x))return "carroceria";
  if(/acessor|equipamento.?adicional/.test(x))return "acessorios";
  return "motor";
}
function IconeSistemaMobis({nome}:{nome:string}){
  const src=EMBLEMAS_MOBIS[nome];
  return src
    ? <img className="m4-sistema-emblema" src={src} width={140} height={140}
       loading="lazy" decoding="async" alt="" aria-hidden="true"/>
    : <IconePeca nome={nome} tamanho={54}/>;
}
function temEmblemaMobis(chave:string):boolean{
  return Object.prototype.hasOwnProperty.call(EMBLEMAS_MOBIS,chave);
}
/** Bloco 04: taxonomia = nós com contagem retornada pela API pública.
 * Nenhuma categoria pendente no Conecta.IA é mostrada como produto disponível.
 */
export function BlocoTaxonomiaMobis({
  categorias, arvore=[], aoSelecionarCategoria, aoConsultar,
}:{
  categorias:readonly CategoriaPublica[];
  arvore?:readonly CategoriaArvorePublica[];
  aoSelecionarCategoria:(slug:string)=>void;
  aoConsultar:(sistema:string)=>void;
}){
  const [trilha,setTrilha]=useState<string[]>([]);
  const emArvore=arvore.length>0;
  const nos=nosPublicaveis(emArvore?arvore:categorias);
  const atual=nos.find(n=>n.slug===trilha[trilha.length-1]);
  const visiveis=emArvore
    ? nos.filter(n=>atual?n.pai_slug===atual.slug:!n.pai_slug||!nos.some(p=>p.slug===n.pai_slug))
    : nos;
  function selecionar(n:CategoriaPublica){
    if(emArvore && nos.some(f=>f.pai_slug===n.slug)){setTrilha(t=>[...t,n.slug]);return;}
    aoSelecionarCategoria(n.slug);
  }
  return <section id="m2-taxonomia" data-bloco="taxonomia" className="m4-bloco-nos m4-bloco-taxonomia"
    aria-label="Escolha o sistema e a categoria da peça">
    <div className="m2-wrap">
      <div className="m4-bloco-nos-titulo"><div>
        <span className="m2-kicker">02 · SISTEMA → CATEGORIA → PEÇA</span>
        <h2>Encontre pelo sistema da peça</h2>
        <p>Escolha a categoria pai e depois a filha. Somente ramos com produtos publicados aparecem na navegação.</p>
      </div></div>
      {emArvore&&<nav className="m4-taxonomia-caminho" aria-label="Caminho das categorias">
        <button type="button" onClick={()=>setTrilha([])}>Sistemas</button>
        {trilha.map((slug,i)=>{
          const no=nos.find(n=>n.slug===slug);
          return <span key={slug}><span aria-hidden="true">›</span>
            <button type="button" onClick={()=>setTrilha(t=>t.slice(0,i+1))}>{no?.nome??slug}</button>
          </span>;
        })}
      </nav>}
      {emArvore&&atual&&<div className="m4-taxonomia-subgrupo">
        <span>Categoria selecionada: <strong>{atual.nome}</strong></span>
        <button type="button" onClick={()=>aoSelecionarCategoria(atual.slug)}>
          Ver todas as peças deste grupo →
        </button>
      </div>}
      <div className="m4-taxonomia-grade">
        {nos.length?visiveis.map(n=><button type="button" key={n.slug} className="m4-taxonomia-item"
          onClick={()=>selecionar(n)} data-taxonomia-no={n.slug}
          data-mobis-emblema={temEmblemaMobis(iconeDaTaxonomia(n.nome,n.slug))?"sim":"nao"}>
          <IconeSistemaMobis nome={iconeDaTaxonomia(n.nome,n.slug)}/>
          <strong>{n.nome}</strong><small>{n.total} produto(s) no ramo</small>
          <span>{emArvore&&nos.some(f=>f.pai_slug===n.slug)?"Ver subcategorias →":"Ver peças →"}</span>
        </button>):
        SISTEMAS_CONSULTA.map(s=><button type="button" key={s.nome} className="m4-taxonomia-item"
          onClick={()=>aoConsultar(s.nome)} title={"Consultar peças de "+s.nome}
          data-mobis-emblema={temEmblemaMobis(s.icone)?"sim":"nao"}>
          <IconeSistemaMobis nome={s.icone}/>
          <strong>{s.nome}</strong><small>Aguardando itens liberados</small><span>Consultar →</span>
        </button>)}
      </div>
      <small className="m4-bloco-nos-nota">{emArvore
        ?"O vínculo pai e filho é o cadastrado no Conecta.IA; a aplicação da peça ainda depende de confirmação técnica."
        :nos.length
          ?"Categorias do catálogo publicado. A navegação pai/filho aparecerá quando a API hierárquica for liberada."
          :"Os ícones representam sistemas de peças, não produtos cadastrados ou compatibilidade aprovada."}</small>
    </div>
  </section>;
}
