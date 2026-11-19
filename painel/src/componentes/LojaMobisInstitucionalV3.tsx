import {useState, type FormEvent} from "react";
import {MONTADORAS_MOBIS, modelosAprovadosDaMontadora, type MontadoraMobis} from "../lib/blocosCatalogoMobis.ts";
import logo from "../assets/marcas/mobis-mstyle-v3-sem-slogan.svg";

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
  exata:boolean;onExata:(valor:boolean)=>void;
  whatsapp:string|null;ir:(id:string)=>void;
  categorias:readonly Categoria[];selecionarDepartamento:(chave:string,nome:string)=>void;departamentoAtivo?:string;
  bannersPresentes:boolean;
};

export function CabecalhoMobisV3({busca,onBusca,onEnviar,exata,onExata,whatsapp,ir,categorias,selecionarDepartamento,departamentoAtivo,bannersPresentes}:Comum){
  return <div className="ms-cabecalho" data-bloco="cabecalho" data-mobis-vitrine-completa="v3">
    <div className="ms-faixa-superior">
      <div className="ms-container ms-faixa-interna">
        <span><b aria-hidden="true">●</b> Goiás · Atendimento em autopeças diesel</span>
        <span className="ms-faixa-razao">MOBIS AUTOPEÇAS · GOIÂNIA</span>
        {whatsapp&&<a href={whatsapp} target="_blank" rel="noopener noreferrer">Consulta pelo WhatsApp ↗</a>}
      </div>
    </div>
    <div className="ms-principal"><div className="ms-container ms-principal-grid">
      <a className="ms-logo" href="#/loja/mobis" aria-label="Mobis Autopeças — página inicial"><img src={logo} width={1000} height={330} alt="MOBIS AUTOPEÇAS — M-STYLE CROMO V3"/></a>
      <p className="ms-especialidade">Peças para <strong>picapes, vans e utilitários diesel</strong> <small>Aplicação técnica sob consulta</small></p>
      <form className="ms-pesquisa" role="search" aria-label="Buscar peça e referência" onSubmit={onEnviar}>
        <label className="ms-visualmente-oculto" htmlFor="ms-buscar">Buscar peça, SKU, OEM ou aplicação</label>
        <input id="ms-buscar" type="search" maxLength={60} value={busca} onChange={e=>onBusca(e.target.value)} placeholder={exata?"SKU, fabricante ou OEM exato":"Peça, SKU, OEM, veículo ou motor"}/>
        <label className="ms-codigo-exato"><input type="checkbox" checked={exata} onChange={e=>onExata(e.target.checked)}/><span>Código exato</span></label>
        <button type="submit" aria-label="Pesquisar peças"><span aria-hidden="true">⌕</span><span>Buscar</span></button>
      </form>
      <div className="ms-acoes">
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
      <a href="#/loja/mobis/empresa">Contato</a>
    </div></nav>
    <div id="ms-departamentos" className="ms-departamentos-faixa" aria-label="Departamentos de peças">
      <div className="ms-container ms-departamentos-lista">
        {SETORES_MOBIS_V3.map(s=>{
          const categoria=setorComCategoria(s,categorias);
          return <button key={s.chave} type="button" className={departamentoAtivo===s.chave?"ms-departamento-ativo":undefined}
            title={"Filtrar peças do departamento "+s.nome}
            aria-label={"Filtrar produtos de "+s.nome} aria-pressed={departamentoAtivo===s.chave}
            onClick={()=>selecionarDepartamento(s.chave,s.nome)}>
            <img src={s.icone} width={66} height={66} alt="" aria-hidden="true"/>
            <span>{s.nome}</span><small>{categoria?"Ver peças":"Filtrar peças"}</small>
          </button>;
        })}
      </div>
    </div>
  </div>;
}

type AplicacoesProps={
  categorias:readonly Categoria[];opcoes:readonly string[];motores:readonly string[];
  f: Filtros;onModelo:(s:string)=>void;onMotor:(s:string)=>void;onAno:(s:string)=>void;onCategoria:(s:string)=>void;
  onAplicar:(event?:FormEvent)=>void;onLimpar:()=>void;
  departamentoPendente?:{chave:string;nome:string}|null;
};
/** Único formulário de filtros: a busca textual/SKU continua somente no cabeçalho V3. */
export function AplicacoesMobisV3({categorias,opcoes,motores,f,onModelo,onMotor,onAno,onCategoria,onAplicar,onLimpar,departamentoPendente}:AplicacoesProps){
  const [montadora,setMontadora]=useState<MontadoraMobis|""|"Toyota">("");
  const modelosDaMontadora=montadora==="Toyota"
    ? opcoes.filter(x=>/hilux|toyota/i.test(x))
    : montadora?modelosAprovadosDaMontadora(montadora,opcoes):opcoes;
  return <section id="ms-aplicacoes" data-bloco="filtros" className="ms-aplicacoes" aria-label="Pesquisa única por aplicação">
    <div className="ms-container">
      <div className="ms-aplicacoes-grid ms-aplicacoes-grid-unica">
        <aside className="ms-encontrar" aria-label="Filtros por veículo">
          <div className="ms-encontrar-titulo"><h2>Encontre sua peça</h2><p>Selecione o veículo e refine a aplicação. Não presumimos compatibilidade sem aprovação técnica.</p></div>
          <form onSubmit={onAplicar}>
            <label>Montadora<select aria-label="Montadora" value={montadora} onChange={e=>{setMontadora(e.target.value as MontadoraMobis|""|"Toyota");onModelo("");}}>
              <option value="">Todas as montadoras</option>
              {MONTADORAS_MOBIS.map(m=><option value={m.nome} key={m.nome}>{m.nome}</option>)}
              <option value="Toyota">Toyota (sob consulta)</option>
            </select></label>
            <label>Veículo / modelo<select aria-label="Veículo / modelo" value={f.modelo} onChange={e=>onModelo(e.target.value)}><option value="">Todos os modelos</option>{[...new Set(modelosDaMontadora)].sort().map(x=><option key={x}>{x}</option>)}</select></label>
            <label>Motor / versão<select aria-label="Motor / versão" value={f.motor} onChange={e=>onMotor(e.target.value)}><option value="">Todos os motores</option>{motores.map(x=><option key={x}>{x}</option>)}</select></label>
            <label>Ano / geração<input aria-label="Ano / geração" type="number" min={1980} max={new Date().getFullYear()+1} value={f.ano} placeholder="Ex.: 2019" onChange={e=>onAno(e.target.value.slice(0,4))}/></label>
            <label>Sistema / categoria<select aria-label="Sistema / categoria" value={f.categoria} onChange={e=>onCategoria(e.target.value)}><option value="">Todos os sistemas</option>{departamentoPendente&&<option value={departamentoPendente.chave}>{departamentoPendente.nome} · em organização</option>}{categorias.filter(x=>x.total>0).map(x=><option key={x.slug} value={x.slug}>{x.nome}</option>)}</select></label>
            <button type="submit">Aplicar filtros <span aria-hidden="true">→</span></button>
            <button className="ms-limpar-filtros" type="button" onClick={()=>{setMontadora("");onLimpar();}}>Limpar filtros</button>
          </form>
        </aside>
      </div>
    </div>
  </section>;
}
