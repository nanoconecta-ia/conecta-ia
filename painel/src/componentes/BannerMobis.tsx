import type { ReactNode } from "react";

/** Banner principal da loja Mobis (modelo claro v4).
 * Um único bloco fluido: mesma marcação do smartphone ao monitor largo, sem versões separadas.
 * Mostra a imagem do veículo correto de cada modelo (recebidas da página); a imagem identifica
 * o modelo, não o ano, a versão nem a aplicação da peça.
 */
export function BannerMobis({ veiculos, abrirEscolha, buscarCodigo, extra }: {
  veiculos: readonly { nome: string; foto: string }[];
  abrirEscolha: () => void;
  buscarCodigo: () => void;
  /** Ação opcional do ambiente de teste (ex.: atalho do produto de teste). */
  extra?: ReactNode;
}) {
  return (
    <section className="m4-banner m2-hero" aria-label="Peças para picapes, vans e utilitários diesel">
      <div className="m2-wrap m4-banner-grade">
        <div className="m4-banner-texto">
          <span className="m4-etiqueta">Mobis Autopeças · Loja independente</span>
          <h1>Peças para <strong>picapes, vans e utilitários diesel</strong></h1>
          <p>Motor, suspensão, transmissão, elétrica e muito mais. Procure pelo seu veículo ou pelo código da peça.</p>
          <div className="m4-banner-acoes">
            <button type="button" className="m4-botao" onClick={abrirEscolha}>Escolher meu veículo <span aria-hidden="true">→</span></button>
            <button type="button" className="m4-botao m4-botao-claro" onClick={buscarCodigo}>Já tenho o código</button>
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
              <img className="m4-foto-veiculo" src={v.foto} width={480} height={360} alt="" loading={i === 0 ? "eager" : "lazy"} decoding="async" />
              <figcaption>{v.nome}</figcaption>
            </figure>
          ))}
        </div>
      </div>
      <p className="m2-wrap m4-banner-nota">Imagens ilustrativas dos modelos; ano e versão podem variar. Aplicação, preço e disponibilidade são confirmados pelo chassi.</p>
    </section>
  );
}
