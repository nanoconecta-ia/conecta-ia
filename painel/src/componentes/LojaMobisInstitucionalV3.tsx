import {useState, type FormEvent, type ReactNode} from "react";
import {MONTADORAS_MOBIS, modelosAprovadosDaMontadora, type MontadoraMobis} from "../lib/blocosCatalogoMobis.ts";
import logo from "../assets/marcas/mobis-mstyle-v3-logo.png";
import hr from "../assets/veiculos-mobis/hyundai-hr.webp";
import bongo from "../assets/veiculos-mobis/kia-bongo-k2500.webp";
import l200 from "../assets/veiculos-mobis/mitsubishi-l200.webp";
import {linkWhatsAppPublico} from "../lib/publicoLoja.ts";

/** Vitrine comercial Mobis 2026. Imagens de veículos são referências de LINHA,
 * não evidência de aplicação de uma peça. O catálogo permanece 100% na API pública.
 * Os sete ícones são os SVGs do kit M-STYLE CROMO V3 e não ícones gerados.
 */
import motorIcon from "../assets/mobis-v3-sistemas/motor.svg";
import cabecoteIcon from "../assets/mobis-v3-sistemas/cabecote.svg";
import suspensaoIcon from "../assets/mobis-v3-sistemas/suspensao.svg";
import transmissaoIcon from "../assets/mobis-v3-sistemas/transmissao.svg";
import eletricaIcon from "../assets/mobis-v3-sistemas/eletrica.svg";
import carroceriaIcon from "../assets/mobis-v3-sistemas/carroceria.svg";
import acessoriosIcon from "../assets/mobis-v3-sistemas/acessorios.svg";

type Categoria={nome:string;slug:string;total:number};
type Filtros={modelo:string;motor:string;ano:string;categoria:string};
type Setor={nome:string;chave:string;icone:string;termos:RegExp};
export const SETORES_MOBIS_V3:readonly Setor[]=[
  {nome:"Motor",chave:"motor",icone:motorIcon,termos:/motor|bloco|pist[aã]o|virabrequim/i},
  {nome:"Cabeçote",chave:"cabecote",icone:cabecoteIcon,termos:/cabe[cç]ote|comando|v[aá]lvul/i},
  {nome:"Suspensão",chave:"suspensao",icone:suspensaoIcon,termos:/suspens|amortec|bandeja|dire[cç][aã]o/i},
  {nome:"Transmissão",chave:"transmissao",icone:transmissaoIcon,termos:/transmiss|embreagem|c[aâ]mbio/i},
  {nome:"Elétrica",chave:"eletrica",icone:eletricaIcon,termos:/el[eé]tric|alternador|bateria|sensor/i},
  {nome:"Carroceria",chave:"carroceria",icone:carroceriaIcon,termos:/carroceria|lataria|retrovisor|parachoque/i},
  {nome:"Acessórios",chave:"acessorios",icone:acessoriosIcon,termos:/acess[oó]ri|ferramenta/i},
];
const normalizar=(t:string)=>t.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
const setorComCategoria=(s:Setor,categorias:readonly Categoria[])=>categorias.find(c=>
  c.total>0&&(s.termos.test(c.nome)||s.termos.test(c.slug)||
  (s.chave==="motor"&&normalizar(c.nome)==="motores")));

type Comum={
  busca:string;onBusca:(valor:string)=>void;onEnviar:(event?:FormEvent)=>void;
  lista:number;whatsapp:string|null;ir:(id:string)=>void;
  categorias:readonly Categoria[];selecionarCategoria:(slug:string)=>void;consultar:(nome:string)=>void;
  bannersPresentes:boolean;
};

