import { useState } from "react";
import type { ResumoImagem } from "../lib/galeriaProduto.ts";
import { indiceDaFoto, proximaFoto } from "../lib/carrosselVidroNano.ts";
import "./carrossel-vidro-nano.css";

export interface CarrosselVidroNanoProps {
  itens: readonly ResumoImagem[];
  selecionadas: readonly string[];
  branco: boolean;
  onComparar: (id: string) => void;
  onAmpliar: (item: ResumoImagem) => void;
  onPreviaPrincipal: (id: string) => void;
}
/** Camada visual de navegação. Aprovação e direitos permanecem no backend. */
export function CarrosselVidroNano({
  itens, selecionadas, branco, onComparar, onAmpliar, onPreviaPrincipal,
}: CarrosselVidroNanoProps) {
  const [ativaId, setAtivaId] = useState<string | null>(null);
  const indice = indiceDaFoto(itens, ativaId);
  const foto = itens[indice] ?? null;
  const navegar = (sentido: -1 | 1) => {
    if (!itens.length) return;
    setAtivaId(itens[proximaFoto(itens.length, indice, sentido)].id);
  };
  if (!foto) return null;

  return (
    <section className="gv2" aria-label="Carrossel em vidro de fotografias para revisão">
      <div className="gv2-topo">
        <span className="gv2-marca"><span aria-hidden="true" className="gv2-ponto" /> STUDIO NANO · GALERIA TÉCNICA</span>
        <span className="gv2-numero" aria-live="polite">{indice + 1} <span>/ {itens.length}</span></span>
      </div>

      <div className="gv2-superficie" onKeyDown={e => {
        if (e.target instanceof HTMLElement && e.target.closest("button")) return;
        if (e.key === "ArrowLeft") { e.preventDefault(); navegar(-1); }
        if (e.key === "ArrowRight") { e.preventDefault(); navegar(1); }
      }}>
        <div className="gv2-halo" aria-hidden="true" />
        <div className="gv2-espaco-foto">
          <button type="button" className="gv2-seta gv2-seta-esq" aria-label="Fotografia anterior"
            disabled={itens.length <= 1} onClick={() => navegar(-1)}>‹</button>
          <button type="button" className={`gv2-foto ${branco ? "gv2-foto-branca" : "gv2-foto-xadrez"}`}
            onClick={() => onAmpliar(foto)} aria-label={`Ampliar fotografia ${indice+1}: ${foto.origem}`}>
            <img key={foto.id} src={foto.url} referrerPolicy="no-referrer" alt={`Imagem candidata ${indice+1} da peça, fonte ${foto.origem}`} />
          </button>
          <button type="button" className="gv2-seta gv2-seta-dir" aria-label="Próxima fotografia"
            disabled={itens.length <= 1} onClick={() => navegar(1)}>›</button>
        </div>
        <div className="gv2-cabeca">
          <div className="gv2-titulo">
            <strong>Imagem {indice + 1} · {foto.origem}</strong>
            <span>{foto.resolucao} · {foto.licenca}</span>
          </div>
          <div className="gv2-estados">
            <span className={foto.estado === "aprovada" ? "gv2-aprovada" : "gv2-pendente"}>
              {foto.estado === "aprovada" ? "Identidade aprovada" : "A confirmar"}
            </span>
            {!foto.direitos && <span>Direitos pendentes</span>}
            {foto.principal && <span>Principal atual</span>}
          </div>
        </div>
      </div>

      <div className="gv2-miniaturas" role="group" aria-label="Escolher uma fotografia do carrossel">
        {itens.map((item, pos) => (
          <button type="button" key={item.id}
            className={`gv2-miniatura ${indice === pos ? "gv2-miniatura-ativa" : ""}`}
            onClick={() => setAtivaId(item.id)}
            aria-label={`Mostrar fotografia ${pos + 1} de ${itens.length}: ${item.origem}`}
            aria-pressed={indice === pos}>
            <img src={item.url} alt="" loading="lazy" referrerPolicy="no-referrer" />
            <span>{pos + 1}</span>
            {selecionadas.includes(item.id) && <i aria-hidden="true">✓</i>}
          </button>
        ))}
      </div>

      <div className="gv2-rodape">
        <p>Visualização apenas. Foto, identidade, licença e publicação continuam sujeitos à aprovação do lojista.</p>
        <div className="gv2-acoes">
          <button type="button" onClick={() => onComparar(foto.id)}
            aria-pressed={selecionadas.includes(foto.id)} className="gv2-botao gv2-botao-claro">
            {selecionadas.includes(foto.id) ? "Retirar da comparação" : "Adicionar à comparação"}
          </button>
          <button type="button" className="gv2-botao gv2-botao-acento"
            onClick={() => onPreviaPrincipal(foto.id)}>
            Prévia da principal
          </button>
        </div>
      </div>
    </section>
  );
}
