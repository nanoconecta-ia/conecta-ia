import type { LojaPublica, PoliticasPublicas } from "@/lib/vitrine";

const ITENS = [
  ["Privacidade", "privacidade_texto"],
  ["Trocas e devoluções", "troca_devolucao_texto"],
  ["Entrega", "entrega_texto"],
  ["Garantia", "garantia_texto"],
  ["Termos de uso", "termos_texto"],
] as const;

/** Os textos só vêm de loja_politicas.status='aprovada'. Nunca copia políticas da plataforma
 * como se fossem políticas da loja do cliente. Identificação e canal são por tenant.
 */
export function RodapeComercialWeb({ loja, politicas }: { loja: LojaPublica; politicas: PoliticasPublicas | null }) {
  const numero = (loja.whatsapp ?? "").replace(/\D/g, "");
  const wa = /^55\d{10,11}$/.test(numero) ? "https://wa.me/"+numero+"?text="+encodeURIComponent("Olá! Vim pelo catálogo e gostaria de consultar uma peça.") : null;
  return <footer className="mobis-web-rodape" aria-label="Informações comerciais e políticas da loja">
    <div><strong>{loja.nome}</strong>
      {loja.slug === "mobis" && <p>Site oficial: mobisautopecas.com.br</p>}
      {politicas?.razao_social && <p>{politicas.razao_social}</p>}
      {politicas?.cnpj && <p>CNPJ: {politicas.cnpj}</p>}
      {politicas?.endereco && <p className="whitespace-pre-line">{politicas.endereco}</p>}
      {politicas?.telefone && <p>Contato: {politicas.telefone}</p>}
    </div>
    <nav aria-label="Canais de atendimento">
      {wa && <a href={wa} target="_blank" rel="noopener noreferrer">WhatsApp do vendedor</a>}
      {politicas?.email_contato && <a href={"mailto:"+politicas.email_contato}>E-mail da loja</a>}
      {loja.slug === "mobis" && <a href="https://www.google.com/maps/search/?api=1&query=Av.%20T-9%2C%203492%2C%20Jardim%20Am%C3%A9rica%2C%20Goi%C3%A2nia%20GO" target="_blank" rel="noopener noreferrer">Localização cadastral no Maps</a>}
    </nav>
    <section className="mobis-web-politicas" aria-label="Privacidade, direitos e condições comerciais">
      <h2>Privacidade e condições da loja</h2>
      <p>Não envie CPF, senhas, chassi completo ou dados bancários pelo chat. Consultar uma peça não conclui um pedido.</p>
      <div>{ITENS.map(([titulo,campo]) => {
        const texto = politicas?.[campo]?.trim();
        return texto ? <details key={campo}><summary>{titulo}</summary><p className="whitespace-pre-wrap">{texto}</p></details>
          : <p key={campo}><strong>{titulo}:</strong> em revisão — texto ainda não aprovado para publicação.</p>;
      })}</div>
      <small>Os documentos comerciais são publicados somente após revisão formal pela empresa.</small>
    </section>
    <small>© {new Date().getFullYear()} {loja.nome}. A descrição de aplicação depende de comprovação técnica individual.</small>
  </footer>;
}
