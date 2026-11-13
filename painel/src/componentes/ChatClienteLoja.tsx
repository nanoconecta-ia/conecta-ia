import { useState, type FormEvent } from "react";
import { linkWhatsAppPublico } from "../lib/publicoLoja.ts";

type Mensagem = { tipo: "cliente" | "loja"; texto: string };

const ABERTURA = "Olá! Sou o atendimento inicial da loja. Posso orientar sobre aplicação, preços, entrega ou encaminhar você ao vendedor. Não confirmo estoque nem compatibilidade sem conferência humana.";

function respostaSegura(texto: string): string {
  const t = texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/preco|valor|custa|pagamento|pix|parcela/.test(t))
    return "Para informar o preço atual e as condições de pagamento, a equipe precisa conferir o produto e a disponibilidade. Envie o nome ou SKU ao vendedor pelo WhatsApp.";
  if (/entrega|frete|prazo|transportadora|retirada|cep/.test(t))
    return "A equipe confirma modalidade de entrega, frete e prazo conforme seu destino e o produto. Você pode solicitar uma cotação no WhatsApp; não envie endereço completo aqui.";
  if (/serv|aplica|compatib|motor|ano|chassi|veiculo|peca/.test(t))
    return "Para identificar a peça correta, informe ao vendedor montadora, modelo, ano, motor e código da peça. A compatibilidade precisa ser comprovada para cada versão; consulte a ficha do produto ou nosso WhatsApp.";
  if (/atendente|humano|vendedor|whats|contato|telefone/.test(t))
    return "Você pode conversar diretamente com a equipe pelo botão WhatsApp. A abertura do aplicativo não envia sua mensagem automaticamente.";
  return "Posso ajudar com aplicação de peças, preços, entrega ou encaminhar a um vendedor. Para informação específica de uma peça, abra a ficha do produto e use o chat técnico.";
}

export function ChatClienteLoja({ nome, whatsapp }: { nome: string; whatsapp?: string | null }) {
  const [aberto, setAberto] = useState(false);
  const [entrada, setEntrada] = useState("");
  const [mensagens, setMensagens] = useState<Mensagem[]>([{ tipo: "loja", texto: ABERTURA }]);
  const wa = linkWhatsAppPublico(whatsapp, "Olá! Vim pelo site da " + nome + " e preciso de atendimento sobre autopeças.");
  const enviar = (t: string) => {
    const valor = t.trim().slice(0, 260);
    if (!valor) return;
    setMensagens((ms) => [...ms.slice(-7), { tipo: "cliente", texto: valor }, { tipo: "loja", texto: respostaSegura(valor) }]);
    setEntrada("");
  };
  const submit = (e: FormEvent) => { e.preventDefault(); enviar(entrada); };

  return (
    <aside className={"chat-cliente" + (aberto ? " aberto" : "")} aria-label="Atendimento da loja">
      {aberto && (
        <section className="chat-cliente-caixa" aria-label="Conversa de atendimento">
          <div className="chat-cliente-cabecalho">
            <div><strong>Atendimento {nome}</strong><small>Orientação inicial automática · sem pedidos</small></div>
            <button type="button" onClick={() => setAberto(false)} aria-label="Fechar conversa">×</button>
          </div>
          <div className="chat-cliente-mensagens" aria-live="polite" aria-relevant="additions text">
            {mensagens.map((m, i) => <p key={i} className={"chat-cliente-msg " + m.tipo}>{m.texto}</p>)}
          </div>
          <div className="chat-cliente-atalhos" aria-label="Perguntas rápidas">
            {["Aplicação da peça", "Preço atual", "Entrega e frete"].map((t) => <button type="button" key={t} onClick={() => enviar(t)}>{t}</button>)}
          </div>
          <form className="chat-cliente-form" onSubmit={submit}>
            <label className="sr" htmlFor="chat-cliente-entrada">Escreva sua dúvida</label>
            <input id="chat-cliente-entrada" value={entrada} onChange={(e) => setEntrada(e.target.value)} maxLength={260} placeholder="Como posso ajudar?" />
            <button type="submit" disabled={!entrada.trim()}>Enviar</button>
          </form>
          <p className="chat-cliente-privacidade">Este chat é local e não envia o texto a uma IA externa. Não informe CPF, chassi completo, endereço nem dados de pagamento.</p>
          {wa && <a className="chat-cliente-whatsapp" href={wa} target="_blank" rel="noopener noreferrer">Conversar com vendedor no WhatsApp</a>}
        </section>
      )}
      <button className="chat-cliente-botao" type="button" aria-expanded={aberto} onClick={() => setAberto(!aberto)}>
        <span aria-hidden="true">◉</span> {aberto ? "Fechar atendimento" : "Chat de atendimento"}
      </button>
    </aside>
  );
}
