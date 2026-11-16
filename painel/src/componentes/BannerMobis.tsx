import type { ReactNode } from "react";
import { IconeVeiculo } from "./IconePeca.tsx";

/** Banner principal da loja Mobis (modelo claro v4).
 * Um único bloco fluido: mesma marcação do smartphone ao monitor largo, sem versões separadas.
 * Usa só as ilustrações 3D aprovadas de tipos de veículo: não representa modelo, ano nem aplicação.
 */
const TIPOS = [
  { tipo: "picape", rotulo: "Picapes" },
  { tipo: "furgao", rotulo: "Vans" },
  { tipo: "caminhao", rotulo: "Utilitários diesel" },
] as const;

export function BannerMobis({ abrirEscolha, buscarCodigo, extra }: {
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
        <div className="m4-banner-arte" aria-label="Tipos de veículo atendidos">
          {TIPOS.map(t => (
            <figure key={t.tipo}>
              <IconeVeiculo tipo={t.tipo} largura={240} titulo="" />
              <figcaption>{t.rotulo}</figcaption>
            </figure>
          ))}
        </div>
      </div>
      <p className="m2-wrap m4-banner-nota">Ilustrações de tipos de veículo. Aplicação, versão, preço e disponibilidade são confirmados pelo chassi.</p>
    </section>
  );
}
