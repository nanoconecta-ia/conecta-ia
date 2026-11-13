"use client";

import { useState, type FormEvent } from "react";

type Msg = { de: "cliente" | "atendimento"; texto: string };

const boasVindas = "Olá! Este chat oferece orientações iniciais sobre peças. Compatibilidade, preço, estoque e entrega exigem confirmação da loja.";

function resposta(t: string): string {
  const q = t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/compat|serv|aplica|ano|motor|chassi|veiculo/.test(q)) return "Para conferir aplicação, informe ao vendedor o modelo, ano, motorização e código da peça. Não envie o chassi completo neste chat.";
  if (/preco|custa|valor|pix|parcela|pagamento/.test(q)) return "Preço e forma de pagamento precisam ser confirmados pelo vendedor conforme o produto e o cadastro atual.";
  if (/frete|entrega|retirada|prazo|cep/.test(q)) return "Frete, disponibilidade e prazo são confirmados pelo vendedor. Não compartilhe seu endereço neste chat.";
  return "Posso orientar sobre aplicação, preço e entrega. Para uma cotação real, abra o atendimento pelo WhatsApp, que não envia a mensagem automaticamente.";
}
function waLoja(numero: string | null, msg: string) {
  let d=(numero??"").replace(/\D/g,"");
  if(d.length===10||d.length===11)d="55"+d;
  return /^55\d{10,11}$/.test(d) ? "https://wa.me/"+d+"?text="+encodeURIComponent(msg) : null;
}

export function ChatLojaWeb({ nome, whatsapp, produto }: { nome: string; whatsapp: string | null; produto?: { nome: string; sku: string } }) {
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState("");
  const [mensagens, setMensagens] = useState<Msg[]>([{ de: "atendimento", texto: boasVindas }]);
  const enviar = (m: string) => {
    const t = m.trim().slice(0, 240);
    if (!t) return;
    setMensagens((arr) => [...arr.slice(-7), { de: "cliente", texto: t }, { de: "atendimento", texto: resposta(t) }]);
    setTexto("");
  };
  const wa = waLoja(whatsapp, produto
    ? "Olá! Tenho interesse em " + produto.nome.slice(0, 150) + " (cód. " + produto.sku.slice(0, 70) + "). Pode confirmar aplicação e preço?"
    : "Olá! Vim pelo site da " + nome + " e gostaria de falar com um vendedor.");
  const submit = (e: FormEvent) => { e.preventDefault(); enviar(texto); };
  return <aside className="mobis-chat" aria-label="Chat de atendimento ao cliente">
    {aberto && <section className="mobis-chat-janela" aria-label="Conversa de atendimento">
      <header className="mobis-chat-topo"><strong>Atendimento {nome}</strong><button type="button" onClick={()=>setAberto(false)} aria-label="Fechar chat">×</button></header>
      <div className="mobis-chat-msgs" aria-live="polite">{mensagens.map((m,i)=><p className={m.de} key={i}>{m.texto}</p>)}</div>
      <div className="mobis-chat-sugestoes">{["Aplicação", "Preço", "Entrega"].map(t=><button type="button" key={t} onClick={()=>enviar(t)}>{t}</button>)}</div>
      <form className="mobis-chat-form" onSubmit={submit}><label className="sr-only" htmlFor="mobis-chat-texto">Sua mensagem</label><input id="mobis-chat-texto" maxLength={240} value={texto} onChange={e=>setTexto(e.target.value)} placeholder="Digite sua dúvida" /><button type="submit" disabled={!texto.trim()}>Enviar</button></form>
      <p className="mobis-chat-alerta">Chat local, sem envio a IA externa. Não digite CPF, chassi completo ou dados bancários.</p>
      {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="mobis-chat-wa">Falar com vendedor pelo WhatsApp</a>}
    </section>}
    <button type="button" className="mobis-chat-abrir" onClick={()=>setAberto(!aberto)} aria-expanded={aberto}>{aberto ? "Fechar chat" : "Chat de atendimento"}</button>
  </aside>;
}
