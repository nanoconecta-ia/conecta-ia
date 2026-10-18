// Guia vivo do Design System: mostra os tokens e componentes reais, para todas as telas compartilharem o mesmo padrão.
const CORES: [string, string][] = [["--fundo", "Fundo"], ["--cartao", "Cartão"], ["--realce", "Realce"], ["--borda", "Borda"], ["--texto", "Texto"], ["--suave", "Texto suave"], ["--marca", "Azul (primário)"], ["--marca-forte", "Azul forte"], ["--verde", "Verde (sucesso/WhatsApp)"], ["--grafite", "Grafite"], ["--ok", "OK"], ["--atencao", "Atenção"], ["--erro", "Erro"]];

export function Design() {
  return (
    <>
      <div className="cartao">
        <h1>Design System <span className="selo atencao">referência</span></h1>
        <p className="suave">Tokens e componentes compartilhados por todos os módulos. Telas novas reaproveitam isto; nada de cor ou fonte solta.</p>
      </div>
      <div className="cartao">
        <h2>Cores (tokens)</h2>
        <div className="grade">{CORES.map(([v, n]) => (
          <div key={v} className="linha"><span style={{ width: 28, height: 28, borderRadius: 8, background: `var(${v})`, border: "1px solid var(--borda)" }} /><span><strong>{n}</strong><br /><code>{v}</code></span></div>
        ))}</div>
      </div>
      <div className="cartao">
        <h2>Tipografia</h2>
        <p style={{ fontFamily: "var(--titulo)", fontSize: "1.6rem", margin: 0 }}>Títulos e números grandes</p>
        <p style={{ margin: "4px 0" }}>Corpo de texto, rótulos e botões.</p>
        <p className="mono" style={{ margin: 0 }}>SKU CI001086 · NCM 8409.99.49 · 2026-10-17 12:00</p>
      </div>
      <div className="cartao">
        <h2>Componentes</h2>
        <p className="linha"><button>Primário</button><button className="sec">Secundário</button><button className="perigo">Perigo</button><button disabled>Desabilitado</button></p>
        <p className="linha"><span className="selo ok">Aprovado</span><span className="selo atencao">A confirmar</span><span className="selo erro">Bloqueado</span><span className="selo">Neutro</span></p>
        <p className="linha"><span className="selo ok">Foto real</span><span className="selo atencao">Imagem sintética</span></p>
        <form><label>Campo de texto<input placeholder="Exemplo" /></label></form>
        <div className="rolagem"><table><thead><tr><th>Produto</th><th>Campo</th><th>Confiança</th></tr></thead>
          <tbody><tr><td className="mono">EXEMPLO-001</td><td>marca_peca</td><td>70%</td></tr></tbody></table></div>
      </div>
    </>
  );
}
