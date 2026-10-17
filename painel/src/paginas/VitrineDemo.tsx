// DEMONSTRAÇÃO da loja pública com itens FICTÍCIOS (nenhum dado real da Mobis, nenhum preço real).
const ITENS = [
  { sku: "EXEMPLO-001", nome: "Peça de exemplo A", preco: "R$ 100,00", aplic: "Aplicação confirmada: exemplo" },
  { sku: "EXEMPLO-002", nome: "Peça de exemplo B", preco: "R$ 250,00", aplic: "Aplicação ainda não confirmada" },
  { sku: "EXEMPLO-003", nome: "Peça de exemplo C", preco: "R$ 75,00", aplic: "Aplicação confirmada: exemplo" },
];
export function VitrineDemo() {
  return (
    <>
      <header className="topo"><div className="marca"><i>M</i><div>Loja de exemplo<small>demonstração</small></div></div><span className="selo atencao">demonstração</span></header>
      <main>
        <div className="cartao"><h1>Catálogo</h1><p className="suave">Itens fictícios para mostrar o visual da vitrine. Produto incompleto não é publicado.</p></div>
        <div className="grade">{ITENS.map((i) => (
          <div key={i.sku} className="cartao">
            <div style={{ aspectRatio: "4 / 3", background: "var(--realce)", border: "1px dashed var(--borda)", borderRadius: 10, display: "grid", placeItems: "center" }} className="suave">foto da peça</div>
            <h2 style={{ marginTop: 10 }}>{i.nome}</h2>
            <p className="mono suave" style={{ margin: 0 }}>{i.sku}</p>
            <p className="numero" style={{ margin: "4px 0" }}>{i.preco}</p>
            <p className="suave">{i.aplic}</p>
            <button className="sec">Falar no WhatsApp</button>
          </div>))}</div>
      </main>
    </>
  );
}
