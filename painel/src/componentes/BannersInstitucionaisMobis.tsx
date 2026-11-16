import { useState } from "react";
import { IconePeca } from "./IconePeca.tsx";
import mascotes from "../assets/mobis/mascotes-10-especialistas.jpg";
import equipeAnimada from "../assets/mobis/nano-equipe-vendedores.gif";
import marcaGrafite from "../assets/mobis/logo-banner-grafite.png";
import "./banners-institucionais-mobis.css";

type Acao = "catalogo" | "codigos" | "veiculos";
const paineis: readonly {
  titulo: string; destaque: string; chamada: string; subtitulo: string;
  acao: Acao; botao: string; visual: "mascotes" | "motor" | "nano";
}[] = [
  {
    titulo: "Especialistas em peças para", destaque: "picapes e utilitários diesel",
    chamada: "MOBIS AUTOPEÇAS · LOJA INDEPENDENTE",
    subtitulo: "Atendimento humano, referências técnicas e confirmação de aplicação por veículo.",
    acao: "veiculos", botao: "Encontrar pelo veículo", visual: "mascotes",
  },
  {
    titulo: "Seu código é a chave para", destaque: "encontrar a peça certa",
    chamada: "BUSCA POR SKU · FABRICANTE · OEM APROVADO",
    subtitulo: "Pesquise pelo código real. Referências ainda não homologadas não são exibidas como equivalentes.",
    acao: "codigos", botao: "Pesquisar referência", visual: "motor",
  },
  {
    titulo: "O catálogo Mobis com", destaque: "atendimento especializado",
    chamada: "NANO MOBIS · CONSULTA DE PEÇAS",
    subtitulo: "Motores, suspensão, transmissão, elétrica, freios e arrefecimento. Confirme aplicação e disponibilidade.",
    acao: "catalogo", botao: "Explorar o catálogo", visual: "nano",
  },
];

export function BannersInstitucionaisMobis({
  abrirCatalogo, abrirBuscaCodigos, abrirVeiculos,
}: {
  abrirCatalogo: () => void; abrirBuscaCodigos: () => void; abrirVeiculos: () => void;
}) {
  const [indice, setIndice] = useState(0);
  const painel = paineis[indice];
  const acionar = () => {
    if (painel.acao === "codigos") abrirBuscaCodigos();
    else if (painel.acao === "veiculos") abrirVeiculos();
    else abrirCatalogo();
  };
  const navegar = (delta: number) => setIndice(valor => (valor + delta + paineis.length) % paineis.length);
  return (
    <section className="mbi" aria-label="Banners institucionais da Mobis Autopeças">
      <div className="mbi-marca"><span className="mbi-marca-linha" aria-hidden="true" /> MOBIS AUTOPEÇAS · DESTAQUES</div>
      <div className="mbi-painel" role="group" aria-roledescription="carrossel"
        aria-label={"Destaque " + (indice + 1) + " de " + paineis.length}
        onKeyDown={e => { if (e.key === "ArrowLeft") { e.preventDefault(); navegar(-1); } else if (e.key === "ArrowRight") { e.preventDefault(); navegar(1); } }}>
        <div className="mbi-mensagem" key={indice}>
          <span className="mbi-chamada">{painel.chamada}</span>
          <h2>{painel.titulo} <strong>{painel.destaque}</strong></h2>
          <p>{painel.subtitulo}</p>
          <button type="button" className="mbi-botao" onClick={acionar}>{painel.botao} <span aria-hidden="true">→</span></button>
          <small>Banners institucionais · sem oferta de preço ou reserva de estoque</small>
        </div>
        <div className="mbi-artes" aria-hidden="true" key={painel.visual}>
          {painel.visual === "mascotes" && <img className="mbi-mascotes" src={mascotes} alt="" loading="lazy" />}
          {painel.visual === "motor" && <div className="mbi-motor"><IconePeca nome="motor" tamanho={220} /><img src={marcaGrafite} alt="" loading="lazy" /></div>}
          {painel.visual === "nano" && <picture>
            <source media="(prefers-reduced-motion: reduce)" srcSet={mascotes} />
            <img className="mbi-nano" src={equipeAnimada} alt="" loading="lazy" />
          </picture>}
        </div>
      </div>
      <div className="mbi-navegacao" role="group" aria-label="Escolher banner institucional">
        <button type="button" className="mbi-seta" onClick={() => navegar(-1)} aria-label="Banner anterior">‹</button>
        {paineis.map((p, i) => <button type="button" key={p.chamada}
          className={"mbi-ponto" + (indice === i ? " mbi-selecionado" : "")}
          aria-label={"Exibir banner " + (i+1)} aria-pressed={indice === i}
          onClick={() => setIndice(i)}><span>{String(i+1).padStart(2,"0")}</span></button>)}
        <button type="button" className="mbi-seta" onClick={() => navegar(1)} aria-label="Próximo banner">›</button>
      </div>
    </section>
  );
}
