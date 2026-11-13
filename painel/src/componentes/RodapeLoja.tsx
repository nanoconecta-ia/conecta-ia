import { useEffect, useRef, useState } from "react";
import "../rodape-loja.css";

export type PoliticasLojaPublicas = {
  razao_social: string | null;
  cnpj: string | null;
  endereco: string | null;
  telefone: string | null;
  email_contato: string | null;
  privacidade_texto: string | null;
  troca_devolucao_texto: string | null;
  entrega_texto: string | null;
  garantia_texto: string | null;
  termos_texto: string | null;
};

type Painel = "compra" | "privacidade" | "trocas" | "entrega" | "garantia" | "termos";
const paginas = [
  { id: "privacidade", titulo: "Privacidade", campo: "privacidade_texto" },
  { id: "trocas", titulo: "Trocas e devoluções", campo: "troca_devolucao_texto" },
  { id: "entrega", titulo: "Entrega", campo: "entrega_texto" },
  { id: "garantia", titulo: "Garantia", campo: "garantia_texto" },
  { id: "termos", titulo: "Termos de uso", campo: "termos_texto" },
] as const;

const instrucoesCompra = "Busque pelo nome, SKU ou veículo, confira a descrição e confirme a compatibilidade antes de comprar. Preços, disponibilidade, frete, prazo, forma de pagamento e valor final precisam ser informados e confirmados pela loja no fluxo de atendimento ou contratação. O contato para tirar dúvidas não representa pedido concluído.";

export function RodapeLoja({
  nome, politicas, ultima,
}: {
  nome: string;
  politicas: PoliticasLojaPublicas | null | undefined;
  ultima?: string | null;
}) {
  const [painel, setPainel] = useState<Painel | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (painel && !el.open) el.showModal();
    if (!painel && el.open) el.close();
  }, [painel]);

  const liberadas = paginas.filter((p) => !!politicas?.[p.campo]?.trim());
  const selecionada = paginas.find((p) => p.id === painel);
  const titulo = painel === "compra" ? "Como comprar" : (selecionada?.titulo ?? "");
  const texto = painel === "compra" ? instrucoesCompra : (selecionada && politicas?.[selecionada.campo]) || "";
  const temContato = !!(politicas?.telefone || politicas?.email_contato);
  const ano = new Date().getFullYear();

  return (
    <footer className="v-rodape-comercial" aria-label="Informações da loja">
      <div className="v-rodape-grade">
        <div className="v-rodape-apresentacao">
          <strong>{nome}</strong>
          <p>Peças automotivas e busca por veículo. Confirme a aplicação e as condições da oferta antes da compra.</p>
          {ultima && <small>Última sincronização informada: {new Date(ultima).toLocaleString("pt-BR")}. Estoque sujeito à confirmação.</small>}
        </div>
        <nav aria-label="Navegação da loja">
          <h2>Encontre sua peça</h2>
          <a href="#catalogo">Catálogo de produtos</a>
          <a href="#busca-veiculo">Buscar por veículo</a>
          <a href="#passo-categoria">Categorias de peças</a>
        </nav>
        <div className="v-rodape-grupo">
          <h2>Ajuda e orientações</h2>
          <button type="button" onClick={() => setPainel("compra")}>Como comprar</button>
          {liberadas.map((p) => (
            <button type="button" key={p.id} onClick={() => setPainel(p.id)}>{p.titulo}</button>
          ))}
          {!politicas && <small>Informações institucionais e políticas da loja em validação.</small>}
        </div>
        <div className="v-rodape-grupo">
          <h2>Identificação da loja</h2>
          {politicas ? (
            <>
              {politicas.razao_social && <p><strong>{politicas.razao_social}</strong></p>}
              {politicas.cnpj && <p>CNPJ: {politicas.cnpj}</p>}
              {politicas.endereco && <p className="v-rodape-endereco">{politicas.endereco}</p>}
              {politicas.telefone && <p>Telefone: {politicas.telefone}</p>}
              {politicas.email_contato && <a href={"mailto:" + politicas.email_contato}>{politicas.email_contato}</a>}
              {!temContato && <small>Consulte o contato informado no atendimento da loja.</small>}
            </>
          ) : <p>Dados cadastrais sujeitos à validação para publicação.</p>}
        </div>
      </div>
      <div className="v-rodape-faixa"><span>© {ano} {nome}. Conteúdo comercial da loja.</span><a href="#catalogo">Voltar aos produtos ↑</a></div>
      <dialog
        ref={dialog}
        className="v-rodape-dialogo"
        aria-labelledby="v-rodape-dialogo-titulo"
        onClose={() => setPainel(null)}
        onClick={(e) => { if (e.target === e.currentTarget) setPainel(null); }}
      >
        <div className="v-rodape-dialogo-topo">
          <h2 id="v-rodape-dialogo-titulo">{titulo}</h2>
          <button type="button" onClick={() => setPainel(null)} aria-label="Fechar informações">×</button>
        </div>
        <p className="v-rodape-politica">{texto}</p>
        <div className="v-rodape-dialogo-acoes">
          <button type="button" onClick={() => setPainel(null)}>Fechar</button>
        </div>
      </dialog>
    </footer>
  );
}
