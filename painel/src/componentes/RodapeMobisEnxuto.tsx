import type { MouseEvent } from "react";
import { linkWhatsAppPublico } from "../lib/publicoLoja.ts";
import "./rodape-enxuto-mobis.css";

/** Rodapé enxuto da vitrine Mobis: navegação e contato. Textos institucionais, políticas e identificação ficam na página "Sobre a Mobis". */
export function RodapeMobisEnxuto({ nome, whatsapp }: { nome: string; whatsapp?: string | null }) {
  const ano = new Date().getFullYear();
  // Mantém a navegação dentro da vitrine: rola até a seção sem trocar a rota.
  const irPara = (id: string) => (e: MouseEvent<HTMLAnchorElement>) => {
    const alvo = document.getElementById(id);
    if (!alvo) return;
    e.preventDefault();
    alvo.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const wa = linkWhatsAppPublico(whatsapp, "Olá! Vim pelo site " + nome + " e gostaria de falar com um vendedor.");
  return (
    <footer id="m2-privacidade" data-bloco="rodape" className="m4-rodape-enxuto" aria-label="Rodapé da loja">
      <div className="m4-rodape-linha">
        <strong>{nome}</strong>
        <nav aria-label="Atalhos">
          <a href="#/loja/mobis" onClick={irPara("m2-catalogo")}>Catálogo</a>
          <a href="#/loja/mobis" onClick={irPara("m2-montadoras")}>Buscar por veículo</a>
          <a href="#/loja/mobis" onClick={irPara("m2-taxonomia")}>Peças por sistema</a>
          <a href="#/loja/mobis/empresa">Sobre, contato e como consultar</a>
        </nav>
        {wa && <a className="m4-rodape-wa" href={wa} target="_blank" rel="noopener noreferrer">Falar no WhatsApp ↗</a>}
      </div>
      <div className="m4-rodape-faixa">
        <span>© {ano} {nome}</span>
        <a href="#m2-topo">Voltar ao topo ↑</a>
      </div>
    </footer>
  );
}