export function CabecalhoMobisV3({busca,onBusca,onEnviar,lista,whatsapp,ir,categorias,selecionarCategoria,consultar,bannersPresentes}:Comum){
  return <div className="ms-cabecalho" data-bloco="cabecalho" data-mobis-vitrine-completa="v3">
    <div className="ms-faixa-superior">
      <div className="ms-container ms-faixa-interna">
        <span><b aria-hidden="true">●</b> Goiás · Atendimento em autopeças diesel</span>
        <span className="ms-faixa-razao">MOBIS AUTOPEÇAS · PICAPES • VANS • UTILITÁRIOS</span>
        {whatsapp&&<a href={whatsapp} target="_blank" rel="noopener noreferrer">Consulta pelo WhatsApp ↗</a>}
      </div>
    </div>
    <div className="ms-principal"><div className="ms-container ms-principal-grid">
      <a className="ms-logo" href="#/loja/mobis" aria-label="Mobis Autopeças — página inicial"><img src={logo} width={1000} height={330} alt="MOBIS AUTOPEÇAS — M-STYLE CROMO V3"/></a>
      <p className="ms-especialidade">Peças para <strong>picapes, vans e utilitários diesel</strong> <small>Aplicação técnica sob consulta</small></p>
      <form className="ms-pesquisa" role="search" aria-label="Buscar peça e referência" onSubmit={onEnviar}>
        <label className="ms-visualmente-oculto" htmlFor="ms-buscar">Buscar peça, SKU, OEM ou aplicação</label>
        <input id="ms-buscar" maxLength={60} value={busca} onChange={e=>onBusca(e.target.value)} placeholder="Busque por peça, SKU, OEM, veículo ou motor"/>
        <button type="submit" aria-label="Pesquisar peças"><span aria-hidden="true">⌕</span><span>Buscar</span></button>
      </form>
      <div className="ms-acoes">
        <button type="button" onClick={()=>ir("m2-lista")} aria-label={"Ir para lista de consulta com "+lista+" peças"}>
          <span aria-hidden="true">▤</span><small>Minha lista</small><b>{lista}</b>
        </button>
        {whatsapp&&<a href={whatsapp} target="_blank" rel="noopener noreferrer" aria-label="Conversar com a Mobis no WhatsApp"><span aria-hidden="true">◉</span><small>Contato</small></a>}
      </div>
    </div></div>
    <nav className="ms-navegacao" aria-label="Menu principal da loja"><div className="ms-container ms-menu">
      <button className="ms-departamentos" type="button" onClick={()=>ir("ms-departamentos")}><span aria-hidden="true">☰</span> Todos os departamentos</button>
      <button type="button" onClick={()=>ir("m2-topo")}>⌂ Início</button>
      <button type="button" onClick={()=>ir("m2-catalogo")}>Peças e catálogo</button>
      <button type="button" onClick={()=>ir("ms-aplicacoes")}>Aplicações</button>
      {bannersPresentes&&<button type="button" onClick={()=>ir("m2-destaques")}>Destaques</button>}
      <a href="#/loja/mobis/empresa">Sobre a Mobis</a>
      <button type="button" onClick={()=>ir("m2-atendimento")}>Contato</button>
    </div></nav>
    <div id="ms-departamentos" className="ms-departamentos-faixa" aria-label="Departamentos de peças">
      <div className="ms-container ms-departamentos-lista">
        {SETORES_MOBIS_V3.map(s=>{
          const categoria=setorComCategoria(s,categorias);
          return <button key={s.chave} type="button" title={categoria?"Ver peças de "+s.nome:"Consultar peças de "+s.nome}
            onClick={()=>categoria?selecionarCategoria(categoria.slug):consultar(s.nome)}>
            <img src={s.icone} width={66} height={66} alt="" aria-hidden="true"/>
            <span>{s.nome}</span><small>{categoria?"Ver peças":"Sob consulta"}</small>
          </button>;
        })}
      </div>
    </div>
  </div>;
}

const LINHAS=[
  {nome:"Hyundai HR",filtro:"HR",foto:hr,texto:"Vans e utilitários diesel"},
  {nome:"Kia Bongo",filtro:"Bongo",foto:bongo,texto:"Linha de utilitários"},
  {nome:"Mitsubishi L200",filtro:"L200",foto:l200,texto:"Picapes diesel"},
  {nome:"Hilux",filtro:"Hilux",foto:null,texto:"Consulte aplicações"},
  {nome:"Toro",filtro:"Toro",foto:null,texto:"Consulte aplicações"},
  {nome:"Sprinter",filtro:"Sprinter",foto:null,texto:"Consulte aplicações"},
] as const;

