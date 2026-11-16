import { useState } from "react";
import { IconePeca } from "./IconePeca.tsx";
import { proximaFoto } from "../lib/carrosselVidroNano.ts";
import "./carrossel-vidro-mobis.css";

/** Vitrine por sistema, só navegação. Ícones 3D são os ativos aprovados da Mobis.
 * Não afirma aplicação, não cria produto/anúncio nem toca no ERP.
 */
const sistemas = [
  { id: "motor", busca: "motor", titulo: "Motores diesel", descricao: "Motores, cabeçotes e componentes internos", nota: "01 / Motor" },
  { id: "suspensao", busca: "suspensao", titulo: "Suspensão", descricao: "Bandejas e componentes de suspensão", nota: "02 / Suspensão" },
  { id: "transmissao", busca: "transmissao", titulo: "Transmissão", descricao: "Embreagem, câmbio e transmissão", nota: "03 / Transmissão" },
  { id: "freios", busca: "freios", titulo: "Freios", descricao: "Componentes do sistema de frenagem", nota: "04 / Freios" },
  { id: "eletrica", busca: "eletrica", titulo: "Elétrica", descricao: "Sensores e componentes elétricos", nota: "05 / Elétrica" },
  { id: "arrefecimento", busca: "arrefecimento", titulo: "Arrefecimento", descricao: "Radiadores e componentes de refrigeração", nota: "06 / Arrefecimento" },
] as const;

export function CarrosselVidroMobis({ aoSelecionar }: { aoSelecionar: (busca: string) => void }) {
  const [indice, setIndice] = useState(0);
  const ativo = sistemas[indice];
  function navegar(sentido: -1 | 1) {
    setIndice(atual => proximaFoto(sistemas.length, atual, sentido));
  }
  return (
    <section className="mgv" aria-label="Explorar sistemas automotivos em carrossel">
      <div className="mgv-topo">
        <div>
          <span className="mgv-sobretitulo">MOBIS AUTOPEÇAS · GALERIA 3D</span>
          <h2>Explore as peças por sistema</h2>
          <p>Uma seleção visual para encontrar a categoria. Confirme a aplicação da peça pelo veículo.</p>
        </div>
        <span className="mgv-contador" aria-live="polite">{String(indice + 1).padStart(2, "0")} <span>/ 06</span></span>
      </div>
      <div className="mgv-vidro" role="group" aria-label="Sistemas da Mobis"
        tabIndex={0} onKeyDown={event => {
          if (event.key === "ArrowLeft") { event.preventDefault(); navegar(-1); }
          if (event.key === "ArrowRight") { event.preventDefault(); navegar(1); }
        }}>
        <div className="mgv-orbita" aria-hidden="true" />
        <button type="button" className="mgv-seta" aria-label="Sistema anterior" onClick={() => navegar(-1)}>‹</button>
        <div className="mgv-centro" key={ativo.id}>
          <div className="mgv-imagem">
            <IconePeca nome={ativo.id} tamanho={230} titulo={"Ilustração 3D da categoria " + ativo.titulo} />
          </div>
          <div className="mgv-copy">
            <span className="mgv-ref">{ativo.nota}</span>
            <h3>{ativo.titulo}</h3>
            <p>{ativo.descricao}</p>
            <button type="button" className="mgv-cta" onClick={() => aoSelecionar(ativo.busca)}>
              Encontrar peças <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
        <button type="button" className="mgv-seta" aria-label="Próximo sistema" onClick={() => navegar(1)}>›</button>
      </div>
      <div className="mgv-miniaturas" role="group" aria-label="Selecionar sistema">
        {sistemas.map((s, pos) => (
          <button type="button" key={s.id} className={pos === indice ? "mgv-miniatura mgv-ativa" : "mgv-miniatura"}
            onClick={() => setIndice(pos)} aria-pressed={pos === indice}
            aria-label={"Exibir categoria " + s.titulo}>
            <IconePeca nome={s.id} tamanho={54} />
            <span>{s.titulo}</span>
          </button>
        ))}
      </div>
      <p className="mgv-aviso">Imagens ilustrativas de categorias, não de produtos disponíveis. Preço, estoque e compatibilidade sujeitos à confirmação.</p>
    </section>
  );
}
