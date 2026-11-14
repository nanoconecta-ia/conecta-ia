import { useEffect, useRef, useState, type MouseEvent } from "react";
import "../rodape-loja.css";
import { MOBIS, linkWhatsAppPublico } from "../lib/publicoLoja.ts";

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
  nome, slug, whatsapp, politicas, ultima, secoes,
}: {
  nome: string;
  slug?: string | null;
  whatsapp?: string | null;
  politicas: PoliticasLojaPublicas | null | undefined;
  ultima?: string | null;
  secoes?: { catalogo: string; veiculo: string; categoria: string; empresa?: string };
}) {
  const [painel, setPainel] = useState<Painel | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const linkSecao = (secao: "catalogo" | "veiculo" | "categoria", ancora: string) => ({
    href: secoes ? "#/loja/" + encodeURIComponent(slug ?? "") : ancora,
    onClick: secoes ? (e: MouseEvent<HTMLAnchorElement>) => {
      e.preventDefault();
      document.getElementById(secoes[secao])?.scrollIntoView({ behavior: "smooth", block: "start" });
    } : undefined,
  });

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
  const temContato = !!(politicas?.telefone?.trim() || politicas?.email_contato?.trim());
  const ano = new Date().getFullYear();
  const mobis = slug === MOBIS.slug;
  // A Edge Function só retorna politicas com status 'aprovada'. Nada é inferido do nome/slug.
  const razao = politicas?.razao_social?.trim() || null;
  const cnpj = politicas?.cnpj?.trim() || null;
  const endereco = politicas?.endereco?.trim() || null;
  const telefone = politicas?.telefone?.trim() || null;
  const mapaAprovado = endereco ? "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(endereco) : null;
  const wa = linkWhatsAppPublico(whatsapp, "Olá! Vim pelo site " + nome + " e gostaria de falar com um vendedor.");
  const compartilhar = mobis ? "https://www.facebook.com/sharer/sharer.php?u=" + encodeURIComponent(MOBIS.site) : null;

  return (
    <footer className="v-rodape-comercial" aria-label="Informações da loja">
      <div className="v-rodape-grade">
        <div className="v-rodape-apresentacao">
          <strong>{nome}</strong>
          <p>Peças automotivas e busca por veículo. Confirme a aplicação e as condições da oferta antes da compra.</p>
          {mobis && <a className="v-rodape-site" href={MOBIS.site}>mobisautopecas.com.br</a>}
          <div className="v-rodape-sociais" aria-label="Redes sociais e localização">
            {wa && <a href={wa} target="_blank" rel="noopener noreferrer" aria-label="Falar no WhatsApp da loja"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 11.5a9 9 0 0 1-13 8L3 21l1.5-4.7A9 9 0 1 1 21 11.5Z"/><path d="M8 8.5c.4 3 3 5.6 6 6.4l1.5-1.5 2 1c-.5 1.7-2.1 2.6-3.8 2.2-4.2-1-7.3-4.2-8.2-8.2-.3-1.5.6-2.9 2.1-3.4l1.2 2Z"/></svg> WhatsApp</a>}
            {compartilhar && <a href={compartilhar} target="_blank" rel="noopener noreferrer" aria-label="Compartilhar a loja no Facebook"><svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor"><path d="M13.4 21v-8.2h2.8l.4-3.4h-3.2V7.3c0-1 .3-1.7 1.7-1.7h1.7v-3a21 21 0 0 0-2.4-.1c-2.5 0-4.2 1.5-4.2 4.4v2.5H7.4v3.4h2.8V21h3.2Z"/></svg> Facebook</a>}
            {mapaAprovado && <a href={mapaAprovado} target="_blank" rel="noopener noreferrer" aria-label="Localização cadastrada no Google Maps"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.7"/></svg> Google Maps</a>}
          </div>
          {ultima && <small>Última sincronização informada: {new Date(ultima).toLocaleString("pt-BR")}. Estoque sujeito à confirmação.</small>}
        </div>
        <nav aria-label="Navegação da loja">
          <h2>Encontre sua peça</h2>
          <a {...linkSecao("catalogo", "#catalogo")}>Catálogo de produtos</a>
          <a {...linkSecao("veiculo", "#busca-veiculo")}>Buscar por veículo</a>
          <a {...linkSecao("categoria", "#passo-categoria")}>Categorias de peças</a>
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
          {razao || cnpj || endereco ? (
            <>
              {razao && <p><strong>{razao}</strong></p>}
              {cnpj && <p>CNPJ: {cnpj}</p>}
              {endereco && <p className="v-rodape-endereco">{endereco}</p>}
              {telefone && <p>Telefone: {telefone}</p>}
              {politicas?.email_contato && <a href={"mailto:" + politicas.email_contato}>{politicas.email_contato}</a>}
              {!temContato && <small>Consulte o contato informado no atendimento da loja.</small>}
              {!politicas && <small>Identificação empresarial ainda não homologada para publicação.</small>}
            </>
          ) : <>
            <p>Conheça a empresa, o endereço da loja física e como falar com a equipe.</p>
            {secoes?.empresa && <a href={"#/loja/" + encodeURIComponent(slug ?? "")} onClick={(e) => { e.preventDefault(); document.getElementById(secoes.empresa!)?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>A Mobis e onde estamos</a>}
            {wa && <a href={wa} target="_blank" rel="noopener noreferrer">Falar no WhatsApp ↗</a>}
          </>}
        </div>
      </div>
      <div className="v-rodape-faixa"><span>© {ano} {nome}. Conteúdo comercial da loja.</span><a {...linkSecao("catalogo", "#catalogo")}>Voltar aos produtos ↑</a></div>
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