export function AberturaMobisV3({whatsapp,ir}:Pick<Comum,"whatsapp"|"ir">){
  return <section className="ms-abertura" aria-label="MOBIS — especialistas em peças diesel">
    <div className="ms-container ms-abertura-conteudo">
      <div className="ms-abertura-texto">
        <span className="ms-categoria-label">MOBIS AUTOPEÇAS · GOIÁS</span>
        <h1>ESPECIALISTA EM <em>PEÇAS DIESEL</em> PARA PICAPES, VANS E UTILITÁRIOS.</h1>
        <p>Encontre peças por sistema, veículo, motor ou código. Nossa equipe confirma a aplicação antes da compra.</p>
        <div className="ms-cta-hero">
          <button type="button" onClick={()=>ir("ms-aplicacoes")}>Encontrar a peça certa <span aria-hidden="true">→</span></button>
          {whatsapp&&<a href={whatsapp} target="_blank" rel="noopener noreferrer">Consultar no WhatsApp ↗</a>}
        </div>
        <div className="ms-hero-nota">Foto ilustrativa das linhas atendidas; aplicação e disponibilidade devem ser confirmadas.</div>
      </div>
      <div className="ms-vitrine-veiculos" aria-label="Linhas de veículos de referência">
        <div><img src={hr} width={430} height={320} alt="Veículo Hyundai HR — referência de linha"/></div>
        <div><img src={l200} width={430} height={320} alt="Picape Mitsubishi L200 — referência de linha"/></div>
        <div><img src={bongo} width={430} height={320} alt="Veículo Kia Bongo — referência de linha"/></div>
      </div>
    </div>
    <div className="ms-beneficios"><div className="ms-container ms-beneficios-grade">
      <span><b aria-hidden="true">▣</b> Pesquisa por SKU e referência</span>
      <span><b aria-hidden="true">✓</b> Aplicações com validação técnica</span>
      <span><b aria-hidden="true">⚙</b> Peças organizadas por sistema</span>
      <span><b aria-hidden="true">▤</b> Lista para consulta no WhatsApp</span>
    </div></div>
  </section>;
}

