import { linkWhatsAppPublico } from "../lib/publicoLoja.ts";

export type ItemConsulta = { sku: string; nome: string };
export function montarMensagemConsulta(itens: readonly ItemConsulta[]): string {
  const linhas = itens.slice(0, 10).map((i, n) => (n+1) + ". " + i.nome.slice(0, 110) + " (cód. " + i.sku.slice(0, 65) + ")");
  return "Olá! Vim pela loja virtual e gostaria de confirmar aplicação, preço e disponibilidade destas peças:\n" +
    linhas.join("\n") + "\nEsta é uma consulta, não um pedido.";
}
export function ListaConsultaLoja({ itens, numero, remover, limpar }: {
  itens: ItemConsulta[]; numero: string | null | undefined;
  remover: (sku: string) => void; limpar: () => void;
}) {
  if (!itens.length) return null;
  const wa = linkWhatsAppPublico(numero, montarMensagemConsulta(itens));
  return (
    <section id="minha-lista" className="v-lista-consulta" aria-label="Minha lista de consulta">
      <div className="v-lista-cabecalho">
        <div><h2>Minha lista de consulta</h2><p>Peças para conversar com o vendedor. Não reserva estoque, não conclui compra e não envia seus dados automaticamente.</p></div>
        <span aria-label={itens.length + " peças selecionadas"}>{itens.length}/10 peças</span>
      </div>
      <ul>{itens.map((i) => <li key={i.sku}><span><strong>{i.nome}</strong><small>SKU: {i.sku}</small></span>
        <button type="button" onClick={() => remover(i.sku)} aria-label={"Retirar " + i.nome}>Retirar</button></li>)}</ul>
      <div className="v-lista-acoes">
        {wa && <a href={wa} target="_blank" rel="noopener noreferrer">Consultar no WhatsApp</a>}
        <button type="button" onClick={limpar}>Limpar lista</button>
      </div>
    </section>
  );
}
