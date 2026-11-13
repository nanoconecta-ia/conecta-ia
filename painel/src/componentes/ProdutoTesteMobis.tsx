import { useState } from "react";
import { IconePeca } from "./IconePeca.tsx";

/** Amostra de interface isolada: não tem ID do ERP, preço, estoque ou ações comerciais. */
export function ProdutoTesteMobis() {
  const [detalhes, setDetalhes] = useState(false);
  return <section id="m2-produto-teste" className="m2-wrap m2-amostra" aria-labelledby="m2-amostra-titulo" data-produto-demonstrativo="true">
    <div className="m2-amostra-imagem"><IconePeca nome="motor" tamanho={180}/><small>Ilustração de categoria · não é foto do produto</small></div>
    <div className="m2-amostra-texto">
      <span className="m2-amostra-selo">PRODUTO DE TESTE · SEM VENDA</span>
      <h2 id="m2-amostra-titulo">Motor parcial para HR / Bongo</h2>
      <p>Uma amostra para você avaliar a apresentação da peça na loja. Este cartão não é um anúncio nem comprova aplicação ou disponibilidade.</p>
      <dl><div><dt>Referência visual</dt><dd>Motor diesel 2.5 16V</dd></div><div><dt>Preço e estoque</dt><dd>Não informados nesta demonstração</dd></div></dl>
      <button type="button" aria-expanded={detalhes} aria-controls="m2-amostra-detalhes" onClick={() => setDetalhes(v => !v)}>{detalhes ? "Recolher ficha de teste" : "Abrir ficha de teste"} <span aria-hidden="true">↗</span></button>
      {detalhes && <div id="m2-amostra-detalhes" className="m2-amostra-detalhes"><strong>Ficha demonstrativa</strong><p>No anúncio real, esta área reúne fotos da peça, marca, código do fabricante, referências OEM e aplicações comprovadas por ano, motor e versão.</p><p>Este exemplo não entra no catálogo, na lista de consulta ou no WhatsApp. Não permite compra nem reserva de peças.</p></div>}
    </div>
  </section>;
}
