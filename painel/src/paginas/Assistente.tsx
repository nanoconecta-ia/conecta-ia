import { useState, type FormEvent } from "react";
import { supabase } from "../supabase.ts";
import type { Loja } from "../lib/dados.ts";

type Msg = { de: "eu" | "ia"; texto: string };
const SUGESTOES = ["Resumo da loja", "O que está pendente?", "Produtos incompletos", "Bling conectado?"];

export function Assistente({ loja }: { loja: Loja }) {
  const [msgs, setMsgs] = useState<Msg[]>([{ de: "ia", texto: "Olá! Posso resumir a loja, mostrar o que aguarda aprovação e o que falta para publicar. Respondo só com dados do seu cadastro; para conversar com IA e usar plugins, configure a chave em Integrações de IA." }]);
  const [texto, setTexto] = useState("");
  const [ocupado, setOcupado] = useState(false);
  async function enviar(t: string) {
    if (!t.trim()) return;
    const historico = msgs.slice(1); // a saudação inicial não faz parte da conversa
    setMsgs((m) => [...m, { de: "eu", texto: t }]); setTexto(""); setOcupado(true);
    const { data, error } = await supabase.functions.invoke("assistente", { body: { loja_id: loja.id, acao: "perguntar", texto: t, historico } });
    setOcupado(false);
    setMsgs((m) => [...m, { de: "ia", texto: error ? "Não consegui responder agora." : String(data?.resposta ?? "") }]);
  }
  const onSubmit = (e: FormEvent) => { e.preventDefault(); void enviar(texto); };
  return (
    <div className="cartao">
      <h1>Assistente</h1>
      <div className="chat">{msgs.map((m, i) => <div key={i} className={`bolha ${m.de}`}>{m.texto}</div>)}</div>
      <p className="linha">{SUGESTOES.map((s) => <button key={s} className="sec" disabled={ocupado} onClick={() => void enviar(s)}>{s}</button>)}</p>
      <form onSubmit={onSubmit} style={{ maxWidth: "none" }}>
        <label>Pergunte<input value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={1000} /></label>
        <div><button disabled={ocupado}>Enviar</button></div>
      </form>
    </div>
  );
}