type AplicacoesProps={
  categorias:readonly Categoria[];opcoes:readonly string[];motores:readonly string[];
  f: Filtros;onModelo:(s:string)=>void;onMotor:(s:string)=>void;onAno:(s:string)=>void;onCategoria:(s:string)=>void;
  onAplicar:(event?:FormEvent)=>void;onAprovado:(s:string)=>void;onConsultar:(s:string)=>void;ir:(id:string)=>void;
  extra?:ReactNode;
};
export function AplicacoesMobisV3({categorias,opcoes,motores,f,onModelo,onMotor,onAno,onCategoria,onAplicar,onAprovado,onConsultar,ir,extra}:AplicacoesProps){
  const [montadora,setMontadora]=useState<MontadoraMobis|""|"Toyota">("");
  const modelosDaMontadora=montadora==="Toyota"
    ? opcoes.filter(x=>/hilux|toyota/i.test(x))
    : montadora?modelosAprovadosDaMontadora(montadora,opcoes):opcoes;
  const verificacao=(nome:string)=>opcoes.find(op=>normalizar(op)===normalizar(nome)||
   normalizar(op).includes(normalizar(nome))||normalizar(nome).includes(normalizar(op)));
  return <section id="ms-aplicacoes" className="ms-aplicacoes">
    <div className="ms-container">
      <div className="ms-titulo-bloco"><div><span className="ms-tracos" aria-hidden="true">///</span><h2>Aplicações em destaque</h2></div><p>Consulte por modelo, motor, ano e sistema.</p></div>
      <div className="ms-aplicacoes-grid">
        <aside className="ms-encontrar" aria-label="Encontrar a peça certa">
          <h3>⌕ Encontre a peça certa</h3>
          <p>Selecione o veículo para pesquisar peças aprovadas.</p>
          <form onSubmit={e=>{if(montadora&&!f.modelo){e.preventDefault();onConsultar(montadora);return;}onAplicar(e);}}>
            <label>Montadora<select value={montadora} onChange={e=>{setMontadora(e.target.value as MontadoraMobis|""|"Toyota");onModelo("");}}>
              <option value="">Selecione a montadora</option>
              {MONTADORAS_MOBIS.map(m=><option value={m.nome} key={m.nome}>{m.nome}</option>)}
              <option value="Toyota">Toyota (sob consulta)</option>
            </select></label>
            <label>Veículo / modelo<select value={f.modelo} onChange={e=>onModelo(e.target.value)}><option value="">Selecione o modelo</option>{[...new Set(modelosDaMontadora)].sort().map(x=><option key={x}>{x}</option>)}</select></label>
            <label>Motor / versão<select value={f.motor} onChange={e=>onMotor(e.target.value)}><option value="">Selecione o motor</option>{motores.map(x=><option key={x}>{x}</option>)}</select></label>
            <label>Ano / geração<input type="number" min={1980} max={new Date().getFullYear()+1} value={f.ano} placeholder="Ex.: 2019" onChange={e=>onAno(e.target.value.slice(0,4))}/></label>
            <label>Sistema / categoria<select value={f.categoria} onChange={e=>onCategoria(e.target.value)}><option value="">Todos os sistemas</option>{categorias.filter(x=>x.total>0).map(x=><option key={x.slug} value={x.slug}>{x.nome}</option>)}</select></label>
            <button type="submit">Buscar peças <span aria-hidden="true">→</span></button>
          </form>
          <small>Não encontrou a aplicação? Consulte a equipe. Sem cadastro aprovado, não inferimos compatibilidade.</small>
        </aside>
        <div className="ms-aplicacoes-vitrine">
          <div className="ms-linhas-grid">{LINHAS.map(v=>{
            const aprovada=verificacao(v.filtro);
            return <button type="button" className="ms-linha" key={v.nome} onClick={()=>aprovada?onAprovado(aprovada):onConsultar(v.nome)}>
              <div className="ms-linha-imagem">{v.foto?<img src={v.foto} alt={"Referência visual: "+v.nome} width={320} height={200} loading="lazy"/>:<span className="ms-silhueta" aria-hidden="true">▰</span>}</div>
              <div className="ms-linha-texto"><strong>{v.nome}</strong><small>{aprovada?"Ver aplicações aprovadas":v.texto+" · sob consulta"}</small></div>
            </button>;
          })}</div>
          <div className="ms-linha-promo">
            <div><span>CONSULTA TÉCNICA MOBIS</span><h3>PEÇAS E COMPONENTES PARA <em>MOTORES DIESEL</em></h3><p>Busque por SKU, fabricante, OEM aprovado ou aplicação confirmada. Sem anúncio aprovado, nossa equipe atende por consulta.</p></div>
            <button type="button" onClick={()=>ir("m2-catalogo")}>Consultar catálogo <span aria-hidden="true">›</span></button>
          </div>
          {extra}
        </div>
      </div>
    </div>
  </section>;
}

export function BarraConsultaMobisV3({whatsapp}: {whatsapp:string|null}){
  const url=whatsapp || linkWhatsAppPublico(null,"Olá, quero consultar uma peça na MOBIS Autopeças.");
  return <div className="ms-consulta-rodape"><div className="ms-container">
    <span>GOIÁS · MOBIS AUTOPEÇAS</span><span>Peças para picapes, vans e utilitários diesel</span>
    {url&&<a href={url} target="_blank" rel="noopener noreferrer">Atendimento WhatsApp ↗</a>}
    <a href="#/loja/mobis/empresa">Contato e informações da loja</a>
  </div></div>;
}
