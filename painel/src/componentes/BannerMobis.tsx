import type { ReactNode } from "react";
import logoMobisOficial from "../assets/marcas/mobis-mstyle-v3-sem-slogan.svg";

/** Banner principal da loja Mobis (modelo claro v4).
 * Um único bloco fluido: mesma marcação do smartphone ao monitor largo, sem versões separadas.
 * Mostra a imagem do veículo correto de cada modelo (recebidas da página); a imagem identifica
 * o modelo, não o ano, a versão nem a aplicação da peça.
 */
export function BannerMobis({ veiculos, abrirEscolha, buscarCodigo, extra, campanha }: {
  veiculos: readonly { nome: string; foto: string; valor?: string }[];
  abrirEscolha: () => void;
  buscarCodigo: () => void;
  /** Ação opcional do ambiente de teste (ex.: atalho do produto de teste). */
  extra?: ReactNode;
  /** Destaque real gerenciado pelo lojista em Banners, nunca produto sintético. */
  campanha?: {sku:string;nome:string;chamada:string|null;imagem?:string|null;flash?:boolean};
}) {
  return (
    <section className="m4-banner m2-hero" aria-label="Peças para picapes, vans e utilitários diesel">
      <div className="m2-wrap m4-banner-grade">
        <div className="m4-banner-texto">
          <span className="m4-etiqueta">Mobis Autopeças · Loja independente</span>
          <h1>Peças para <strong>utilitários diesel</strong></h1>
          <p>Encontre pelo nome, código ou modelo. Confira as peças disponíveis no catálogo.</p>
          {campanha&&<a className="m4-banner-campanha" href={"#/p/mobis/"+encodeURIComponent(campanha.sku)}
            aria-label={"Abrir página individual do produto "+campanha.sku+" na própria loja"}>
            {campanha.imagem
              ? <img className="m4-banner-campanha-foto" src={campanha.imagem} alt="" loading="lazy"/>
              : <img className="m4-banner-campanha-logo-oficial" src={logoMobisOficial} alt="" aria-hidden="true" width={1983} height={793} style={{width:110,maxWidth:"100%",height:"auto",objectFit:"contain"}}/>}
            <span><small>{campanha.flash?"DESTAQUE FLASH":"CAMPANHA CONECTA.IA"}</small>
              <strong>{campanha.chamada||campanha.nome}</strong>
              <em>Ver ficha e aplicações por veículo · SKU {campanha.sku}</em>
            </span><b aria-hidden="true">→</b>
          </a>}
          <div className="m4-banner-acoes">
            <button type="button" className="m4-botao" onClick={abrirEscolha}>Ver veículos e peças <span aria-hidden="true">→</span></button>
            <button type="button" className="m4-botao m4-botao-claro" onClick={buscarCodigo}>Buscar por SKU ou OEM</button>
            {extra}
          </div>
          <ul className="m4-banner-garantias">
            <li>Atendimento especializado</li>
            <li>Aplicação conferida com você</li>
            <li>Consulta direta via WhatsApp</li>
          </ul>
        </div>
        <div className="m4-banner-arte" aria-label="Modelos atendidos">
          {veiculos.map((v, i) => (
            <figure key={v.nome}>
              <a className="m4-hero-veiculo-link" href={"#/loja/mobis/veiculo/"+encodeURIComponent(v.valor||v.nome)} aria-label={"Ver peças para "+v.nome}>
                <img className="m4-foto-veiculo" src={v.foto} width={480} height={360} alt={v.nome} loading={i === 0 ? "eager" : "lazy"} decoding="async" />
                <figcaption>{v.nome} <span aria-hidden="true">→</span></figcaption>
              </a>
            </figure>
          ))}
        </div>
      </div>
      <p className="m2-wrap m4-banner-nota">Os veículos identificam linhas de consulta; a compatibilidade é conferida na ficha aprovada de cada peça.</p>
    </section>
  );
}
