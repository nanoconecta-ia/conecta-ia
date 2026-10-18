import { useState } from "react";

// DEMONSTRAÇÃO: não gera nem salva imagem. Mostra a distinção obrigatória entre foto técnica real e imagem sintética.
const FORMATOS = [{ id: "quadrado", nome: "Quadrado 1:1", w: 1, h: 1 }, { id: "paisagem", nome: "Paisagem 16:9", w: 16, h: 9 }, { id: "retrato", nome: "Retrato 4:5", w: 4, h: 5 }];

export function Imagens() {
  const [formato, setFormato] = useState("quadrado");
  const f = FORMATOS.find((x) => x.id === formato)!;
  return (
    <>
      <div className="cartao">
        <h1>Imagens e SEO <span className="selo atencao">demonstração</span></h1>
        <p className="suave">Nada é gerado nem salvo aqui. A tela mostra como a plataforma separa a foto técnica real da imagem gerada.</p>
      </div>
      <div className="grade">
        <div className="cartao">
          <h2>Foto técnica real <span className="selo ok">real</span></h2>
          <div style={{ aspectRatio: "1", background: "var(--realce)", border: "1px dashed var(--borda)", borderRadius: 10, display: "grid", placeItems: "center" }} className="suave">foto da peça</div>
          <p className="suave">Identifica a peça. Nunca é substituída por imagem gerada.</p>
        </div>
        <div className="cartao">
          <h2>Imagem comercial <span className="selo atencao">sintética</span></h2>
          <div style={{ aspectRatio: `${f.w} / ${f.h}`, background: "linear-gradient(135deg,var(--marca),var(--marca-forte))", borderRadius: 10, display: "grid", placeItems: "center", color: "var(--marca-texto)", fontFamily: "var(--titulo)", maxHeight: 260 }}>banner de exemplo</div>
          <p className="linha" style={{ marginTop: 8 }}>{FORMATOS.map((x) => <button key={x.id} className={x.id === formato ? "" : "sec"} onClick={() => setFormato(x.id)}>{x.nome}</button>)}</p>
          <p className="suave">Rótulo "sintética" obrigatório, direitos e hash registrados, aprovação antes de publicar. Dimensões de marketplace entram com fonte e data.</p>
        </div>
      </div>
      <div className="cartao">
        <h2>Prévia de SEO</h2>
        <p className="suave">Título, descrição e dados estruturados só com fatos aprovados.</p>
        <p style={{ margin: 0 }}><strong>Peça de exemplo — código EXEMPLO-001 | Loja de exemplo</strong></p>
        <p className="suave" style={{ margin: 0 }}>Descrição curta montada apenas com dados confirmados pela loja.</p>
      </div>
    </>
  );
}
