import hyundai from "../assets/veiculos-reais/hyundai-porter.jpg";
import kia from "../assets/veiculos-reais/kia-k2500.jpg";
import mitsubishi from "../assets/veiculos-reais/mitsubishi-l200.jpg";
import sprinter from "../assets/veiculos-reais/mercedes-sprinter.jpg";
import iveco from "../assets/veiculos-reais/iveco-daily.jpg";
import { IconePeca } from "./IconePeca.tsx";
import "./vitrine-fotografica-mobis.css";

type VeiculoFoto = {
  nome: string;
  valor: string;
  foto: string;
  alt: string;
  credito: string;
};

const veiculos: readonly VeiculoFoto[] = [
  {
    nome: "Hyundai HR",
    valor: "HR",
    foto: hyundai,
    alt: "Foto real de Hyundai Porter, família de utilitários relacionada ao Hyundai HR; ano e versão ilustrativos",
    credito: "Hyundai Porter · Benespit · CC BY-SA 4.0",
  },
  {
    nome: "Kia Bongo K2500",
    valor: "Bongo",
    foto: kia,
    alt: "Foto real de Kia Bongo K2500, usada apenas como referência visual de modelo",
    credito: "Kia K2500 · Billcheng332 · CC BY-SA 4.0",
  },
  {
    nome: "Mitsubishi L200",
    valor: "L200",
    foto: mitsubishi,
    alt: "Foto real de Mitsubishi L200; geração fotografada pode diferir da peça procurada",
    credito: "Mitsubishi L200 · crash71100 · CC0",
  },
  {
    nome: "Mercedes Sprinter",
    valor: "Sprinter",
    foto: sprinter,
    alt: "Foto real de Mercedes-Benz Sprinter; consulte o ano e a configuração",
    credito: "Mercedes Sprinter · Oleg Yunakov · CC0",
  },
  {
    nome: "Iveco Daily",
    valor: "Daily",
    foto: iveco,
    alt: "Foto real de Iveco Daily; geração ilustrativa, confirme a aplicação",
    credito: "Iveco Daily · Martin P. · domínio público",
  },
];

const sistemas = [
  { id:"motor", rotulo:"Motor",busca:"motor" },
  { id:"motor", rotulo:"Cabeçote / motor interno",busca:"cabecote" },
  { id:"suspensao",rotulo:"Suspensão",busca:"suspensao" },
  { id:"transmissao",rotulo:"Transmissão",busca:"transmissao" },
  { id:"eletrica",rotulo:"Elétrica",busca:"eletrica" },
  { id:"arrefecimento",rotulo:"Arrefecimento",busca:"arrefecimento" },
  { id:"freios",rotulo:"Freios",busca:"freios" },
  { id:"alimentacao",rotulo:"Filtros",busca:"filtro" },
] as const;

export function VitrineFotograficaMobis({
  escolherVeiculo, consultarVeiculo, temAplicacao, escolherSistema, buscarCodigo, abrirEscolha,
}:{
  escolherVeiculo:(valor:string)=>void;
  abrirEscolha:()=>void;
  consultarVeiculo:(valor:string)=>void;
  temAplicacao:(valor:string)=>boolean;
  escolherSistema:(valor:string)=>void;
  buscarCodigo:()=>void;
}) {
  return (
    <>
      <section className="m3-hero" aria-label="Peças para picapes, vans e utilitários diesel">
        <div className="m3-hero-tarjeta">
          <span className="m3-hero-etiqueta">MOBIS AUTOPEÇAS · LOJA INDEPENDENTE</span>
          <h1>PEÇAS PARA <strong>PICAPES, VANS E UTILITÁRIOS DIESEL</strong></h1>
          <p>Motor, suspensão, transmissão, elétrica e muito mais. Procure pelo seu modelo ou referência técnica.</p>
          <div className="m3-hero-acoes">
            <button type="button" onClick={abrirEscolha}>Escolher meu veículo <span aria-hidden="true">↗</span></button>
            <button type="button" onClick={buscarCodigo}>Já tenho o código <span aria-hidden="true">→</span></button>
          </div>
          <small>Aplicação, versão, preço e disponibilidade sujeitos à confirmação por chassi.</small>
        </div>
        <div className="m3-hero-fotos" aria-label="Fotos reais ilustrativas dos veículos atendidos">
          {veiculos.map(v=><article className="m3-hero-foto" key={v.nome}>
            <img src={v.foto} alt={v.alt} loading={v.valor==="HR"?"eager":"lazy"} decoding="async"/>
            <div className="m3-hero-foto-barra">
              <strong>{v.nome}</strong>
              <button type="button" onClick={()=>temAplicacao(v.valor)?escolherVeiculo(v.valor):consultarVeiculo(v.valor)}
                aria-label={(temAplicacao(v.valor)?"Ver peças de ":"Consultar peças para ")+v.nome}>
                {temAplicacao(v.valor)?"Ver peças":"Consultar"} <span aria-hidden="true">↗</span>
              </button>
            </div>
          </article>)}
        </div>
        <p className="m3-hero-aviso">Fotografias reais ilustrativas (gerações e versões podem variar). Nomes de montadoras indicam aplicação, não vínculo comercial com a Mobis. <a href="#m3-creditos">Créditos das imagens</a>.</p>
      </section>
      <section id="m3-categorias" className="m3-faixa-sistemas" aria-label="Buscar por sistemas e categorias">
        <div className="m3-faixa-topo">
          <strong>Encontre peças por sistema</strong>
          <span>Selecione uma categoria para pesquisar o catálogo real</span>
        </div>
        <div className="m3-faixa-lista">
          {sistemas.map(s=><button key={s.rotulo} type="button" onClick={()=>escolherSistema(s.busca)}
            aria-label={"Pesquisar peças: "+s.rotulo}>
            <span className="m3-icone-peca"><IconePeca nome={s.id} tamanho={108}/></span>
            <span className="m3-rotulo-peca">{s.rotulo}</span>
          </button>)}
        </div>
      </section>
      <aside className="m3-creditos" id="m3-creditos" aria-label="Licenças das fotografias">
        {veiculos.map((v)=><span key={v.nome}>{v.credito}</span>)}
        <span>Fotografias: Wikimedia Commons. Arquivos redimensionados para carregamento rápido; CC BY-SA 4.0 nas fotos indicadas. <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener noreferrer">Licença</a>.</span>
      </aside>
    </>
  );
}
