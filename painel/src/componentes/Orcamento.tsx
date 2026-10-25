import { useEffect, useState } from "react";
import { adicionar, alterarQtd, carregar, linkOrcamento, numeroDoLink, remover, salvar, totalReferencia, type ItemOrcamento } from "../lib/orcamento.ts";

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const armazem = () => { try { return window.localStorage; } catch { return null; } };

/** Lista de orçamento da loja: junta peças e abre UMA conversa no WhatsApp. Sem cobrança nem reserva; preço é de referência. */
export function Orcamento({ slug, produto }: { slug: string; produto: { sku: string; nome: string; preco: number | null; whatsapp: string | null } }) {
  const [lista, setLista] = useState<ItemOrcamento[]>([]);
  useEffect(() => { setLista(carregar(slug, armazem())); }, [slug]);
  const mudar = (nova: ItemOrcamento[]) => { setLista(nova); salvar(slug, nova, armazem()); };
  const numero = numeroDoLink(produto.whatsapp);
  const link = linkOrcamento(numero, lista, `ref: ${slug}`);
  const total = totalReferencia(lista);
  const jaTem = lista.some((x) => x.sku === produto.sku);
  return (
    <section className="cartao orcamento" aria-label="Orçamento">
      <h2 style={{ marginTop: 0 }}>Orçamento</h2>
      <button type="button" onClick={() => mudar(adicionar(lista, { sku: produto.sku, nome: produto.nome, preco: produto.preco }))}>{jaTem ? "Mais uma unidade" : "Adicionar ao orçamento"}</button>
      {lista.length > 0 && (
        <>
          <ul className="orc-lista">
            {lista.map((x) => (
              <li key={x.sku}>
                <span><b>{x.nome}</b> <small className="mono suave">{x.sku}</small>{x.preco != null && <small className="suave"> · ref. {brl(x.preco)}</small>}</span>
                <span className="orc-acoes">
                  <label>Qtd<input type="number" inputMode="numeric" min={1} max={99} value={x.qtd} onChange={(e) => mudar(alterarQtd(lista, x.sku, Number(e.target.value)))} /></label>
                  <button type="button" className="sec" aria-label={`Remover ${x.nome}`} onClick={() => mudar(remover(lista, x.sku))}>Remover</button>
                </span>
              </li>
            ))}
          </ul>
          {total != null && <p className="v-preco">Total de referência: {brl(total)}</p>}
          <p className="suave">Valores de referência. A loja confirma preço e estoque na conversa; nada é cobrado agora.</p>
          {link ? <a className="botao verde" href={link} target="_blank" rel="noopener noreferrer">Pedir orçamento no WhatsApp</a> : <p className="suave">WhatsApp da loja indisponível no momento.</p>}
        </>
      )}
    </section>
  );
}
